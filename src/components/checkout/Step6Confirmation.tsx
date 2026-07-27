/**
 * Step 6 — Confirmation
 * ---------------------
 * Polls /api/checkout/order/[id] to check payment status.
 *
 * States:
 *  - pending: Payment submitted, waiting for webhook to fire
 *  - confirmed: Payment succeeded → show success page with order details
 *  - failed: Payment failed → show failure page with retry option
 *
 * The webhook is the source of truth for payment status. We poll the order
 * endpoint every 2 seconds until we get a terminal state (or timeout).
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCheckoutStore } from '@/store/checkout-store'
import { formatPrice, formatWeightLabel } from '@/lib/pricing'
import type { OrderWithDetails } from '@/types/checkout'

interface Step6ConfirmationProps {
  orderId: string
  onRetry: () => void
  onBackToMenu: () => void
}

type PollState = 'pending' | 'confirmed' | 'failed' | 'timeout'

const POLL_INTERVAL_MS = 2000
const MAX_POLL_DURATION_MS = 60 * 1000  // 60 seconds max

export default function Step6Confirmation({ orderId, onRetry, onBackToMenu }: Step6ConfirmationProps) {
  const { pollOrderStatus, isPollingOrder, orderNumber } = useCheckoutStore()
  const [pollState, setPollState] = useState<PollState>('pending')
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/order/${orderId}`)
      const data = await res.json()
      if (data.success && data.data?.order) {
        setOrder(data.data.order)
        return data.data.order
      }
      return null
    } catch {
      return null
    }
  }, [orderId])

  useEffect(() => {
    let cancelled = false
    const startTime = Date.now()

    const poll = async () => {
      if (cancelled) return

      const orderData = await fetchOrder()
      if (!orderData || cancelled) return

      if (orderData.orderStatus === 'confirmed') {
        setPollState('confirmed')
        return
      }
      if (orderData.orderStatus === 'failed') {
        setPollState('failed')
        return
      }

      // Check timeout
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        setPollState('timeout')
        return
      }

      // Schedule next poll
      setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()

    return () => {
      cancelled = true
    }
  }, [fetchOrder])

  // ---- SUCCESS STATE ----
  if (pollState === 'confirmed' && order) {
    return (
      <OrderConfirmationView
        order={order}
        onBackToMenu={onBackToMenu}
      />
    )
  }

  // ---- FAILURE STATE ----
  if (pollState === 'failed') {
    return (
      <div className="checkout-step">
        <div className="confirmation-page">
          <div className="confirmation-icon failure" aria-hidden="true">
            <i className="fas fa-times-circle"></i>
          </div>
          <h2 className="confirmation-title">Payment Failed</h2>
          <p className="confirmation-subtitle">
            Unfortunately, your payment could not be processed. Your cart and reward points
            have been restored — please try again.
          </p>

          {order && (
            <div className="confirmation-order-card">
              <div className="confirmation-order-number">{order.orderNumber}</div>
              <div className="confirmation-order-label">Order Number</div>
              <div className="confirmation-detail-grid" style={{ marginTop: 16 }}>
                <div className="confirmation-detail-item">
                  <span className="confirmation-detail-label">Payment Status</span>
                  <span className="confirmation-detail-value" style={{ color: 'var(--clay-orange)' }}>Failed</span>
                </div>
                <div className="confirmation-detail-item">
                  <span className="confirmation-detail-label">Order Status</span>
                  <span className="confirmation-detail-value">Cancelled</span>
                </div>
              </div>
            </div>
          )}

          <div className="confirmation-actions">
            <button type="button" className="checkout-btn checkout-btn-primary" onClick={onRetry}>
              <i className="fas fa-redo" aria-hidden="true"></i>
              Try Again
            </button>
            <button type="button" className="checkout-btn checkout-btn-secondary" onClick={onBackToMenu}>
              <i className="fas fa-utensils" aria-hidden="true"></i>
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- TIMEOUT STATE ----
  if (pollState === 'timeout') {
    return (
      <div className="checkout-step">
        <div className="confirmation-page">
          <div className="confirmation-icon pending" aria-hidden="true">
            <i className="fas fa-hourglass-half"></i>
          </div>
          <h2 className="confirmation-title">Payment Verification in Progress</h2>
          <p className="confirmation-subtitle">
            Your payment has been submitted and we&apos;re waiting for confirmation from our payment partner.
            This usually takes a few seconds.
          </p>
          <div className="confirmation-note">
            <strong>Note:</strong> If you completed the payment successfully, your order will be confirmed
            shortly. Please check your order history in your account, or contact us with order number
            {' '}<strong>{orderNumber}</strong> if you don&apos;t see it confirmed within 10 minutes.
          </div>
          <div className="confirmation-actions">
            <button type="button" className="checkout-btn checkout-btn-primary" onClick={() => window.location.reload()}>
              <i className="fas fa-sync" aria-hidden="true"></i>
              Refresh Status
            </button>
            <button type="button" className="checkout-btn checkout-btn-secondary" onClick={onBackToMenu}>
              <i className="fas fa-home" aria-hidden="true"></i>
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- PENDING STATE (default — payment submitted, awaiting webhook) ----
  return (
    <div className="checkout-step">
      <div className="confirmation-page">
        <div className="payment-loading-spinner" style={{ margin: '0 auto 18px', width: 56, height: 56, borderWidth: 4 }} aria-hidden="true"></div>
        <h2 className="confirmation-title">Confirming Your Payment…</h2>
        <p className="confirmation-subtitle">
          We&apos;re securely verifying your payment with our payment partner. Please don&apos;t close
          or refresh this page.
        </p>
        {orderNumber && (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Order reference: <strong style={{ color: 'var(--dark-red)' }}>{orderNumber}</strong>
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// ORDER CONFIRMATION VIEW (success state)
// ============================================================================
function OrderConfirmationView({
  order,
  onBackToMenu,
}: {
  order: OrderWithDetails
  onBackToMenu: () => void
}) {
  const pickupDateDisplay = new Date(order.pickupDate).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const slotStart12h = formatTime12h(order.pickupSlotStart)
  const slotEnd12h = formatTime12h(order.pickupSlotEnd)

  return (
    <div className="checkout-step">
      <div className="confirmation-page">
        <div className="confirmation-icon success" aria-hidden="true">
          <i className="fas fa-check-circle"></i>
        </div>
        <h2 className="confirmation-title">Order Confirmed!</h2>
        <p className="confirmation-subtitle">
          Thank you for your order. Your payment has been successfully processed.
        </p>

        <div className="confirmation-order-card">
          <div className="confirmation-order-number">{order.orderNumber}</div>
          <div className="confirmation-order-label">Order Number</div>

          <div className="confirmation-detail-grid">
            <div className="confirmation-detail-item">
              <span className="confirmation-detail-label">Pickup Branch</span>
              <span className="confirmation-detail-value">
                {order.branch?.name || 'See branch details'}
              </span>
            </div>
            <div className="confirmation-detail-item">
              <span className="confirmation-detail-label">Pickup Date</span>
              <span className="confirmation-detail-value">{pickupDateDisplay}</span>
            </div>
            <div className="confirmation-detail-item">
              <span className="confirmation-detail-label">Pickup Time</span>
              <span className="confirmation-detail-value">{slotStart12h} – {slotEnd12h}</span>
            </div>
            <div className="confirmation-detail-item">
              <span className="confirmation-detail-label">Payment Status</span>
              <span className="confirmation-detail-value" style={{ color: '#4caf50' }}>
                {order.paymentStatus === 'succeeded' ? 'Paid' : order.paymentStatus}
              </span>
            </div>
          </div>

          {/* ITEMS */}
          {order.items.length > 0 && (
            <div className="confirmation-items-list">
              {order.items.map((item) => (
                <div key={item.lineKey} className="confirmation-item-row">
                  <span className="confirmation-item-name">
                    {item.itemEmoji} {item.itemName}
                    {item.itemType === 'weight' && item.weightGrams && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {' '}· {formatWeightLabel(item.weightGrams * item.quantity)} ({item.quantity} × {item.variantLabel})
                      </span>
                    )}
                    {item.itemType === 'piece' && item.pieceCount && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {' '}· {item.pieceCount * item.quantity} pcs ({item.quantity} × {item.variantLabel})
                      </span>
                    )}
                  </span>
                  <span className="confirmation-item-total">{formatPrice(item.lineTotalPaise)}</span>
                </div>
              ))}
            </div>
          )}

          {/* AMOUNT BREAKDOWN */}
          <div className="confirmation-items-list">
            <div className="confirmation-item-row">
              <span className="confirmation-item-name">Subtotal</span>
              <span className="confirmation-item-total">{formatPrice(order.subtotalPaise)}</span>
            </div>
            {order.donationPlantationPaise > 0 && (
              <div className="confirmation-item-row">
                <span className="confirmation-item-name">Plantation Donation</span>
                <span className="confirmation-item-total">{formatPrice(order.donationPlantationPaise)}</span>
              </div>
            )}
            {order.donationHungerPaise > 0 && (
              <div className="confirmation-item-row">
                <span className="confirmation-item-name">Feed the Hunger Donation</span>
                <span className="confirmation-item-total">{formatPrice(order.donationHungerPaise)}</span>
              </div>
            )}
            {order.rewardDiscountPaise > 0 && (
              <div className="confirmation-item-row" style={{ color: 'var(--clay-orange)' }}>
                <span className="confirmation-item-name">
                  Reward Discount ({order.rewardPointsRedeemed} pts redeemed)
                </span>
                <span className="confirmation-item-total">−{formatPrice(order.rewardDiscountPaise)}</span>
              </div>
            )}
            <div className="confirmation-final-amount">
              <span>Total Paid</span>
              <span>{formatPrice(order.finalAmountPaise)}</span>
            </div>
          </div>

          {/* REWARDS EARNED */}
          {order.rewardPointsEarned > 0 && (
            <div className="reward-earn-info" style={{ marginTop: 16 }}>
              <i className="fas fa-award" aria-hidden="true" style={{ marginRight: 6 }}></i>
              <strong>+{order.rewardPointsEarned} reward points</strong> credited to your account!
            </div>
          )}
        </div>

        <div className="confirmation-note">
          <strong>Important:</strong> Please keep your order number safe. You&apos;ll need to show it
          at the pickup branch along with your registered phone number. A pickup PIN will be
          introduced in a future module for added security.
        </div>

        <div className="confirmation-actions">
          <button type="button" className="checkout-btn checkout-btn-primary" onClick={onBackToMenu}>
            <i className="fas fa-utensils" aria-hidden="true"></i>
            Order More
          </button>
          <button
            type="button"
            className="checkout-btn checkout-btn-secondary"
            onClick={() => window.print()}
          >
            <i className="fas fa-print" aria-hidden="true"></i>
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}
