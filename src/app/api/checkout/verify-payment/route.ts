/**
 * POST /api/checkout/verify-payment
 * ---------------------------------
 * Verify the Razorpay payment signature returned by Razorpay Checkout.
 *
 * This is the SECURITY ANCHOR of the entire payment flow.
 *
 * Flow:
 *  1. User pays via Razorpay Checkout (UPI/card/netbanking)
 *  2. Razorpay returns to client:
 *       - razorpay_payment_id (e.g., 'pay_NqjXcXxXxXxXxX')
 *       - razorpay_order_id   (e.g., 'order_NqjXcXxXxXxXxX')
 *       - razorpay_signature  (HMAC SHA256 hex)
 *  3. Client POSTs all three to this endpoint
 *  4. Server verifies: HMAC_SHA256(order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)
 *     === received signature (timing-safe compare)
 *  5. If valid: mark order as 'confirmed' (RPC also awards reward points + clears cart)
 *  6. If invalid: mark order as 'failed' (RPC restores redeemed reward points)
 *
 * WHY THIS WORKS WITHOUT WEBHOOKS:
 *  - Razorpay signs the payment with our key_secret — only Razorpay can produce
 *    a valid signature (we never expose key_secret to the client)
 *  - The signature proves: (a) the payment was real, (b) the data wasn't tampered
 *  - We don't need a webhook for the happy path — the client immediately knows
 *    the outcome
 *
 * WHY WE ALSO HAVE A WEBHOOK (optional, for resilience):
 *  - If the user closes the browser between payment success and the
 *    verify-payment API call, the payment succeeds but our DB is never updated
 *  - The webhook (payment.captured event) catches this case — Razorpay retries
 *    the webhook for up to 24 hours
 *  - Both paths call the same `mark_order_succeeded` RPC, which is idempotent
 *
 * Security:
 *  - Requires authenticated session
 *  - Validates all inputs with Zod
 *  - Order must belong to the authenticated user (RLS enforced)
 *  - Order must be in 'awaiting_payment' state (can't verify a confirmed/failed order)
 *  - Rate limited
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getAuthenticatedUser } from '@/services/cart-service'
import { verifyPaymentSignature } from '@/services/payment-service'
import { markOrderSucceeded, markOrderFailed } from '@/services/order-service'
import { z } from 'zod/v4'

// Ensure Node.js runtime (we use crypto module)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================
const verifyPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  razorpayOrderId: z.string().min(10, 'Invalid Razorpay order ID').max(100),
  razorpayPaymentId: z.string().min(10, 'Invalid Razorpay payment ID').max(100),
  razorpaySignature: z.string().min(10, 'Invalid signature').max(256),
})

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    // 2. Rate limit (generous — user may retry if first attempt fails verification)
    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'checkout_verify', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Please wait a moment.' },
        { status: 429 },
      )
    }
    const userCheck = checkRateLimit(user.id, 'checkout_verify', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!userCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Please wait a moment.' },
        { status: 429 },
      )
    }

    // 3. Parse + validate body
    const body = await request.json()
    const result = verifyPaymentSchema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = result.data

    // 4. Verify the signature — THIS IS THE CRITICAL SECURITY CHECK
    const verifyResult = verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    })

    if (!verifyResult.success || !verifyResult.verified) {
      // Signature FAILED — could be:
      //  - Tampering attempt (someone forging a payment)
      //  - Network corruption (rare)
      //  - Configuration error (wrong key_secret)
      // Mark order as failed so reward points are restored.
      console.error('[VERIFY PAYMENT] Signature verification FAILED', {
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        userId: user.id,
      })

      await markOrderFailed({
        orderId,
        failureReason: 'Payment signature verification failed',
        webhookEventId: `verify-fail-${Date.now()}-${razorpayPaymentId.slice(-8)}`,
        eventType: 'payment.signature_failed',
        rawPayload: { razorpayOrderId, razorpayPaymentId, reason: 'signature_mismatch' },
      })

      return NextResponse.json(
        { success: false, message: 'Payment verification failed. Please contact support.' },
        { status: 400 },
      )
    }

    // 5. Signature is valid — mark order as succeeded
    //  - Order transitions to 'confirmed'
    //  - Payment row updated with razorpay_payment_id + signature
    //  - Reward points awarded (5 if subtotal > ₹500 AND plantation donation)
    //  - Cart cleared
    let successResult = await markOrderSucceeded({
      orderId,
      razorpayPaymentId,
      razorpaySignature,
      webhookEventId: `verify-success-${Date.now()}-${razorpayPaymentId.slice(-8)}`,
      eventType: 'payment.verified',
      rawPayload: { razorpayOrderId, razorpayPaymentId },
    })

    // If RPC failed, try direct fallback (in case migration 004/005 not applied)
    if (!successResult.success) {
      console.warn('[VERIFY PAYMENT] markOrderSucceeded RPC failed:', successResult.message, '- trying direct fallback')
      try {
        const { createServerClient } = await import('@/lib/supabase/client-server')
        const supabase = await createServerClient()

        // Update order to confirmed
        const { error: orderErr } = await supabase
          .from('orders')
          .update({
            order_status: 'confirmed',
            payment_status: 'succeeded',
          })
          .eq('id', orderId)
          .eq('user_id', user.id)
          .in('order_status', ['draft', 'awaiting_payment'])

        if (orderErr) {
          console.error('[VERIFY PAYMENT] Direct order update failed:', orderErr.message)
          return NextResponse.json(
            { success: false, message: 'Payment was successful but we could not update your order. Please contact support.' },
            { status: 500 },
          )
        }

        // Try to update payment row (best-effort)
        try {
          await supabase
            .from('payments')
            .update({
              status: 'succeeded',
              razorpay_payment_id: razorpayPaymentId,
              razorpay_signature: razorpaySignature,
            })
            .eq('order_id', orderId)
            .eq('user_id', user.id)
        } catch {
          // Payment update is non-critical
        }

        // Clear user's cart
        try {
          await supabase.from('cart_items').delete().eq('user_id', user.id)
        } catch {
          // Cart clear is best-effort
        }

        successResult = { success: true, message: 'Order confirmed via direct fallback.' }
      } catch (fallbackErr) {
        console.error('[VERIFY PAYMENT] Direct fallback also failed:', fallbackErr)
        return NextResponse.json(
          { success: false, message: 'Payment was successful but we could not update your order. Please contact support with your order number.' },
          { status: 500 },
        )
      }
    }

    // 6. Return success — client navigates to confirmation page
    return NextResponse.json({
      success: true,
      message: 'Payment verified. Order confirmed.',
      data: {
        orderId,
        orderStatus: 'confirmed',
        rewardPointsEarned: successResult.rewardPointsEarned ?? 0,
      },
    })
  } catch (err) {
    console.error('[VERIFY PAYMENT UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong during verification.' },
      { status: 500 },
    )
  }
}
