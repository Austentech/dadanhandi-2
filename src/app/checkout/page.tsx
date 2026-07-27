/**
 * Checkout Page
 * -------------
 * Multi-step checkout flow:
 *   Step 1: Review Plate
 *   Step 2: Select Pickup Branch
 *   Step 3: Select Pickup Time
 *   Step 4: Donation & Rewards
 *   Step 5: Payment (Razorpay Checkout)
 *   Step 6: Confirmation
 *
 * AUTH GATE:
 *  - If user is not logged in, show a friendly "please log in" screen
 *    with a button that opens the auth modal (instead of a hard redirect).
 *
 * STEP NAVIGATION:
 *  - User can navigate forward only after the current step validates.
 *  - User can always go back to a previous step (state is preserved).
 *  - On step 5 → 6 transition: cart is cleared on success by the webhook.
 *    The checkout store is reset on success.
 *  - On step 5 failure: cart + order preserved, user can retry payment.
 */

'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useCheckoutStore } from '@/store/checkout-store'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import CheckoutProgress from '@/components/checkout/CheckoutProgress'
import Step1ReviewPlate from '@/components/checkout/Step1ReviewPlate'
import Step2SelectBranch from '@/components/checkout/Step2SelectBranch'
import Step3PickupTime from '@/components/checkout/Step3PickupTime'
import Step4DonationRewards from '@/components/checkout/Step4DonationRewards'
import Step5Payment from '@/components/checkout/Step5Payment'
import Step6Confirmation from '@/components/checkout/Step6Confirmation'

export default function CheckoutPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { initFromServer, isInitialized } = useCartStore()
  const {
    currentStep,
    setStep,
    nextStep,
    prevStep,
    reset: resetCheckout,
    fetchCart,
    cancelOrder,
    orderId,
  } = useCheckoutStore()
  const { pushToast } = useToastStore()

  // Derive "auth gate has been checked" from isAuthLoading — no need for
  // separate state. When isAuthLoading is false, we've checked auth.
  const authGateChecked = !isAuthLoading

  // ------------------------------------------------------------------------
  // INIT: load cart + ensure auth
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (isAuthLoading) return

    if (isAuthenticated) {
      // Initialize cart if not already done
      if (!isInitialized) {
        initFromServer()
      }
      // Refresh cart from server (in case user navigated here directly)
      fetchCart()
    }
  }, [isAuthLoading, isAuthenticated, isInitialized, initFromServer, fetchCart])

  // ------------------------------------------------------------------------
  // CLEANUP on unmount: if user abandons checkout at payment step
  // (order created but not confirmed), cancel the draft order so reward
  // points are restored.
  // ------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      // Only cancel if we have an order ID and we're not on the confirmation step
      // (i.e., user navigated away before completion)
      if (orderId && currentStep < 6) {
        // Best-effort cancel — fire and forget
        cancelOrder(orderId).catch(() => {})
      }
    }
  }, [])

  // ------------------------------------------------------------------------
  // HANDLERS
  // ------------------------------------------------------------------------
  const handleBackToMenu = useCallback(() => {
    router.push('/menu')
  }, [router])

  const handlePaymentSuccess = useCallback(
    (completedOrderId: string) => {
      // Payment was submitted successfully — go to confirmation to wait for webhook
      setStep(6)
      // Note: cart will be cleared by the webhook (server-side).
      // We don't clear client cart here — the confirmation page polls
      // and on 'confirmed' status, the user sees the success view.
      void completedOrderId
    },
    [setStep],
  )

  const handlePaymentFailure = useCallback(
    (reason: string) => {
      pushToast({
        type: 'error',
        title: 'Payment Failed',
        message: reason || 'Your payment could not be processed. Please try again.',
        durationMs: 6000,
      })
      // Stay on step 5 so user can retry with the same order
      // (Razorpay Checkout will re-open; the order is preserved)
    },
    [pushToast],
  )

  const handleRetry = useCallback(() => {
    // Cancel current draft order + reset to step 4 so user can re-validate
    if (orderId) {
      cancelOrder(orderId).catch(() => {})
    }
    resetCheckout()
    // After reset, user needs to go through validation again
    setStep(4)
  }, [orderId, cancelOrder, resetCheckout, setStep])

  const handleSuccessComplete = useCallback(() => {
    // User clicked "Order More" or similar after success
    resetCheckout()
    router.push('/menu')
  }, [resetCheckout, router])

  // ------------------------------------------------------------------------
  // AUTH GATE
  // ------------------------------------------------------------------------
  if (!authGateChecked || isAuthLoading) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <div className="payment-loading" style={{ minHeight: '50vh' }}>
            <div className="payment-loading-spinner" aria-hidden="true"></div>
            <p>Loading checkout…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <div className="checkout-step">
            <div className="checkout-auth-required">
              <div className="checkout-auth-required-icon">
                <i className="fas fa-lock" aria-hidden="true"></i>
              </div>
              <h2>Please Log In to Continue</h2>
              <p>
                You need to be logged in to complete checkout. This helps us secure your
                order and award you reward points.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/menu" className="checkout-btn checkout-btn-secondary">
                  <i className="fas fa-arrow-left" aria-hidden="true"></i>
                  Back to Menu
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------------
  // RENDER CURRENT STEP
  // ------------------------------------------------------------------------
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1ReviewPlate onBackToMenu={handleBackToMenu} onNext={nextStep} />
      case 2:
        return <Step2SelectBranch onBack={prevStep} onNext={nextStep} />
      case 3:
        return <Step3PickupTime onBack={prevStep} onNext={nextStep} />
      case 4:
        return <Step4DonationRewards onBack={prevStep} onNext={nextStep} />
      case 5:
        return (
          <Step5Payment
            onBack={prevStep}
            onSuccess={handlePaymentSuccess}
            onFailure={handlePaymentFailure}
          />
        )
      case 6:
        if (!orderId) {
          // Shouldn't happen, but recover gracefully
          return (
            <div className="checkout-step">
              <div className="confirmation-page">
                <div className="confirmation-icon pending">
                  <i className="fas fa-exclamation-circle"></i>
                </div>
                <h2 className="confirmation-title">Order Not Found</h2>
                <p className="confirmation-subtitle">
                  We couldn&apos;t find your order. Please try checkout again.
                </p>
                <button type="button" className="checkout-btn checkout-btn-primary" onClick={handleBackToMenu}>
                  Back to Menu
                </button>
              </div>
            </div>
          )
        }
        return (
          <Step6Confirmation
            orderId={orderId}
            onRetry={handleRetry}
            onBackToMenu={handleSuccessComplete}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <header className="checkout-header">
          <h1>Checkout</h1>
          <p>Complete your order in a few simple steps</p>
        </header>

        {currentStep < 6 && <CheckoutProgress currentStep={currentStep} />}

        {renderStep()}
      </div>
    </div>
  )
}
