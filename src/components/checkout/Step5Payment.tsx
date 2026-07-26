/**
 * Step 5 — Payment (Stripe Elements)
 * ----------------------------------
 * Mounts the Stripe Payment Element using the client_secret from the
 * created PaymentIntent. Supports UPI, credit cards, and debit cards
 * (via Stripe India — payment methods enabled in the Stripe dashboard).
 *
 * FLOW:
 *  1. On mount: calls createOrder() to create a draft order + PaymentIntent
 *  2. Stores the client_secret + order_id in the checkout store
 *  3. Loads Stripe.js with the publishable key
 *  4. Mounts <Elements> with the client_secret
 *  5. Renders <PaymentElement /> inside the Elements provider
 *  6. User enters payment details and clicks "Pay"
 *  7. Calls stripe.confirmPayment({ elements, redirect: 'if_required' })
 *  8. If success: navigate to confirmation page (webhook will fire async)
 *  9. If failure: show error, allow retry (cart + order preserved)
 *
 * IDEMPOTENCY:
 *  - The store generates a single idempotency_key per checkout attempt
 *  - If the user clicks "Pay" twice, the second call is ignored
 *  - If Stripe returns requires_action (3DS), we let Stripe handle it
 *  - The webhook is the SOURCE OF TRUTH for payment status — the client
 *    confirmation just tells us "the form was submitted successfully"
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useCheckoutStore } from '@/store/checkout-store'
import { formatPrice } from '@/lib/pricing'

interface Step5PaymentProps {
  onBack: () => void
  onSuccess: (orderId: string) => void
  onFailure: (reason: string) => void
}

// ============================================================================
// STRIPE APPEARANCE — match the Dadan Handi brand
// ============================================================================
const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#7A0C0C',
    colorBackground: '#FFFFFF',
    colorText: '#2C1008',
    colorDanger: '#C46A2E',
    colorTextPlaceholder: '#7A5030',
    fontFamily: 'Nunito, system-ui, sans-serif',
    borderRadius: '8px',
    spacingUnit: '6px',
  },
  rules: {
    '.Tab': {
      borderColor: '#E8C98A',
      backgroundColor: '#FFF8EE',
    },
    '.Tab--selected': {
      borderColor: '#7A0C0C',
      backgroundColor: '#FFFFFF',
    },
    '.Tab:hover': {
      borderColor: '#C46A2E',
    },
    '.Input': {
      borderColor: '#E8C98A',
    },
    '.Input:focus': {
      borderColor: '#7A0C0C',
      boxShadow: '0 0 0 3px rgba(122, 12, 12, 0.12)',
    },
  },
}

// ============================================================================
// PAYMENT FORM (inside Elements provider)
// ============================================================================
function PaymentForm({
  amountPaise,
  onSuccess,
  onFailure,
}: {
  amountPaise: number
  onSuccess: () => void
  onFailure: (reason: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setErrorMessage('Payment system is still loading. Please wait a moment.')
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      // Trigger form validation and submission
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',  // Stay on-page; handle next steps ourselves
      })

      if (error) {
        // Stripe returned an error (card declined, invalid input, etc.)
        // Show the error message to the user. Cart + order are preserved.
        const msg = error.message || 'Payment failed. Please try again.'
        setErrorMessage(msg)
        onFailure(msg)
        setIsProcessing(false)
        return
      }

      // No error — payment intent should be in 'succeeded' or 'processing' state.
      // The webhook is the source of truth — we don't confirm the order here.
      // We just navigate to the confirmation page, which polls for status.
      onSuccess()
    } catch (err) {
      const msg = 'Unexpected error during payment. Please try again.'
      console.error('[STRIPE PAYMENT] confirmPayment error:', err)
      setErrorMessage(msg)
      onFailure(msg)
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="payment-section">
      <div className="payment-elements-wrapper">
        <PaymentElement
          options={{
            layout: {
              type: 'tabs',
              defaultCollapsed: false,
            },
          }}
        />
      </div>

      {errorMessage && (
        <div className="payment-error-banner" role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="payment-security-note">
        <i className="fas fa-lock" aria-hidden="true"></i>
        <span>
          Your payment is secured by Stripe. We never see or store your card details.
          UPI, credit & debit cards accepted.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Amount to pay</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--dark-red)' }}>
            {formatPrice(amountPaise)}
          </div>
        </div>
        <button
          type="submit"
          className="checkout-btn checkout-btn-primary"
          disabled={!stripe || isProcessing}
          style={{ minWidth: 180, justifyContent: 'center' }}
        >
          {isProcessing ? (
            <>
              <span className="payment-loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true"></span>
              Processing…
            </>
          ) : (
            <>
              <i className="fas fa-lock" aria-hidden="true"></i>
              Pay {formatPrice(amountPaise)}
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ============================================================================
// MAIN STEP 5 COMPONENT
// ============================================================================
export default function Step5Payment({ onBack, onSuccess, onFailure }: Step5PaymentProps) {
  const {
    stripePublishableKey,
    fetchConfig,
    createOrder,
    isCreatingOrder,
    orderId,
    orderNumber,
    clientSecret,
    validatedFinalAmountPaise,
    error,
  } = useCheckoutStore()

  const [stripe, setStripe] = useState<StripeJS | null>(null)
  const createOrderCalledRef = useRef(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Fetch config (publishable key) on mount
  useEffect(() => {
    if (!stripePublishableKey) {
      fetchConfig()
    }
  }, [stripePublishableKey, fetchConfig])

  // Load Stripe.js once we have the publishable key
  useEffect(() => {
    if (!stripePublishableKey) return
    let cancelled = false
    loadStripe(stripePublishableKey).then((s) => {
      if (!cancelled) setStripe(s)
    })
    return () => {
      cancelled = true
    }
  }, [stripePublishableKey])

  // Create the draft order + PaymentIntent on mount (once).
  // Uses a ref guard to prevent duplicate calls in StrictMode / re-renders.
  useEffect(() => {
    if (createOrderCalledRef.current) return
    createOrderCalledRef.current = true
    let cancelled = false
    ;(async () => {
      const result = await createOrder()
      if (cancelled) return
      if (!result.success) {
        setLocalError(result.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [createOrder])

  const handleSuccess = useCallback(() => {
    if (orderId) {
      onSuccess(orderId)
    }
  }, [orderId, onSuccess])

  const handleFailure = useCallback(
    (reason: string) => {
      onFailure(reason)
    },
    [onFailure],
  )

  const amountPaise = validatedFinalAmountPaise ?? 0

  // Render states:
  // 1. Creating order → loading
  // 2. Order created, no clientSecret yet → loading
  // 3. Order created + clientSecret + Stripe loaded → render form
  // 4. Error → error banner with retry option

  const isInitializing = isCreatingOrder || (!clientSecret && !localError && !error)
  const canRenderForm = !!clientSecret && !!stripe && amountPaise > 0

  // Memoize options to prevent re-renders
  const elementOptions = useMemo(
    () => ({
      clientSecret: clientSecret!,
      appearance: stripeAppearance,
    }),
    [clientSecret],
  )

  return (
    <div className="checkout-step">
      <h2 className="checkout-step-title">Payment</h2>
      <p className="checkout-step-subtitle">
        {orderNumber ? (
          <>Order <strong style={{ color: 'var(--dark-red)' }}>{orderNumber}</strong> · Pay securely via UPI, credit or debit card.</>
        ) : (
          'Pay securely via UPI, credit or debit card.'
        )}
      </p>

      {(localError || error) && !isCreatingOrder && (
        <div className="payment-error-banner" role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <span>{localError || error}</span>
        </div>
      )}

      {isInitializing && (
        <div className="payment-loading">
          <div className="payment-loading-spinner" aria-hidden="true"></div>
          <p>Preparing your secure payment…</p>
        </div>
      )}

      {canRenderForm && (
        <Elements stripe={stripe} options={elementOptions}>
          <PaymentForm
            amountPaise={amountPaise}
            onSuccess={handleSuccess}
            onFailure={handleFailure}
          />
        </Elements>
      )}

      <div className="checkout-nav-buttons" style={{ marginTop: 24 }}>
        <button
          type="button"
          className="checkout-btn checkout-btn-secondary"
          onClick={onBack}
          disabled={isCreatingOrder}
        >
          <i className="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
      </div>
    </div>
  )
}
