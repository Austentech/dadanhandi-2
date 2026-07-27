/**
 * Payment Service (Razorpay wrapper, server-side)
 * -----------------------------------------------
 * Wraps all Razorpay server-side API calls. NEVER expose the key_secret
 * to the client.
 *
 * Lifecycle (Razorpay flow is SIMPLER than Stripe — no webhooks needed
 * for the happy path):
 *  1. createOrder(amount, internalOrder) → returns { razorpayOrderId, amountPaise }
 *     - Called from /api/checkout/create-order after draft order is created
 *     - Stores order_id + order_number in Razorpay order notes for dashboard
 *     - Idempotent: passing the same idempotencyKey returns the same order
 *       (Razorpay supports idempotency via X-Razorpay-Idempotency-Key header)
 *  2. Client opens Razorpay Checkout modal (via Razorpay Checkout.js script)
 *     - User pays via UPI / card / netbanking
 *     - Razorpay returns razorpay_payment_id + razorpay_order_id + razorpay_signature
 *       to the client
 *  3. Client calls POST /api/checkout/verify-payment with the three IDs
 *  4. Server verifies the signature using HMAC SHA256 with key_secret
 *     - If valid: order is marked as 'confirmed' (reward points awarded, cart cleared)
 *     - If invalid: order is marked as 'failed' (reward points restored)
 *
 * OPTIONAL WEBHOOK:
 *  - Razorpay can also send webhooks (payment.captured, payment.failed)
 *  - We've set up the webhook route at /api/razorpay/webhook as a
 *    SECONDARY confirmation mechanism for resilience (in case the client
 *    closes the browser after payment but before verification)
 *  - The webhook is OPTIONAL — the primary source of truth is the
 *    client-side verify-payment call (which the user sees immediately)
 *
 * SECURITY:
 *  - Razorpay key_secret loaded from env, never logged, never sent to client
 *  - Webhook signature verification uses RAZORPAY_WEBHOOK_SECRET
 *  - All errors are logged with sanitized messages (no key leakage)
 */

import Razorpay from 'razorpay'
import crypto from 'crypto'
import { CHECKOUT_CONFIG } from '@/types/checkout'
import type { Paise } from '@/types/menu'

// ============================================================================
// RAZORPAY CLIENT (lazy singleton)
// ============================================================================
let razorpayClient: Razorpay | null = null

function getRazorpay(): Razorpay {
  if (razorpayClient) return razorpayClient

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)')
  }

  razorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })
  return razorpayClient
}

function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

// ============================================================================
// TYPES
// ============================================================================
export interface CreateRazorpayOrderResult {
  success: boolean
  message: string
  data?: {
    razorpayOrderId: string
    amountPaise: Paise
    currency: string
  }
}

export interface VerifyPaymentResult {
  success: boolean
  message: string
  verified?: boolean
}

export interface VerifyWebhookResult {
  success: boolean
  message: string
  event?: unknown
}

// ============================================================================
// CREATE RAZORPAY ORDER
// ============================================================================
/**
 * Create a Razorpay Order for an internal dadan-handi order.
 *
 * Razorpay's flow:
 *  1. Server creates an "Order" with amount + currency
 *  2. Server returns the order_id to the client
 *  3. Client opens Razorpay Checkout with that order_id
 *  4. User pays; Razorpay ties the payment to the order
 *  5. Client receives payment_id + signature → server verifies
 *
 * Idempotency: Our DB enforces idempotency at the `orders` table level via a
 * unique constraint on `idempotency_key`. If the same key is submitted twice:
 *   - First call: creates draft order + calls Razorpay to create order
 *   - Second call: DB rejects duplicate → caller catches and returns existing order
 * So we don't need Razorpay-side idempotency (the SDK doesn't expose it cleanly
 * anyway). The DB-level guard is sufficient.
 *
 * Notes: stored in the Razorpay dashboard — searchable. We store our
 * internal order_id + order_number so we can cross-reference.
 */
export async function createRazorpayOrder(params: {
  orderId: string
  orderNumber: string
  userId: string
  amountPaise: Paise
  idempotencyKey: string
}): Promise<CreateRazorpayOrderResult> {
  const { orderId, orderNumber, userId, amountPaise, idempotencyKey } = params

  if (!isRazorpayConfigured()) {
    return {
      success: false,
      message: 'Payment system is not configured. Please contact support.',
    }
  }

  // Razorpay minimum amount for INR is 100 paise (₹1)
  if (amountPaise < 100) {
    return {
      success: false,
      message: 'Amount too small to process payment.',
    }
  }

  try {
    const razorpay = getRazorpay()

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: CHECKOUT_CONFIG.currency.toUpperCase(),  // 'INR' (Razorpay requires uppercase)
      receipt: orderNumber,  // shown in dashboard, max 40 chars
      payment_capture: true,  // auto-capture (no manual capture needed)
      notes: {
        internal_order_id: orderId,
        internal_order_number: orderNumber,
        user_id: userId,
        environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
      },
    })

    if (!order || !order.id) {
      return { success: false, message: 'Failed to create payment order.' }
    }

    return {
      success: true,
      message: 'Razorpay order created.',
      data: {
        razorpayOrderId: order.id,
        amountPaise: order.amount as Paise,
        currency: order.currency,
      },
    }
  } catch (err) {
    // Log sanitized error — never log the full Razorpay error (may contain key info)
    const rzpErr = err as { error?: { code?: string; description?: string; step?: string; reason?: string; metadata?: unknown } }
    console.error('[PAYMENT SERVICE] createRazorpayOrder error:', {
      code: rzpErr?.error?.code,
      description: rzpErr?.error?.description,
      step: rzpErr?.error?.step,
      reason: rzpErr?.error?.reason,
      orderId,
      orderNumber,
    })

    // Return generic error to client — never expose Razorpay internals
    const code = rzpErr?.error?.code
    if (code === 'BAD_REQUEST_ERROR') {
      return { success: false, message: 'Invalid payment request. Please try again.' }
    }
    if (code === 'RATE_LIMIT_ERROR') {
      return { success: false, message: 'Payment service is busy. Please try again in a moment.' }
    }
    if (code === 'SERVER_ERROR') {
      return { success: false, message: 'Payment service is temporarily unavailable. Please try again.' }
    }
    return { success: false, message: 'Failed to initiate payment. Please try again.' }
  }
}

