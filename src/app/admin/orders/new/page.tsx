'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '@/components/admin/AdminShell'
import { useAdminDashboard } from '@/hooks/use-admin-dashboard'
import {
  Package,
  Search,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  Leaf,
  Gift,
  Coins,
  RefreshCw,
} from 'lucide-react'
import type { AdminOrderWithItems } from '@/services/admin/admin-order-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format paise to INR display string */
function formatPaise(paise: number): string {
  return '₹' + (paise / 100).toFixed(0)
}

/** Format ISO time to local readable time */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return iso
  }
}

/** Format ISO date to readable date */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return iso
  }
}

/** Format pickup slot to display */
function formatSlot(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

/** Time ago helper */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Order Card Component
// ---------------------------------------------------------------------------

function OrderCard({
  order,
  onAccept,
  acceptingId,
}: {
  order: AdminOrderWithItems
  onAccept: (orderId: string) => void
  acceptingId: string | null
}) {
  const isAccepting = acceptingId === order.id
  const totalDonation = order.donationPlantationPaise + order.donationHungerPaise
  const hasReward = order.rewardPointsRedeemed > 0

  return (
    <div className="admin-order-card" role="article" aria-label={`Order ${order.orderNumber}`}>
      {/* Header row */}
      <div className="admin-order-card-header">
        <div className="admin-order-card-id">
          <span className="admin-order-number">#{order.orderNumber}</span>
          <span className="admin-order-time">{timeAgo(order.createdAt)}</span>
        </div>
        <div className="admin-order-card-amount">{formatPaise(order.finalAmountPaise)}</div>
      </div>

      {/* Customer & Branch */}
      <div className="admin-order-card-meta">
        <div className="admin-order-meta-row">
          <span className="admin-order-meta-label">Customer</span>
          <span className="admin-order-meta-value">{order.customer?.name || 'Unknown'}</span>
        </div>

        {order.customer?.whatsappNumber && (
          <a
            href={`tel:${order.customer.whatsappNumber}`}
            className="admin-order-meta-row admin-order-phone-link"
            aria-label={`Call ${order.customer.name} at ${order.customer.whatsappNumber}`}
          >
            <Phone size={13} />
            <span>{order.customer.whatsappNumber}</span>
          </a>
        )}

        <div className="admin-order-meta-row">
          <span className="admin-order-meta-label">Branch</span>
          <span className="admin-order-meta-value">
            {order.branch?.name || order.branchId}
          </span>
        </div>

        <div className="admin-order-meta-row">
          <span className="admin-order-meta-label">Pickup</span>
          <span className="admin-order-meta-value">
            {formatDate(order.pickupDate)}, {formatSlot(order.pickupSlotStart, order.pickupSlotEnd)}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="admin-order-items">
        <div className="admin-order-section-label">Items</div>
        {order.items.map((item) => (
          <div key={item.lineKey} className="admin-order-item-row">
            <span className="admin-order-item-emoji">{item.itemEmoji}</span>
            <span className="admin-order-item-name">{item.itemName}</span>
            {item.variantLabel && (
              <span className="admin-order-item-variant">{item.variantLabel}</span>
            )}
            <span className="admin-order-item-qty">x{item.quantity}</span>
            <span className="admin-order-item-price">{formatPaise(item.lineTotalPaise)}</span>
          </div>
        ))}
      </div>

      {/* Price Breakdown */}
      <div className="admin-order-breakdown">
        <div className="admin-order-breakdown-row">
          <span>Subtotal</span>
          <span>{formatPaise(order.subtotalPaise)}</span>
        </div>

        {totalDonation > 0 && (
          <div className="admin-order-breakdown-row admin-donation-row">
            <span className="admin-donation-label">
              <Leaf size={12} />
              Donations
            </span>
            <span>+{formatPaise(totalDonation)}</span>
          </div>
        )}

        {hasReward && (
          <div className="admin-order-breakdown-row admin-reward-row">
            <span className="admin-reward-label">
              <Coins size={12} />
              Reward (-{order.rewardPointsRedeemed} pts)
            </span>
            <span>-{formatPaise(order.rewardDiscountPaise)}</span>
          </div>
        )}

        <div className="admin-order-breakdown-row admin-breakdown-total">
          <span>Total</span>
          <span>{formatPaise(order.finalAmountPaise)}</span>
        </div>

        {order.rewardPointsEarned > 0 && (
          <div className="admin-order-breakdown-row admin-points-row">
            <span className="admin-points-label">
              <Gift size={12} />
              Points earned
            </span>
            <span>+{order.rewardPointsEarned}</span>
          </div>
        )}
      </div>

      {/* Payment status */}
      <div className="admin-order-card-footer">
        <div className="admin-order-payment-status">
          <span className={`admin-payment-badge ${order.paymentStatus === 'succeeded' ? 'paid' : 'pending'}`}>
            {order.paymentStatus === 'succeeded' ? 'Paid' : 'Payment Pending'}
          </span>
          <span className="admin-order-created-at">
            Ordered {formatTime(order.createdAt)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="admin-order-actions">
          <button
            className="admin-order-btn accept"
            onClick={() => onAccept(order.id)}
            disabled={isAccepting}
            aria-label={`Accept order ${order.orderNumber}`}
          >
            {isAccepting ? (
              <><span className="admin-btn-spinner" /> Accepting...</>
            ) : (
              <><CheckCircle size={16} /> Accept</>
            )}
          </button>

          <button
            className="admin-order-btn reject"
            disabled
            title="Coming Soon"
            aria-label="Reject order — coming soon"
          >
            <XCircle size={16} /> Coming Soon
          </button>
        </div>
      </div>

      {order.customerNotes && (
        <div className="admin-order-notes">
          <span className="admin-order-notes-label">Note:</span>{' '}
          {order.customerNotes}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// New Orders Page
// ---------------------------------------------------------------------------

export default function NewOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<AdminOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const { refresh: refreshDashboard } = useAdminDashboard()

  // Fetch orders
  const fetchOrders = useCallback(async (searchQuery?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status: 'confirmed' })
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/admin/orders/list?${params}`)
      if (res.status === 401) return
      const data = await res.json()
      if (data.success) {
        setOrders(data.orders || [])
      } else {
        setError(data.message || 'Failed to load orders')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + realtime subscription
  useEffect(() => {
    fetchOrders()

    // Subscribe to realtime changes on orders table
    let cleanup: (() => void) | null = null

    ;(async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseKey) return

        const supabase = createBrowserClient(supabaseUrl, supabaseKey)
        const channel = supabase
          .channel('admin-new-orders')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            (payload: { eventType: string; new: Record<string, unknown> }) => {
              if (payload.eventType === 'UPDATE') {
                const newStatus = payload.new?.order_status as string
                if (newStatus && newStatus !== 'confirmed') {
                  fetchOrders(search)
                  refreshDashboard()
                }
              }
              if (payload.eventType === 'INSERT') {
                const newStatus = payload.new?.order_status as string
                if (newStatus === 'confirmed') {
                  fetchOrders(search)
                  refreshDashboard()
                }
              }
            }
          )
          .subscribe()

        cleanup = () => { try { supabase.removeChannel(channel) } catch { /* */ } }
      } catch {
        /* Realtime not available */
      }
    })()

    return () => { cleanup?.() }
  }, [fetchOrders, search, refreshDashboard])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      fetchOrders(value)
    }, 400)
  }, [fetchOrders])

  // Accept order handler
  const handleAccept = useCallback(async (orderId: string) => {
    setAcceptingId(orderId)
    try {
      const res = await fetch('/api/admin/orders/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (data.success) {
        // Remove from list immediately (optimistic)
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
        // Refresh dashboard stats
        refreshDashboard()
      } else {
        alert(data.message || 'Failed to accept order')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setAcceptingId(null)
    }
  }, [refreshDashboard])

  // Filter orders client-side by search (for instant response before server response)
  const displayOrders = search
    ? orders.filter((o) => {
        const q = search.toLowerCase()
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customer?.name || '').toLowerCase().includes(q)
        )
      })
    : orders

  return (
    <AdminShell>
      <h1 className="admin-page-title">New Orders</h1>
      <p className="admin-page-subtitle">
        Orders awaiting confirmation and acceptance
        {orders.length > 0 && (
          <span className="admin-order-count-badge">{orders.length}</span>
        )}
      </p>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search
            size={16}
            className="admin-filter-search-icon"
          />
          <input
            type="text"
            placeholder="Search by order # or customer name..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="admin-filter-search-input"
            aria-label="Search orders"
          />
        </div>
        <button
          onClick={() => { setSearch(''); fetchOrders() }}
          className="admin-filter-refresh-btn"
          disabled={loading}
          aria-label="Refresh orders list"
        >
          <RefreshCw size={16} className={loading ? 'admin-spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading && orders.length === 0 ? (
        <div className="admin-card" style={{ padding: 60 }}>
          <div className="admin-auth-loading" style={{ minHeight: 'auto', background: 'none' }}>
            <div className="admin-auth-spinner" />
            <span className="admin-auth-loading-text">Loading orders...</span>
          </div>
        </div>
      ) : error ? (
        <div className="admin-card" style={{ padding: 40 }}>
          <div className="admin-empty-state">
            <XCircle size={48} className="admin-empty-state-icon" style={{ color: '#fca5a5' }} />
            <div className="admin-empty-state-title">Failed to load orders</div>
            <div className="admin-empty-state-desc">{error}</div>
            <button onClick={() => fetchOrders(search)} className="admin-login-btn" style={{ width: 'auto', marginTop: 16, padding: '8px 20px' }}>
              Try Again
            </button>
          </div>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="admin-card" style={{ padding: 60 }}>
          <div className="admin-empty-state">
            <Package size={56} className="admin-empty-state-icon" />
            <div className="admin-empty-state-title">
              {search ? 'No matching orders' : 'No new orders'}
            </div>
            <div className="admin-empty-state-desc">
              {search
                ? 'Try adjusting your search terms.'
                : "When customers place paid orders, they'll appear here for you to review and accept."}
            </div>
          </div>
        </div>
      ) : (
        <div className="admin-orders-grid">
          {displayOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAccept={handleAccept}
              acceptingId={acceptingId}
            />
          ))}
        </div>
      )}
    </AdminShell>
  )
}
