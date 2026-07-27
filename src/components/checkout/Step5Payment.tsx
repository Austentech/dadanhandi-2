/**
 * Step 5 — Payment (Razorpay Checkout)
 * ------------------------------------
 * Loads Razorpay's Checkout.js script and opens the payment modal when
 * the user clicks "Pay". Supports UPI, credit/debit cards, netbanking,
 * and wallets (whichever methods are enabled in the Razorpay dashboard).
 *
 * FLOW:
 *  1. On mount: calls createOrder() to create a draft order + Razorpay Order
 *  2. Stores razorpay_order_id + order_id in the checkout store
 *  3. Loads Razorpay Checkout.js (https://checkout.razorpay.com/v1/checkout.js)
 *  4. User clicks "Pay ₹X" → opens Razorpay modal
 *  5. User pays via UPI/card/netbanking
 *  6. Razorpay returns { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *  7. Client calls verifyPayment() → /api/checkout/verify-payment
 *  8. Server verifies signature → marks order as 'confirmed' → awards points → clears cart
 *  9. On success: navigate to confirmation page
 * 10. On failure: show error, allow retry (cart + order preserved)
 *
 * RAZORPAY ADVANTAGES OVER STRIPE:
 *  - No webhook REQUIRED for the happy path (signature verification is enough)
 *  - UPI is native and well-supported in India
 *  - Modal-based checkout is faster than embedded form (no client_secret)
 *  - Indian business onboarding is instant (no invite-only restrictions)
 *
 * IDEMPOTENCY:
 *  - The store generates a single idempotency_key per checkout attempt
 *  - If the user clicks "Pay" twice, the second click is ignored
 *  - The server's create-order endpoint is idempotent via the idempotency_key
 *  - The verify-payment endpoint is idempotent via the mark_order_succeeded RPC
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useCheckoutStore } from '@/store/checkout-store'
import { useToastStore } from '@/store/toast-store'
import { useAuth } from '@/hooks/use-auth'
import { formatPrice } from '@/lib/pricing'

interface Step5PaymentProps {
  onBack: () => void
  onSuccess: (orderId: string) => void
  onFailure: (reason: string) => void
}

// ============================================================================
// RAZORPAY CHECKOUT SCRIPT LOADER
// ============================================================================
const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // Already loaded?
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true)
      return
    }

    // Already in progress?
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_URL
    script.async = true
    script.onload = () => resolve(!!window.Razorpay)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

// ============================================================================
// MAIN STEP 5 COMPONENT
// ============================================================================
export default function Step5Payment({ onBack, onSuccess, onFailure }: Step5PaymentProps) {
  const {
    razorpayKeyId,
    fetchConfig,
    createOrder,
    verifyPayment,
    isCreatingOrder,
    isVerifyingPayment,
    orderId,
    orderNumber,
    razorpayOrderId,
    validatedFinalAmountPaise,
    error,
  } = useCheckoutStore()
  const { pushToast } = useToastStore()
  const { user, profile } = useAuth()

  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const createOrderCalledRef = useRef(false)
  const razorpayInstanceRef = useRef<RazorpayInstance | null>(null)

  // Fetch config (Razorpay key_id) on mount
  useEffect(() => {
    if (!razorpayKeyId) {
      fetchConfig()
    }
  }, [razorpayKeyId, fetchConfig])

  // Load Razorpay Checkout.js script
  useEffect(() => {
    if (!razorpayKeyId) return
    let cancelled = false
    loadRazorpayScript().then((ok) => {
      if (!cancelled) setScriptLoaded(ok)
    })
    return () => {
      cancelled = true
    }
  }, [razorpayKeyId])

  // Create the draft order + Razorpay Order on mount (once).
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

  // Cleanup: destroy Razorpay instance on unmount
  useEffect(() => {
    return () => {
      if (razorpayInstanceRef.current) {
        try {
          razorpayInstanceRef.current.close()
        } catch {
          // ignore
        }
        razorpayInstanceRef.current = null
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // OPEN RAZORPAY CHECKOUT MODAL
  // ---------------------------------------------------------------------------
  const handlePay = useCallback(() => {
    if (!razorpayKeyId) {
      const msg = 'Payment isn’t set up yet. Try again later.'
      setLocalError(msg)
      onFailure(msg)
      return
    }

    if (!scriptLoaded || typeof window === 'undefined' || !window.Razorpay) {
      const msg = 'Still loading… give it a second.'
      setLocalError(msg)
      return
    }

    if (!razorpayOrderId || !orderId) {
      const msg = 'Getting your order ready…'
      setLocalError(msg)
      return
    }

    const amountPaise = validatedFinalAmountPaise ?? 0
    if (amountPaise <= 0) {
      const msg = 'Something’s off with the amount.'
      setLocalError(msg)
      return
    }

    setLocalError(null)
    setIsPaymentModalOpen(true)

    // Pre-fill user info from auth state
    const prefillEmail = user?.email || ''
    const prefillContact = profile?.mobile_number || profile?.whatsapp_number || user?.phone || ''
    const prefillName = profile?.full_name || (user?.user_metadata?.full_name as string) || ''

    // Create the Razorpay instance
    const rzp = new window.Razorpay({
      key: razorpayKeyId,
      order_id: razorpayOrderId,
      name: 'Dadan Handi Mutton Hotel',
      description: orderNumber ? `Order ${orderNumber}` : 'Food order payment',
      image: '/images/brand-logo.png',
      amount: amountPaise,
      currency: 'INR',
      // Razorpay accepts these top-level fields for prefill
      email: prefillEmail,
      contact: prefillContact,
      notes: {
        internal_order_id: orderId,
        internal_order_number: orderNumber || '',
        customer_name: prefillName,
      },
      theme: {
        color: '#7A0C0C',
      },
      modal: {
        ondismiss: () => {
          setIsPaymentModalOpen(false)
          // User closed the modal without paying — don't fail, just stay on step 5
          // so they can retry with the same order
          pushToast({
            type: 'info',
            title: 'Payment cancelled',
            message: 'You can retry payment by clicking Pay again.',
            durationMs: 5000,
          })
        },
      },
      handler: async (response) => {
        // Razorpay returned: razorpay_payment_id, razorpay_order_id, razorpay_signature
        setIsPaymentModalOpen(false)

        try {
          const verifyResult = await verifyPayment({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          })

          if (verifyResult.success) {
            pushToast({
              type: 'success',
              title: 'Payment Successful!',
              message: 'Your order has been confirmed.',
              durationMs: 4000,
            })
            onSuccess(orderId)
          } else {
            // Verification failed — signature mismatch or server error
            const msg = verifyResult.message || 'Payment verification failed.'
            setLocalError(msg)
            onFailure(msg)
          }
        } catch (err) {
          console.error('[RAZORPAY] verifyPayment error:', err)
          const msg = 'Couldn’t verify your payment. Don’t worry — your money is safe.'
          setLocalError(msg)
          onFailure(msg)
        }
      },
    })

    // Register failure handler
    rzp.on('payment.failed', (resp) => {
      setIsPaymentModalOpen(false)
      const errorMsg = resp.error?.description || 'Payment failed. Please try again.'
      setLocalError(errorMsg)
      onFailure(errorMsg)
      pushToast({
        type: 'error',
        title: 'Payment Failed',
        message: errorMsg,
        durationMs: 6000,
      })
    })

    razorpayInstanceRef.current = rzp

    // Open the modal
    rzp.open()
  }, [
    razorpayKeyId,
    scriptLoaded,
    razorpayOrderId,
    orderId,
    orderNumber,
    validatedFinalAmountPaise,
    verifyPayment,
    onSuccess,
    onFailure,
    pushToast,
    user,
    profile,
  ])

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  const amountPaise = validatedFinalAmountPaise ?? 0

  const isInitializing = isCreatingOrder || (!razorpayOrderId && !localError && !error)
  const canShowPayButton = !!razorpayOrderId && !!scriptLoaded && !!razorpayKeyId && amountPaise > 0

  return (
    <div className="checkout-step">
      <h2 className="checkout-step-title">Payment</h2>
      <p className="checkout-step-subtitle">
        {orderNumber ? (
          <>Order <strong style={{ color: 'var(--dark-red)' }}>{orderNumber}</strong> · Pay via UPI, card or netbanking.</>
        ) : (
          'Pay via UPI, card or netbanking.'
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
          <p>Setting up your payment…</p>
        </div>
      )}

      {canShowPayButton && (
        <div className="razorpay-payment-section">
          {/* Payment method preview cards (informational) */}
          <div className="razorpay-methods-preview">
            <div className="razorpay-method-card">
              <div className="razorpay-method-icon" style={{ background: '#09B5A6' }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>UPI</span>
              </div>
              <span>PhonePe · GPay · Paytm · BHIM</span>
            </div>
            <div className="razorpay-method-card">
              <div className="razorpay-method-icon" style={{ background: '#7A0C0C' }}>
                <i className="fas fa-credit-card" style={{ color: 'white' }} aria-hidden="true"></i>
              </div>
              <span>Credit / Debit Card</span>
            </div>
            <div className="razorpay-method-card">
              <div className="razorpay-method-icon" style={{ background: '#C46A2E' }}>
                <i className="fas fa-university" style={{ color: 'white' }} aria-hidden="true"></i>
              </div>
              <span>Netbanking · Wallets</span>
            </div>
          </div>

          <div className="payment-security-note">
            <i className="fas fa-lock" aria-hidden="true"></i>
            <span>
              Payments are handled by Razorpay. Your card details stay with them — we never see them.
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
              type="button"
              className="checkout-btn checkout-btn-primary"
              onClick={handlePay}
              disabled={isPaymentModalOpen || isVerifyingPayment}
              style={{ minWidth: 180, justifyContent: 'center' }}
            >
              {isPaymentModalOpen || isVerifyingPayment ? (
                <>
                  <span className="payment-loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true"></span>
                  {isVerifyingPayment ? 'Verifying…' : 'Processing…'}
                </>
              ) : (
                <>
                  <i className="fas fa-lock" aria-hidden="true"></i>
                  Pay {formatPrice(amountPaise)}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="checkout-nav-buttons" style={{ marginTop: 24 }}>
        <button
          type="button"
          className="checkout-btn checkout-btn-secondary"
          onClick={onBack}
          disabled={isCreatingOrder || isVerifyingPayment}
        >
          <i className="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
      </div>
    </div>
  )
}
