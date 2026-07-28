/**
 * Ongoing Orders Tab
 * Shows only active (confirmed) orders with status and pickup PIN.
 */

'use client'

import { useEffect } from 'react'
import { formatPrice } from '@/lib/pricing'
import { useAccountStore, type OngoingOrder } from '@/store/account-store'

function formatSlotTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

export default function AccountOngoingOrders() {
  const { ongoingOrders, isLoadingOngoing, ongoingError, fetchOngoingOrders } = useAccountStore()

  useEffect(() => {
    fetchOngoingOrders()
  }, [fetchOngoingOrders])

  return (
    <div>
      <div className="account-tab-header">
        <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.4rem', fontWeight: 700, color: '#7A0C0C', margin: 0 }}>
          Ongoing Orders
        </h2>
      </div>

      {/* Loading */}
      {isLoadingOngoing && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="auth-spinner" style={{ margin: '0 auto', width: 28, height: 28 }}></div>
          <p style={{ color: '#7A5030', marginTop: 12, fontSize: '0.9rem' }}>Loading orders...</p>
        </div>
      )}

      {/* Error */}
      {ongoingError && !isLoadingOngoing && (
        <div className="auth-message auth-message-error">{ongoingError}</div>
      )}

      {/* Empty State */}
      {!isLoadingOngoing && !ongoingError && ongoingOrders.length === 0 && (
        <div className="account-empty-state">
          <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', color: '#2E7D32', marginBottom: 16 }}></i>
          <h3>No active orders</h3>
          <p>When you place an order, you can track it here in real time.</p>
          <a href="/menu" className="auth-btn-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none', color: '#fff', padding: '10px 24px' }}>
            Order Now
          </a>
        </div>
      )}

      {/* Ongoing Order Cards */}
      {!isLoadingOngoing && ongoingOrders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ongoingOrders.map((order: OngoingOrder) => (
            <div key={order.id} className="auth-card auth-card-responsive ongoing-order-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#4A2010' }}>{order.orderNumber}</div>
                  <div style={{ fontSize: '0.85rem', color: '#7A5030', marginTop: 4 }}>
                    <i className="fas fa-map-marker-alt" style={{ marginRight: 4 }}></i>
                    {order.branchName}
                  </div>
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 14px',
                    borderRadius: 20,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: '#E8F5E9',
                    color: '#2E7D32',
                  }}
                >
                  Confirmed
                </span>
              </div>

              <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#7A5030' }}>Pickup Date</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {new Date(order.pickupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#7A5030' }}>Pickup Time</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {formatSlotTime(order.pickupSlotStart)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#7A5030' }}>Amount</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#7A0C0C' }}>
                    {formatPrice(order.finalAmountPaise)}
                  </div>
                </div>
              </div>

              {/* Pickup PIN */}
              <div
                className="pickup-pin-card"
                style={{
                  marginTop: 16,
                  padding: order.pickupPin ? '16px' : '12px 16px',
                  background: order.pickupPin ? 'linear-gradient(135deg, #7A0C0C, #C46A2E)' : '#F5F5F5',
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                {order.pickupPin ? (
                  <>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>
                      Pickup PIN
                    </div>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 800,
                      color: '#fff',
                      letterSpacing: 8,
                      fontFamily: 'monospace',
                    }}>
                      {order.pickupPin}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      Show this PIN when collecting your order
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '0.85rem', color: '#7A5030', fontWeight: 600 }}>
                      <i className="fas fa-hourglass-half" style={{ marginRight: 6 }}></i>
                      Waiting for Restaurant
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>
                      Pickup PIN will appear here once assigned
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
