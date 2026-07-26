/**
 * Payment Service (Stripe wrapper, server-side)
 * ---------------------------------------------
 * Wraps all Stripe API calls. NEVER expose the secret key to the client.
 *
 * Lifecycle:
 *  1. createPaymentIntent(amount, order) → returns { clientSecret, paymentIntentId }
 *     - Called from /api/checkout/create-order after draft order is created
 *     - Stores order_id + order_number in PaymentIntent metadata for webhook
 *     - Idempotent: passing the same idempotencyKey returns the same PI
 *  2. Stripe sends webhook → /api/stripe/webhook
 *     - Signature verified with STRIPE_WEBHOOK_SECRET
 *     - For payment_intent.succeeded → call mark_order_succeeded RPC
 *     - For payment_intent.payment_failed → call mark_order_failed RPC
 *
 * SECURITY:
 *  - Stripe secret key loaded from env, never logged, never sent to client
 *  - Webhook signature verification uses STRIPE_WEBHOOK_SECRET
 *  - All errors are logged with sanitized messages (no key leakage)
 */

import Stripe from 'stripe'
import { CHECKOUT_CONFIG } from '@/types/checkout'
import type { Paise } from '@/types/menu'

// ============================================================================
// STRIPE CLIENT (lazy singleton)
// ============================================================================
let stripeClient: Stripe | null = null

function getStripe(): Stripe {
  if (stripeClient) return stripeClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    typescript: true,
    maxNetworkRetries: 2,
  })
  return stripeClient
}

function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// ============================================================================
// TYPES
// ============================================================================
export interface CreatePaymentIntentResult {
  success: boolean
  message: string
  data?: {
    paymentIntentId: string
    clientSecret: string
    amountPaise: Paise
    currency: string
  }
}

export interface VerifyWebhookResult {
  success: boolean
  message: string
  event?: Stripe.Event
}

// ============================================================================
// CREATE PAYMENT INTENT
// ============================================================================
/**
 * Create a Stripe PaymentIntent for an order.
 *
 * Idempotency: Stripe supports idempotency keys on the request. We pass
 * the order's idempotency_key so that re-submits (refresh, double-click)
 * return the same PaymentIntent instead of creating a duplicate.
 *
 * Metadata: we store order_id and order_number so the webhook can find
 * the order without trusting the amount/client secret.
 *
 * Payment methods enabled: cards (credit/debit) + UPI (via Stripe India).
 * We don't restrict payment_method_types here — Stripe will use the
 * Payment Element on the client side to render available methods based
 * on the dashboard config.
 *
 * For India: UPI, cards, netbanking, wallets are all supported via the
 * Payment Element. The merchant must enable them in the Stripe dashboard.
 */
export async function createPaymentIntent(params: {
  orderId: string
  orderNumber: string
  userId: string
  amountPaise: Paise
  idempotencyKey: string
}): Promise<CreatePaymentIntentResult> {
  const { orderId, orderNumber, userId, amountPaise, idempotencyKey } = params

  if (!isStripeConfigured()) {
    return {
      success: false,
      message: 'Payment system is not configured. Please contact support.',
    }
  }

  if (amountPaise < 100) {
    // Stripe India minimum is ₹1 (100 paise) for INR
    return {
      success: false,
      message: 'Amount too small to process payment.',
    }
  }

  try {
    const stripe = getStripe()

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountPaise,
        currency: CHECKOUT_CONFIG.currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          order_id: orderId,
          order_number: orderNumber,
          user_id: userId,
          environment: process.env.NODE_ENV === 'production' ? 'prod' : 'dev',
        },
        // Statement descriptor suffix (appears on customer's bank statement)
        description: `Dadan Handi Mutton - Order ${orderNumber}`,
        statement_descriptor_suffix: orderNumber.slice(0, 22),  // max 22 chars
        // Capture immediately (no manual capture)
        capture_method: 'automatic',
      },
      {
        idempotencyKey: `pi-${idempotencyKey}`,
        maxNetworkRetries: 2,
      },
    )

    return {
      success: true,
      message: 'Payment intent created.',
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret as string,
        amountPaise: paymentIntent.amount as Paise,
        currency: paymentIntent.currency,
      },
    }
  } catch (err) {
    // Log sanitized error — never log the full Stripe error (may contain key info)
    const stripeErr = err as Stripe.errors.StripeError
    console.error('[PAYMENT SERVICE] createPaymentIntent error:', {
      type: stripeErr?.type,
      code: stripeErr?.code,
      message: stripeErr?.message,
      orderId,
      orderNumber,
    })

    // Return generic error to client — never expose Stripe internals
    if (stripeErr?.type === 'StripeAuthenticationError') {
      return { success: false, message: 'Payment authentication failed. Please contact support.' }
    }
    if (stripeErr?.type === 'StripeInvalidRequestError') {
      return { success: false, message: 'Invalid payment request. Please try again.' }
    }
    if (stripeErr?.type === 'StripeRateLimitError' || stripeErr?.type === 'StripeAPIError') {
      return { success: false, message: 'Payment service is busy. Please try again in a moment.' }
    }
    return { success: false, message: 'Failed to initiate payment. Please try again.' }
  }
}

// ============================================================================
// RETRIEVE PAYMENT INTENT
// ============================================================================
/**
 * Retrieve a PaymentIntent from Stripe by ID. Used by polling endpoints
 * to check payment status if webhook is delayed.
 */
export async function retrievePaymentIntent(paymentIntentId: string): Promise<{
  success: boolean
  message: string
  data?: {
    status: string
    amountPaise: Paise
    chargeId: string | null
  }
}> {
  if (!isStripeConfigured()) {
    return { success: false, message: 'Payment system is not configured.' }
  }

  try {
    const stripe = getStripe()
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    return {
      success: true,
      message: 'Payment intent retrieved.',
      data: {
        status: pi.status,
        amountPaise: pi.amount as Paise,
        chargeId: pi.latest_charge as string | null,
      },
    }
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError
    console.error('[PAYMENT SERVICE] retrievePaymentIntent error:', {
      type: stripeErr?.type,
      code: stripeErr?.code,
      paymentIntentId,
    })
    return { success: false, message: 'Failed to retrieve payment status.' }
  }
}

// ============================================================================
// VERIFY WEBHOOK SIGNATURE
// ============================================================================
/**
 * Verify the Stripe webhook signature. Returns the parsed event if valid.
 *
 * Stripe sends three headers:
 *  - stripe-signature: the signature to verify against
 *
 * The raw body MUST be the unparsed request body (as a string or Buffer).
 * Next.js Route Handlers receive the body via request.text() — DO NOT
 * parse it as JSON first, or the signature will fail.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): VerifyWebhookResult {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[PAYMENT SERVICE] STRIPE_WEBHOOK_SECRET not configured')
    return { success: false, message: 'Webhook secret not configured.' }
  }

  if (!signature) {
    return { success: false, message: 'Missing stripe-signature header.' }
  }

  try {
    const stripe = getStripe()
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    return { success: true, message: 'Signature verified.', event }
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError
    console.error('[PAYMENT SERVICE] Webhook signature verification failed:', {
      type: stripeErr?.type,
      message: stripeErr?.message,
    })
    return { success: false, message: 'Invalid webhook signature.' }
  }
}

// ============================================================================
// GET PUBLISHABLE KEY (for client-side Stripe.js)
// ============================================================================
/**
 * Returns the Stripe publishable key for client-side use. This is safe to
 * expose to the client (it's the public key, not the secret).
 */
export function getPublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
}
