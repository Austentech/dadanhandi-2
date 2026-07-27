/**
 * Type declarations for Razorpay Checkout.js
 * ------------------------------------------
 * Razorpay's standard checkout is loaded via a <script> tag from
 * https://checkout.razorpay.com/v1/checkout.js — it exposes a global
 * `Razorpay` constructor on `window`. These types let us use it
 * type-safely from React/TypeScript.
 *
 * The official `razorpay` npm package is for the SERVER-side API only
 * (creating orders, capturing payments, verifying signatures). For the
 * client-side checkout, we use the global script + these types.
 */

interface RazorpayPaymentFailureError {
  code: string
  description: string
  field?: string
  metadata?: Record<string, unknown>
  reason?: string
  step?: string
  source: string
}

interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayCheckoutOptions {
  /** Razorpay key_id (publishable, safe to expose to client) */
  key: string
  /** The order_id returned by Razorpay Orders API (server-created) */
  order_id: string
  /** Display name shown in checkout modal */
  name: string
  /** Short description of the purchase */
  description?: string
  /** URL or data-URI of your logo (max 200x200px) */
  image?: string
  /** Amount in PAISE (e.g., 50000 = ₹500). Required when no order_id. */
  amount?: number
  /** Currency code (default 'INR') */
  currency?: string
  /** Pre-filled customer email */
  email?: string
  /** Pre-filled customer contact (phone) */
  contact?: string
  /** Notes object — appears in dashboard, can be filtered/searched */
  notes?: Record<string, string>
  /** Theme color (hex without #) e.g. '7A0C0C' */
  theme?: {
    color: string
    hide_topbar?: boolean
    backdrop_color?: string
  }
  /** Modal configuration */
  modal?: {
    ondismiss?: () => void
    confirm_close?: boolean
    escape?: boolean
    animation?: boolean
    backdropclose?: boolean
  }
  /** Configure which payment methods are shown */
  config?: {
    display?: {
      blocks?: Record<string, unknown>
      sequence?: string[]
      preferences?: {
        show_default_blocks?: boolean
      }
    }
  }
  /** Allowed payment methods — undefined means all enabled in dashboard */
  method?: {
    card?: boolean
    netbanking?: boolean
    wallet?: boolean
    upi?: boolean
    paylater?: boolean
  }
  /** Subscription-related — leave undefined for one-time payments */
  recurring?: boolean
  /** Callback when payment succeeds */
  handler: (response: RazorpayHandlerResponse) => void
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayInstance
}

interface RazorpayInstance {
  /** Opens the checkout modal */
  open(): void
  /** Closes the checkout modal programmatically */
  close(): void
  /** Registers an event handler */
  on(event: 'payment.failed', handler: (resp: { error: RazorpayPaymentFailureError }) => void): void
  on(event: 'payment.success', handler: (resp: RazorpayHandlerResponse) => void): void
  on(event: 'payment.dismiss', handler: () => void): void
  on(event: string, handler: (resp: unknown) => void): void
}

interface Window {
  Razorpay?: RazorpayConstructor
}