// ============================================================================
// VERIFY PAYMENT SIGNATURE (the critical step — called from /api/checkout/verify-payment)
// ============================================================================
/**
 * Verify the signature returned by Razorpay Checkout after a successful
 * payment. This is the SECURITY ANCHOR of the entire flow:
 *
 *  - Client receives: razorpay_payment_id, razorpay_order_id, razorpay_signature
 *  - Server recomputes: HMAC_SHA256(razorpay_order_id + '|' + razorpay_payment_id, key_secret)
 *  - If recomputed == received signature → payment is genuine (not tampered)
 *
 * If verification passes:
 *  - The payment is REAL (Razorpay signed it with the key_secret)
 *  - The order_id matches our draft order
 *  - We can safely mark the order as 'confirmed'
 *
 * If verification fails:
 *  - Someone is trying to forge a payment
 *  - Or the data was tampered with in transit
 *  - We reject and mark the order as 'failed'
 *
 * NEVER skip this step. NEVER trust the client's claim that payment succeeded.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): VerifyPaymentResult {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params

  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) {
    console.error('[PAYMENT SERVICE] RAZORPAY_KEY_SECRET not configured')
    return { success: false, message: 'Payment system is not configured.' }
  }

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return { success: false, message: 'Missing payment verification data.' }
  }

  try {
    // Razorpay's expected signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    const a = Buffer.from(expectedSignature, 'hex')
    const b = Buffer.from(razorpaySignature, 'hex')

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('[PAYMENT SERVICE] Payment signature verification FAILED', {
        razorpayOrderId,
        razorpayPaymentId,
      })
      return {
        success: false,
        message: 'Payment verification failed. Please contact support.',
        verified: false,
      }
    }

    return {
      success: true,
      message: 'Payment verified.',
      verified: true,
    }
  } catch (err) {
    console.error('[PAYMENT SERVICE] verifyPaymentSignature error:', err)
    return { success: false, message: 'Payment verification failed.' }
  }
}

// ============================================================================
// RETRIEVE PAYMENT (for polling fallback / manual verification)
// ============================================================================
/**
 * Retrieve a Razorpay Payment by its ID. Used by polling endpoints to
 * check payment status if the client verification didn't fire (e.g.,
 * user closed browser after payment).
 */
export async function retrievePayment(
  razorpayPaymentId: string,
): Promise<{
  success: boolean
  message: string
  data?: {
    status: string
    amountPaise: Paise
    razorpayOrderId: string
    method: string | null
  }
}> {
  if (!isRazorpayConfigured()) {
    return { success: false, message: 'Payment system is not configured.' }
  }

  try {
    const razorpay = getRazorpay()
    const payment = await razorpay.payments.fetch(razorpayPaymentId)
    return {
      success: true,
      message: 'Payment retrieved.',
      data: {
        status: payment.status,
        amountPaise: payment.amount as Paise,
        razorpayOrderId: payment.order_id as string,
        method: payment.method,
      },
    }
  } catch (err) {
    const rzpErr = err as { error?: { code?: string; description?: string } }
    console.error('[PAYMENT SERVICE] retrievePayment error:', {
      code: rzpErr?.error?.code,
      description: rzpErr?.error?.description,
      razorpayPaymentId,
    })
    return { success: false, message: 'Failed to retrieve payment status.' }
  }
}

// ============================================================================
// VERIFY WEBHOOK SIGNATURE (for /api/razorpay/webhook route)
// ============================================================================
/**
 * Verify a Razorpay webhook signature.
 *
 * Razorpay sends:
 *  - Header: X-Razorpay-Signature (hex-encoded HMAC SHA256)
 *  - Body: raw JSON payload
 *
 * The signature is computed as: HMAC_SHA256(raw_body, RAZORPAY_WEBHOOK_SECRET)
 *
 * Returns the parsed payload if valid.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): VerifyWebhookResult {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[PAYMENT SERVICE] RAZORPAY_WEBHOOK_SECRET not configured')
    return { success: false, message: 'Webhook secret not configured.' }
  }

  if (!signature) {
    return { success: false, message: 'Missing X-Razorpay-Signature header.' }
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    const a = Buffer.from(expectedSignature, 'hex')
    const b = Buffer.from(signature, 'hex')

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.error('[PAYMENT SERVICE] Webhook signature verification failed')
      return { success: false, message: 'Invalid webhook signature.' }
    }

    const event = JSON.parse(rawBody)
    return { success: true, message: 'Signature verified.', event }
  } catch (err) {
    console.error('[PAYMENT SERVICE] verifyWebhookSignature error:', err)
    return { success: false, message: 'Webhook verification failed.' }
  }
}

// ============================================================================
// GET KEY_ID (for client-side Razorpay Checkout)
// ============================================================================
/**
 * Returns the Razorpay key_id for client-side use. This is SAFE to expose
 * to the client — it's the publishable key, similar to Stripe's pk_.
 *
 * The key_secret is NEVER exposed — it's used only server-side for
 * signature verification and API calls.
 */
export function getKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null
}
