/**
 * POST /api/stripe/webhook
 * ------------------------
 * Stripe webhook receiver. Verifies the event signature and processes
 * payment_intent.succeeded and payment_intent.payment_failed events.
 *
 * CRITICAL SECURITY RULES:
 *  1. The raw body MUST be passed to verifyWebhookSignature — do NOT
 *     parse as JSON first. Stripe signs the raw bytes.
 *  2. The webhook secret (STRIPE_WEBHOOK_SECRET) is loaded from env.
 *  3. Every event is deduplicated via the processed_webhook_events table.
 *     If we receive the same event_id twice, the second call is a no-op.
 *  4. Order state transitions are idempotent — if the order is already
 *     confirmed/failed, subsequent events are safely ignored.
 *  5. No sensitive information (Stripe errors, DB errors, paths) is
 *     leaked in responses — only generic success/failure messages.
 *
 * LIFECYCLE:
 *  - payment_intent.succeeded → mark_order_succeeded RPC
 *      → order_status='confirmed', payment_status='succeeded'
 *      → reward points awarded (5 if eligible)
 *      → cart cleared
 *  - payment_intent.payment_failed → mark_order_failed RPC
 *      → order_status='failed', payment_status='failed'
 *      → redeemed reward points restored
 *
 * Other event types are acknowledged (200 OK) but not processed.
 *
 * Next.js Route Handler body parsing:
 *  - This route reads the raw body via request.text()
 *  - The route is exported with `export const runtime = 'nodejs'` so the
 *    raw body is available (edge runtime has different constraints)
 *  - We do NOT use Next's body parser — we read the raw stream
 */

import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/services/payment-service'
import { findOrderByPaymentIntentId, markOrderSucceeded, markOrderFailed } from '@/services/order-service'
import type Stripe from 'stripe'

// Ensure this route runs on Node.js (not Edge) so we have full Stripe SDK
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // 1. Read the RAW body — Stripe signs the raw bytes, not parsed JSON
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature') || ''

    // 2. Verify webhook signature
    const verifyResult = verifyWebhookSignature(rawBody, signature)
    if (!verifyResult.success || !verifyResult.event) {
      console.error('[STRIPE WEBHOOK] Signature verification failed')
      // Stripe expects 400 on signature failure so it doesn't retry
      return NextResponse.json(
        { error: 'Webhook signature verification failed.' },
        { status: 400 },
      )
    }

    const event = verifyResult.event

    // 3. Process the event based on type
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(pi, event.id, event.type)
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(pi, event.id, event.type)
        break
      }
      // Acknowledge these but don't act on them
      case 'payment_intent.created':
      case 'payment_intent.processing':
      case 'payment_intent.canceled':
      case 'charge.refunded':
        // No-op
        break
      default:
        // Unknown event type — log for monitoring but don't fail
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`)
    }

    // 4. Always return 200 to acknowledge receipt (prevents Stripe retries)
    return NextResponse.json({ received: true })
  } catch (err) {
    // NEVER leak internal errors to Stripe (it could leak secrets)
    console.error('[STRIPE WEBHOOK UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 },
    )
  }
}

// ============================================================================
// HANDLER: payment_intent.succeeded
// ============================================================================
async function handlePaymentSucceeded(
  pi: Stripe.PaymentIntent,
  eventId: string,
  eventType: string,
): Promise<void> {
  // Find the order by Stripe PaymentIntent ID (stored in metadata, but
  // we look up by the stripe_payment_intent_id column on orders)
  const order = await findOrderByPaymentIntentId(pi.id)
  if (!order) {
    console.error(`[STRIPE WEBHOOK] Order not found for PI: ${pi.id}`)
    return
  }

  // Extract charge ID (latest_charge on the PI, or first charge)
  const chargeId = typeof pi.latest_charge === 'string'
    ? pi.latest_charge
    : pi.latest_charge?.id ?? null

  // Mark order as succeeded (idempotent — if already processed, returns success)
  const result = await markOrderSucceeded({
    orderId: order.id,
    stripeChargeId: chargeId || '',
    webhookEventId: eventId,
    eventType,
    rawPayload: pi,
  })

  if (!result.success) {
    console.error(`[STRIPE WEBHOOK] markOrderSucceeded failed for order ${order.id}:`, result.message)
    return
  }

  console.log(
    `[STRIPE WEBHOOK] Order ${order.orderNumber} confirmed. ` +
    `Points earned: ${result.rewardPointsEarned ?? 0}. ` +
    `Idempotent: ${result.message.includes('already') ? 'yes' : 'no'}`,
  )
}

// ============================================================================
// HANDLER: payment_intent.payment_failed
// ============================================================================
async function handlePaymentFailed(
  pi: Stripe.PaymentIntent,
  eventId: string,
  eventType: string,
): Promise<void> {
  const order = await findOrderByPaymentIntentId(pi.id)
  if (!order) {
    console.error(`[STRIPE WEBHOOK] Order not found for failed PI: ${pi.id}`)
    return
  }

  // Extract failure reason (logged for diagnostics, NEVER exposed to client)
  const failureReason = pi.last_payment_error?.message || 'Payment failed'

  const result = await markOrderFailed({
    orderId: order.id,
    failureReason,
    webhookEventId: eventId,
    eventType,
    rawPayload: pi,
  })

  if (!result.success) {
    console.error(`[STRIPE WEBHOOK] markOrderFailed failed for order ${order.id}:`, result.message)
    return
  }

  console.log(
    `[STRIPE WEBHOOK] Order ${order.orderNumber} marked failed. ` +
    `Points restored: ${result.rewardPointsRestored ?? 0}. ` +
    `Idempotent: ${result.message.includes('already') ? 'yes' : 'no'}`,
  )
}
