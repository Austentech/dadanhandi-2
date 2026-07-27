/**
 * POST /api/razorpay/webhook
 * --------------------------
 * Razorpay webhook receiver (SECONDARY confirmation mechanism).
 *
 * PRIMARY confirmation = /api/checkout/verify-payment (called by client
 * immediately after Razorpay Checkout closes with a payment_id).
 *
 * This webhook is OPTIONAL but RECOMMENDED — it catches the case where
 * the user closes their browser between payment success and the
 * verify-payment API call. Razorpay retries this webhook for up to
 * ~3 days, so we'll always eventually update the order.
 *
 * CRITICAL SECURITY RULES:
 *  1. The raw body MUST be passed to verifyWebhookSignature — do NOT
 *     parse as JSON first. Razorpay signs the raw bytes.
 *  2. The webhook secret (RAZORPAY_WEBHOOK_SECRET) is loaded from env.
 *  3. Every event is deduplicated via the processed_webhook_events table
 *     (inside the mark_order_succeeded/failed RPCs).
 *  4. Order state transitions are idempotent — if the order is already
 *     confirmed/failed, subsequent events are safely ignored.
 *  5. No sensitive information is leaked in responses.
 *
 * HANDLED EVENTS:
 *  - payment.captured → mark_order_succeeded (idempotent)
 *  - payment.failed   → mark_order_failed (idempotent)
 *
 * Other event types are acknowledged (200 OK) but not processed.
 *
 * Next.js Route Handler body parsing:
 *  - This route reads the raw body via request.text()
 *  - The route is exported with `export const runtime = 'nodejs'`
 *  - We do NOT use Next's body parser — we read the raw stream
 */

import { NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/services/payment-service'
import { findOrderByRazorpayOrderId, markOrderSucceeded, markOrderFailed } from '@/services/order-service'

interface RazorpayWebhookPayload {
  entity?: string
  account_id?: string
  event?: string
  contains?: string[]
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        status?: string
        amount?: number
        currency?: string
        method?: string
        error_description?: string
        error_code?: string
        notes?: Record<string, string>
      }
    }
    order?: {
      entity?: {
        id?: string
        status?: string
        amount?: number
        notes?: Record<string, string>
      }
    }
  }
  created_at?: number
}

// Ensure this route runs on Node.js (not Edge) so we have full crypto
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // 1. Read the RAW body — Razorpay signs the raw bytes, not parsed JSON
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature') || ''

    // 2. Verify webhook signature
    const verifyResult = verifyWebhookSignature(rawBody, signature)
    if (!verifyResult.success || !verifyResult.event) {
      console.error('[RAZORPAY WEBHOOK] Signature verification failed')
      // Razorpay expects 400 on signature failure so it doesn't retry
      return NextResponse.json(
        { error: 'Webhook signature verification failed.' },
        { status: 400 },
      )
    }

    const payload = verifyResult.event as RazorpayWebhookPayload
    const eventType = payload.event || 'unknown'

    // 3. Process the event based on type
    switch (eventType) {
      case 'payment.captured': {
        const paymentEntity = payload.payload?.payment?.entity
        if (!paymentEntity?.order_id || !paymentEntity?.id) {
          console.error('[RAZORPAY WEBHOOK] payment.captured missing order_id or payment_id')
          break
        }

        // Find our internal order by the Razorpay order_id
        const order = await findOrderByRazorpayOrderId(paymentEntity.order_id)
        if (!order) {
          console.error(`[RAZORPAY WEBHOOK] Order not found for Razorpay order_id: ${paymentEntity.order_id}`)
          break
        }

        // Mark as succeeded (idempotent — if already processed, returns success)
        const result = await markOrderSucceeded({
          orderId: order.id,
          razorpayPaymentId: paymentEntity.id,
          razorpaySignature: `webhook-${payload.created_at || Date.now()}`,
          webhookEventId: payload.payload?.payment?.entity?.id || `evt-${Date.now()}`,
          eventType,
          rawPayload: payload,
        })

        if (!result.success) {
          console.error(`[RAZORPAY WEBHOOK] markOrderSucceeded failed for order ${order.id}:`, result.message)
          break
        }

        console.log(
          `[RAZORPAY WEBHOOK] Order ${order.orderNumber} confirmed via webhook. ` +
          `Points earned: ${result.rewardPointsEarned ?? 0}`,
        )
        break
      }

      case 'payment.failed': {
        const paymentEntity = payload.payload?.payment?.entity
        if (!paymentEntity?.order_id) {
          console.error('[RAZORPAY WEBHOOK] payment.failed missing order_id')
          break
        }

        const order = await findOrderByRazorpayOrderId(paymentEntity.order_id)
        if (!order) {
          console.error(`[RAZORPAY WEBHOOK] Order not found for failed Razorpay order_id: ${paymentEntity.order_id}`)
          break
        }

        const failureReason = paymentEntity.error_description || 'Payment failed'

        const result = await markOrderFailed({
          orderId: order.id,
          failureReason,
          webhookEventId: paymentEntity.id || `evt-fail-${Date.now()}`,
          eventType,
          rawPayload: payload,
        })

        if (!result.success) {
          console.error(`[RAZORPAY WEBHOOK] markOrderFailed failed for order ${order.id}:`, result.message)
          break
        }

        console.log(
          `[RAZORPAY WEBHOOK] Order ${order.orderNumber} marked failed via webhook. ` +
          `Points restored: ${result.rewardPointsRestored ?? 0}`,
        )
        break
      }

      // Acknowledge these but don't act on them
      case 'payment.authorized':
      case 'order.paid':
      case 'refund.processed':
      case 'refund.created':
        // No-op — we already process via payment.captured
        break

      default:
        // Unknown event type — log for monitoring but don't fail
        console.log(`[RAZORPAY WEBHOOK] Unhandled event type: ${eventType}`)
    }

    // 4. Always return 200 to acknowledge receipt (prevents Razorpay retries)
    return NextResponse.json({ received: true })
  } catch (err) {
    // NEVER leak internal errors to Razorpay
    console.error('[RAZORPAY WEBHOOK UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 },
    )
  }
}
