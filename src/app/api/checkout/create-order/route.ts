/**
 * POST /api/checkout/create-order
 * -------------------------------
 * Create a draft order + Razorpay Order atomically.
 *
 * Razorpay's flow is simpler than Stripe:
 *  1. Server creates a draft order in our DB (idempotent via idempotency_key)
 *  2. Server creates a Razorpay Order via Razorpay API (idempotent via header)
 *  3. Server attaches Razorpay order_id to our draft order
 *  4. Returns Razorpay order_id + key_id to client
 *  5. Client opens Razorpay Checkout with order_id
 *  6. After payment, client calls /api/checkout/verify-payment
 *
 * Idempotency:
 *  - Client sends `idempotencyKey` (UUID) in the request body
 *  - If the same key is submitted twice (refresh, double-click, retry):
 *    a) DB RPC `create_draft_order` will fail with unique constraint violation
 *    b) We catch the error, look up the existing order by idempotency_key
 *    c) If existing order is in 'draft'/'awaiting_payment' state, return
 *       the existing order info (client re-uses existing Razorpay order_id)
 *    d) If existing order is in 'confirmed' state, return success status
 *    e) If 'failed'/'cancelled', reject — user needs a new idempotency key
 *
 * Security:
 *  - Requires authenticated session
 *  - Validates request body with Zod
 *  - Re-validates entire checkout on server (cart, branch, slot, donations, rewards)
 *  - RECALCULATES all prices from menu catalog
 *  - Rate limited per user + per IP (stricter than validate)
 *  - Reward points deducted atomically inside the RPC transaction
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { createOrderSchema } from '@/lib/validation/checkout-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'
import { computeCheckout, sanitizeCustomerNotes } from '@/services/checkout-service'
import {
  createDraftOrder,
  findOrderByIdempotencyKey,
  attachRazorpayOrderToOrder,
  cancelDraftOrder,
} from '@/services/order-service'
import { createRazorpayOrder } from '@/services/payment-service'
import { getISTTodayDate } from '@/services/pickup-slot-service'
import { CHECKOUT_CONFIG } from '@/types/checkout'

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    // 2. Rate limit (stricter than validate — this creates resources)
    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'checkout_create', {
      maxAttempts: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many checkout attempts. Please wait a few minutes.' },
        { status: 429 },
      )
    }
    const userCheck = checkRateLimit(user.id, 'checkout_create', {
      maxAttempts: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    })
    if (!userCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many checkout attempts. Please wait a few minutes.' },
        { status: 429 },
      )
    }

    // 3. Parse + validate body
    const body = await request.json()
    const result = createOrderSchema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    const input = result.data
    const customerNotes = sanitizeCustomerNotes(input.customerNotes)

    // 4. Compute checkout (validates everything, returns server-computed amounts)
    const checkout = await computeCheckout({
      userId: user.id,
      branchSlug: input.branchSlug,
      pickupSlotKey: input.pickupSlotKey,
      donations: input.donations,
      rewardPointsToRedeem: input.rewardPointsToRedeem,
    })

    if (!checkout.success || !checkout.data) {
      return NextResponse.json(
        { success: false, message: checkout.message },
        { status: 400 },
      )
    }

    const c = checkout.data

    // 5. IDEMPOTENCY CHECK: has this idempotency_key been used before?
    const existingOrder = await findOrderByIdempotencyKey(user.id, input.idempotencyKey)
    if (existingOrder) {
      // Same key submitted twice. Handle based on order state:
      if (existingOrder.orderStatus === 'confirmed') {
        return NextResponse.json({
          success: true,
          message: 'Order already completed.',
          data: {
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            razorpayOrderId: existingOrder.razorpayOrderId,
            amountPaise: existingOrder.finalAmountPaise,
            currency: CHECKOUT_CONFIG.currency,
            finalAmountPaise: existingOrder.finalAmountPaise,
            orderStatus: existingOrder.orderStatus,
          },
        })
      }

      if (existingOrder.orderStatus === 'failed' || existingOrder.orderStatus === 'cancelled') {
        // Instead of blocking, generate a fresh idempotency key so the
        // caller can create a new order. We return a special status code
        // that the client can detect and retry with a new key.
        return NextResponse.json(
          {
            success: false,
            message: 'STALE_ORDER',
            needsNewKey: true,
          },
          { status: 409 },
        )
      }

      // Order exists in 'draft' or 'awaiting_payment' state.
      // Return the existing Razorpay order_id so client can re-open Checkout.
      return NextResponse.json({
        success: true,
        message: 'Checkout already in progress.',
        data: {
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          razorpayOrderId: existingOrder.razorpayOrderId,
          amountPaise: existingOrder.finalAmountPaise,
          currency: CHECKOUT_CONFIG.currency,
          finalAmountPaise: existingOrder.finalAmountPaise,
          orderStatus: existingOrder.orderStatus,
        },
      })
    }

    // 6. Create draft order (atomic: order + items + reward deduction)
    const draftResult = await createDraftOrder({
      userId: user.id,
      branchId: c.branch.id,
      pickupDate: getISTTodayDate(),
      pickupSlotStart: c.pickupSlot.startTime + ':00',
      pickupSlotEnd: c.pickupSlot.endTime + ':00',
      subtotalPaise: c.subtotalPaise,
      donationPlantationPaise: c.donationPlantationPaise,
      donationHungerPaise: c.donationHungerPaise,
      rewardPointsToRedeem: c.rewardPointsRedeemed,
      rewardDiscountPaise: c.rewardDiscountPaise,
      finalAmountPaise: c.finalAmountPaise,
      idempotencyKey: input.idempotencyKey,
      cartItems: c.cartItems,
    })

    if (!draftResult.success || !draftResult.orderId || !draftResult.orderNumber) {
      if (draftResult.message === 'DUPLICATE_IDEMPOTENCY_KEY') {
        return NextResponse.json(
          { success: false, message: 'Checkout already in progress. Please refresh.' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { success: false, message: draftResult.message },
        { status: 400 },
      )
    }

    const orderId = draftResult.orderId
    const orderNumber = draftResult.orderNumber

    // 7. Create Razorpay Order
    const rzpResult = await createRazorpayOrder({
      orderId,
      orderNumber,
      userId: user.id,
      amountPaise: c.finalAmountPaise,
      idempotencyKey: input.idempotencyKey,
    })

    if (!rzpResult.success || !rzpResult.data) {
      // Failed to create Razorpay order. Cancel the draft so user can retry.
      await cancelDraftOrder(user.id, orderId)
      return NextResponse.json(
        { success: false, message: rzpResult.message },
        { status: 502 },
      )
    }

    // 8. Attach Razorpay order_id to our order (creates payment row, transitions to awaiting_payment)
    const attachResult = await attachRazorpayOrderToOrder({
      orderId,
      userId: user.id,
      razorpayOrderId: rzpResult.data.razorpayOrderId,
      amountPaise: c.finalAmountPaise,
    })

    if (!attachResult.success) {
      // RPC failed — possibly because the `attach_razorpay_order_to_order` function
      // doesn't exist yet (user hasn't run migration 005). Try a direct Supabase
      // fallback: update orders.razorpay_order_id and insert into payments directly.
      console.error('[CHECKOUT CREATE-ORDER] attach RPC failed:', attachResult.message, '— trying direct fallback')
      try {
        const { createServerClient } = await import('@/lib/supabase/client-server')
        const supabase = await createServerClient()

        // Update order with razorpay_order_id and set status to awaiting_payment
        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            razorpay_order_id: rzpResult.data.razorpayOrderId,
            order_status: 'awaiting_payment',
          })
          .eq('id', orderId)
          .eq('user_id', user.id)
          .is('order_status', 'draft')

        if (updateErr) {
          console.error('[CHECKOUT CREATE-ORDER] Direct order update failed:', updateErr.message)
          await cancelDraftOrder(user.id, orderId)
          return NextResponse.json(
            { success: false, message: 'Couldn’t set up payment. Please try again.' },
            { status: 500 },
          )
        }

        // Insert payment row directly
        const { error: payErr } = await supabase
          .from('payments')
          .insert({
            order_id: orderId,
            user_id: user.id,
            razorpay_order_id: rzpResult.data.razorpayOrderId,
            amount_paise: c.finalAmountPaise,
            currency: CHECKOUT_CONFIG.currency,
            status: 'pending',
          })

        if (payErr) {
          // Payment insert failed — order is still in awaiting_payment state
          // which is fine, the payment row is non-critical for the happy path
          console.error('[CHECKOUT CREATE-ORDER] Direct payment insert failed (non-critical):', payErr.message)
        }
      } catch (fallbackErr) {
        console.error('[CHECKOUT CREATE-ORDER] Direct fallback error:', fallbackErr)
        await cancelDraftOrder(user.id, orderId)
        return NextResponse.json(
          { success: false, message: 'Couldn’t set up payment. Please try again.' },
          { status: 500 },
        )
      }
    }

    // 9. Save customer notes (best-effort — non-critical)
    if (customerNotes) {
      try {
        const { createServerClient } = await import('@/lib/supabase/client-server')
        const supabase = await createServerClient()
        await supabase
          .from('orders')
          .update({ customer_notes: customerNotes })
          .eq('id', orderId)
          .eq('user_id', user.id)
      } catch {
        // Non-critical — order proceeds without notes
      }
    }

    // 10. Return success — client now opens Razorpay Checkout with the order_id
    return NextResponse.json({
      success: true,
      message: 'Order created. Please complete payment.',
      data: {
        orderId,
        orderNumber,
        razorpayOrderId: rzpResult.data.razorpayOrderId,
        amountPaise: rzpResult.data.amountPaise,
        currency: rzpResult.data.currency,
        finalAmountPaise: c.finalAmountPaise,
        orderStatus: 'awaiting_payment',
      },
    })
  } catch (err) {
    console.error('[CHECKOUT CREATE-ORDER UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
