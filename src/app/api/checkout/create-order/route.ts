/**
 * POST /api/checkout/create-order
 * -------------------------------
 * Create a draft order + Stripe PaymentIntent atomically.
 *
 * Idempotency:
 *  - Client sends `idempotencyKey` (UUID) in the request body
 *  - If the same key is submitted twice (refresh, double-click, retry):
 *    a) DB RPC `create_draft_order` will fail with unique constraint violation
 *    b) We catch the error, look up the existing order by idempotency_key
 *    c) If existing order is in 'draft'/'awaiting_payment' state, return
 *       the existing order info (client must use existing PI's client_secret)
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
  attachPaymentIntentToOrder,
  cancelDraftOrder,
} from '@/services/order-service'
import { createPaymentIntent } from '@/services/payment-service'
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
            clientSecret: null,
            amountPaise: existingOrder.finalAmountPaise,
            currency: CHECKOUT_CONFIG.currency,
            finalAmountPaise: existingOrder.finalAmountPaise,
            orderStatus: existingOrder.orderStatus,
          },
        })
      }

      if (existingOrder.orderStatus === 'failed' || existingOrder.orderStatus === 'cancelled') {
        return NextResponse.json(
          {
            success: false,
            message: 'Previous checkout attempt failed. Please start a new checkout.',
          },
          { status: 400 },
        )
      }

      // Order exists in 'draft' or 'awaiting_payment' state.
      // If it already has a Stripe PaymentIntent, return that PI's id so the
      // client can fetch the existing client_secret from their store (or
      // re-mount Stripe Elements with a fresh key if they lost it).
      return NextResponse.json({
        success: true,
        message: 'Checkout already in progress.',
        data: {
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          // Client should already have the client_secret from the original
          // create-order call. If they lost it (refresh), they need to
          // start a new checkout with a fresh idempotency key.
          clientSecret: null,
          amountPaise: existingOrder.finalAmountPaise,
          currency: CHECKOUT_CONFIG.currency,
          finalAmountPaise: existingOrder.finalAmountPaise,
          orderStatus: existingOrder.orderStatus,
          stripePaymentIntentId: existingOrder.stripePaymentIntentId,
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

    // 7. Create Stripe PaymentIntent
    const piResult = await createPaymentIntent({
      orderId,
      orderNumber,
      userId: user.id,
      amountPaise: c.finalAmountPaise,
      idempotencyKey: input.idempotencyKey,
    })

    if (!piResult.success || !piResult.data) {
      // Failed to create PI. Cancel the order so the user can try again.
      await cancelDraftOrder(user.id, orderId)
      return NextResponse.json(
        { success: false, message: piResult.message },
        { status: 502 },
      )
    }

    // 8. Attach PI to order (creates payment row, transitions to awaiting_payment)
    const attachResult = await attachPaymentIntentToOrder({
      orderId,
      userId: user.id,
      stripePaymentIntentId: piResult.data.paymentIntentId,
      amountPaise: c.finalAmountPaise,
    })

    if (!attachResult.success) {
      // PI was created but we couldn't attach it. Cancel the order; the PI
      // will be auto-cancelled by Stripe after 24h of no capture.
      await cancelDraftOrder(user.id, orderId)
      return NextResponse.json(
        { success: false, message: 'Failed to link payment. Please try again.' },
        { status: 500 },
      )
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

    // 10. Return success — client now mounts Stripe Elements with the client_secret
    return NextResponse.json({
      success: true,
      message: 'Order created. Please complete payment.',
      data: {
        orderId,
        orderNumber,
        clientSecret: piResult.data.clientSecret,
        amountPaise: piResult.data.amountPaise,
        currency: piResult.data.currency,
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
