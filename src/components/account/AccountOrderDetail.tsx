/**
 * Order Detail View
 * Shows full order details: items, prices, donations, rewards, branch,
 * status timeline, and pickup PIN if available.
 */

'use client'

import { useEffect } from 'react'
import { formatPrice } from '@/lib/pricing'
import { useAccountStore, type OrderDetail, type OrderDetailItem } from '@/store/account-store'

function formatSlotTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: '#E8F5E9', text: '#2E7D32' },
    awaiting_payment: { bg: '#FFF3E0', text: '#E65100' },
    cancelled: { bg: '#FFEBEE', text: '#C62828' },
    failed: { bg: '#FFEBEE', text: '#C62828' },
  }
  const style = colorMap[status] || { bg: '#F5F5F5', text: '#666' }
  return (
    <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, background: style.bg, color: style.text }}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}

export default function AccountOrderDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const { orderDetail, isLoadingOrderDetail, orderDetailError, fetchOrderDetail } = useAccountStore()

  useEffect(() => {
    fetchOrderDetail(orderId)
  }, [orderId, fetchOrderDetail])

  if (isLoadingOrderDetail) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div className="auth-spinner" style={{ margin: '0 auto', width: 28, height: 28 }}></div>
        <p style={{ color: '#7A5030', marginTop: 12, fontSize: '0.9rem' }}>Loading order details...</p>
      </div>
    )
  }

  if (orderDetailError) {
    return (
      <div>
        <button type="button" className="account-back-btn" onClick={onBack}>
          <i className="fas fa-arrow-left" style={{ marginRight: 6 }}></i>
          Back to Orders
        </button>
        <div className="auth-message auth-message-error" style={{ marginTop: 16 }}>{orderDetailError}</div>
      </div>
    )
  }

  if (!orderDetail) return null

  const od = orderDetail as OrderDetail
  const hasDonations = od.donationPlantationPaise > 0 || od.donationHungerPaise > 0
  const hasRewardRedeem = od.rewardDiscountPaise > 0

  return (
    <div>
      {/* Back Button */}
      <button type="button" className="account-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" style={{ marginRight: 6 }}></i>
        Back to Orders
      </button>

      {/* Order Header */}
      <div className="auth-card auth-card-responsive" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.2rem', fontWeight: 700, color: '#7A0C0C', margin: '0 0 4px' }}>
              Order {od.orderNumber}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#7A5030', margin: 0 }}>
              Placed on {formatDate(od.createdAt)}
            </p>
          </div>
          <StatusBadge status={od.orderStatus} />
        </div>

        {/* Pickup PIN */}
        <div
          className="pickup-pin-card"
          style={{
            marginTop: 16,
            padding: od.pickupPin ? '16px' : '12px 16px',
            background: od.pickupPin ? 'linear-gradient(135deg, #7A0C0C, #C46A2E)' : '#F5F5F5',
            borderRadius: 10,
            textAlign: 'center',
          }}
        >
          {od.pickupPin ? (
            <>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Pickup PIN</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', letterSpacing: 8, fontFamily: 'monospace' }}>{od.pickupPin}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Show this when collecting your order</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.85rem', color: '#7A5030', fontWeight: 600 }}>
                <i className="fas fa-hourglass-half" style={{ marginRight: 6 }}></i>Waiting for Restaurant
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>PIN will appear once assigned</div>
            </>
          )}
        </div>

        {/* Branch & Pickup Info */}
        <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#7A5030', marginBottom: 2 }}>Branch</p>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{od.branch?.name || '—'}</p>
            {od.branch?.addressLine1 && <p style={{ fontSize: '0.8rem', color: '#999' }}>{od.branch.addressLine1}</p>}
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#7A5030', marginBottom: 2 }}>Pickup Date</p>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {new Date(od.pickupDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: '#7A5030', marginBottom: 2 }}>Pickup Time</p>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {formatSlotTime(od.pickupSlotStart)} – {formatSlotTime(od.pickupSlotEnd)}
            </p>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="auth-card auth-card-responsive" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.1rem', fontWeight: 700, color: '#7A0C0C', margin: '0 0 16px' }}>
          Items Ordered
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {od.items.map((item: OrderDetailItem) => (
            <div key={item.lineKey} className="order-detail-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>{item.itemEmoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.itemName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#7A5030' }}>{item.variantLabel}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatPrice(item.lineTotalPaise)}</div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>{formatPrice(item.unitPricePaise)} x {item.quantity}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <div className="auth-card auth-card-responsive" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.1rem', fontWeight: 700, color: '#7A0C0C', margin: '0 0 16px' }}>
          Order Summary
        </h3>
        <div className="order-detail-summary">
          <div className="order-detail-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(od.subtotalPaise)}</span>
          </div>
          {od.donationPlantationPaise > 0 && (
            <div className="order-detail-summary-row">
              <span>Plantation Donation</span>
              <span>+{formatPrice(od.donationPlantationPaise)}</span>
            </div>
          )}
          {od.donationHungerPaise > 0 && (
            <div className="order-detail-summary-row">
              <span>Feed the Hunger</span>
              <span>+{formatPrice(od.donationHungerPaise)}</span>
            </div>
          )}
          {hasRewardRedeem && (
            <div className="order-detail-summary-row discount">
              <span>Reward Discount ({od.rewardPointsRedeemed} pts)</span>
              <span>-{formatPrice(od.rewardDiscountPaise)}</span>
            </div>
          )}
          <div className="order-detail-summary-row total">
            <span>Total Paid</span>
            <span>{formatPrice(od.finalAmountPaise)}</span>
          </div>
          {od.rewardPointsEarned > 0 && (
            <div className="order-detail-summary-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color, rgba(122,12,12,0.15))' }}>
              <span><i className="fas fa-award" style={{ marginRight: 4, color: '#C46A2E' }}></i>Points Earned</span>
              <span style={{ color: '#2E7D32', fontWeight: 600 }}>+{od.rewardPointsEarned} pts</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {od.statusHistory && od.statusHistory.length > 0 && (
        <div className="auth-card auth-card-responsive">
          <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.1rem', fontWeight: 700, color: '#7A0C0C', margin: '0 0 16px' }}>
            Order Timeline
          </h3>
          <div className="order-timeline">
            {od.statusHistory.map((entry, idx) => (
              <div key={idx} className="order-timeline-item">
                <div className="order-timeline-dot"></div>
                <div className="order-timeline-content">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#4A2010', textTransform: 'capitalize' }}>
                    {entry.status.replace(/_/g, ' ')}
                  </div>
                  {entry.note && <div style={{ fontSize: '0.8rem', color: '#7A5030', marginTop: 2 }}>{entry.note}</div>}
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>{formatDateTime(entry.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Notes */}
      {od.customerNotes && (
        <div className="auth-card auth-card-responsive">
          <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.1rem', fontWeight: 700, color: '#7A0C0C', margin: '0 0 8px' }}>
            Your Notes
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#4A2010', margin: 0 }}>{od.customerNotes}</p>
        </div>
      )}
    </div>
  )
}
