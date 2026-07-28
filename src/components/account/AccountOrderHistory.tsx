/**
 * Order History Tab
 * Displays paginated order list with filters.
 * Click on an order opens the detail view.
 */

'use client'

import { useEffect } from 'react'
import { formatPrice } from '@/lib/pricing'
import { useAccountStore } from '@/store/account-store'
import type { OrderListItem } from '@/store/account-store'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSlotTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: '#E8F5E9', text: '#2E7D32' },
    awaiting_payment: { bg: '#FFF3E0', text: '#E65100' },
    cancelled: { bg: '#FFEBEE', text: '#C62828' },
    failed: { bg: '#FFEBEE', text: '#C62828' },
    succeeded: { bg: '#E8F5E9', text: '#2E7D32' },
  }
  const style = colorMap[status] || { bg: '#F5F5F5', text: '#666' }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: '0.75rem',
        fontWeight: 600,
        background: style.bg,
        color: style.text,
      }}
    >
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  )
}

export default function AccountOrderHistory() {
  const {
    orders, ordersPagination, isLoadingOrders, ordersError,
    orderFilters, setOrderFilters, fetchOrders, viewOrderDetail,
  } = useAccountStore()

  useEffect(() => {
    fetchOrders(1)
  }, [fetchOrders])

  const handleFilterChange = (key: string, value: string) => {
    setOrderFilters({ [key]: value })
    fetchOrders(1)
  }

  const handlePageChange = (page: number) => {
    fetchOrders(page)
  }

  return (
    <div>
      <div className="account-tab-header">
        <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.4rem', fontWeight: 700, color: '#7A0C0C', margin: 0 }}>
          Order History
        </h2>
      </div>

      {/* Filters */}
      <div className="account-filters">
        <div className="account-filter-group">
          <label className="account-filter-label">Status</label>
          <select
            className="account-filter-select"
            value={orderFilters.orderStatus}
            onChange={(e) => handleFilterChange('orderStatus', e.target.value)}
          >
            <option value="all">All Orders</option>
            <option value="confirmed">Confirmed</option>
            <option value="awaiting_payment">Pending Payment</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="account-filter-group">
          <label className="account-filter-label">Sort</label>
          <select
            className="account-filter-select"
            value={orderFilters.sortOrder}
            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
        <div className="account-filter-group" style={{ flex: '1 1 100%' }}>
          <label className="account-filter-label">Search</label>
          <input
            type="text"
            className="account-filter-input"
            placeholder="Order ID or number..."
            value={orderFilters.search}
            onChange={(e) => setOrderFilters({ search: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchOrders(1) }}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoadingOrders && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="auth-spinner" style={{ margin: '0 auto', width: 28, height: 28 }}></div>
          <p style={{ color: '#7A5030', marginTop: 12, fontSize: '0.9rem' }}>Loading orders...</p>
        </div>
      )}

      {/* Error */}
      {ordersError && !isLoadingOrders && (
        <div className="auth-message auth-message-error">{ordersError}</div>
      )}

      {/* Empty State */}
      {!isLoadingOrders && !ordersError && orders.length === 0 && (
        <div className="account-empty-state">
          <i className="fas fa-box-open" style={{ fontSize: '2.5rem', color: '#C46A2E', marginBottom: 16 }}></i>
          <h3>No orders yet</h3>
          <p>Your order history will appear here after you place your first order.</p>
          <a href="/menu" className="auth-btn-primary" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none', color: '#fff', padding: '10px 24px' }}>
            Browse Menu
          </a>
        </div>
      )}

      {/* Order List */}
      {!isLoadingOrders && orders.length > 0 && (
        <div className="account-order-list">
          {orders.map((order: OrderListItem) => (
            <button
              key={order.id}
              type="button"
              className="account-order-card"
              onClick={() => viewOrderDetail(order.id)}
              aria-label={`View order ${order.orderNumber}`}
            >
              <div className="account-order-card-header">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#4A2010' }}>{order.orderNumber}</div>
                  <div style={{ fontSize: '0.8rem', color: '#7A5030', marginTop: 2 }}>
                    <i className="fas fa-map-marker-alt" style={{ marginRight: 4, fontSize: '0.7rem' }}></i>
                    {order.branchName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={order.orderStatus} />
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#7A0C0C', marginTop: 4 }}>
                    {formatPrice(order.finalAmountPaise)}
                  </div>
                </div>
              </div>
              <div className="account-order-card-body">
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#7A5030' }}>
                    <i className="fas fa-calendar" style={{ marginRight: 4 }}></i>
                    {formatDate(order.createdAt)}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#7A5030', marginLeft: 16 }}>
                    <i className="fas fa-clock" style={{ marginRight: 4 }}></i>
                    {formatSlotTime(order.pickupSlotStart)}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#7A5030' }}>
                  {order.rewardPointsEarned > 0 && (
                    <span style={{ marginRight: 12 }}>
                      <i className="fas fa-award" style={{ marginRight: 3, color: '#C46A2E' }}></i>
                      +{order.rewardPointsEarned} pts
                    </span>
                  )}
                  {order.rewardPointsRedeemed > 0 && (
                    <span style={{ marginRight: 12 }}>
                      <i className="fas fa-tag" style={{ marginRight: 3 }}></i>
                      -{formatPrice(order.rewardDiscountPaise)}
                    </span>
                  )}
                </div>
              </div>
              <i className="fas fa-chevron-right account-order-card-arrow"></i>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {ordersPagination && ordersPagination.totalPages > 1 && (
        <div className="account-pagination">
          <button
            type="button"
            className="account-pagination-btn"
            disabled={ordersPagination.page <= 1}
            onClick={() => handlePageChange(ordersPagination.page - 1)}
          >
            <i className="fas fa-chevron-left"></i> Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: '#7A5030' }}>
            Page {ordersPagination.page} of {ordersPagination.totalPages}
          </span>
          <button
            type="button"
            className="account-pagination-btn"
            disabled={ordersPagination.page >= ordersPagination.totalPages}
            onClick={() => handlePageChange(ordersPagination.page + 1)}
          >
            Next <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  )
}
