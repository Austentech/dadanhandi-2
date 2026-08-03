'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { useAdminDashboard } from '@/hooks/use-admin-dashboard'
import { getBranchContact, formatPhoneDisplay } from '@/lib/admin/branch-contacts'
import {
  Package,
  Search,
  Phone,
  CheckCircle,
  XCircle,
  Leaf,
  Gift,
  Coins,
  RefreshCw,
  MapPin,
  User,
  CreditCard,
  Clock,
} from 'lucide-react'
import type { AdminOrderWithItems } from '@/services/admin/admin-order-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format paise to INR display string */
function formatPaise(paise: number): string {
  return '₹' + (paise / 100).toFixed(0)
}

/** Format a time value (ISO string, timestamptz, or HH:MM:SS) to readable time */
function formatTime(value: string): string {
  try {
    if (/^\d{1,2}:\d{2}/.test(value) && !value.includes('T') && !value.includes('Z')) {
      const [h, m] = value.split(':').map(Number)
      const date = new Date()
      date.setHours(h, m, 0, 0)
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })
    }
    return new Date(value).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return value
  }
}

/** Format a date value (ISO string or YYYY-MM-DD) to readable date */
function formatDate(value: string): string {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    }
    return new Date(value).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return value
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

/** Format payment method for display */
function formatPaymentMethod(method: string | null): string {
  if (!method) return 'Online'
  if (method === 'razorpay' || method === 'online') return 'Razorpay'
  return method.charAt(0).toUpperCase() + method.slice(1)
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

  // Look up branch contact from centralized config
  const branchContact = order.branch?.slug ? getBranchContact(order.branch.slug) : null

  return (
    <div
      className={`admin-order-card${order.isOverdue ? ' admin-order-card-overdue' : ''}`}
      role="article"
      aria-label={`Order ${order.orderNumber}${order.isOverdue ? ', overdue — pickup slot has passed' : ''}`}
    >
      {/* Header row */}
      <div className="admin-order-card-header">
        <div className="admin-order-card-id">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="admin-order-number">#{order.orderNumber}</span>
            {order.isOverdue && (
              <span className="admin-overdue-badge" aria-label="Overdue order">
                <Clock size={11} />
                Overdue
              </span>
            )}
          </div>
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

        {(order.customer?.whatsappNumber || order.customer?.mobileNumber) && (
          <a
            href={`tel:${order.customer.whatsappNumber || order.customer.mobileNumber}`}
            className="admin-order-meta-row admin-order-phone-link"
            aria-label={`Call customer ${order.customer?.name || ''} at ${order.customer.whatsappNumber || order.customer.mobileNumber}`}
          >
            <Phone size={13} />
            <span>{order.customer.whatsappNumber || order.customer.mobileNumber}</span>
          </a>
        )}

        <div className="admin-order-meta-row">
          <span className="admin-order-meta-label">Branch</span>
          <span className="admin-order-meta-value">
            {order.branch?.name || 'Unknown Branch'}
          </span>
        </div>

        {/* Branch Manager Contact — centralized config */}
        {branchContact && (
          <a
            href={`tel:${branchContact.managerPhone}`}
            className="admin-order-meta-row admin-branch-contact-link"
            aria-label={`Call ${branchContact.name} manager at ${formatPhoneDisplay(branchContact.managerPhone)}`}
          >
            <User size={13} className="admin-branch-manager-icon" />
            <span className="admin-branch-contact-text">
              <span className="admin-branch-contact-name">{branchContact.managerName}</span>
              <span className="admin-branch-contact-phone">{formatPhoneDisplay(branchContact.managerPhone)}</span>
            </span>
            <Phone size={13} className="admin-branch-call-icon" aria-hidden="true" />
          </a>
        )}

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

      {/* Payment status + method */}
      <div className="admin-order-card-footer">
        <div className="admin-order-payment-status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className={`admin-payment-badge ${order.paymentStatus === 'succeeded' ? 'paid' : 'pending'}`}>
              {order.paymentStatus === 'succeeded' ? 'Paid' : 'Payment Pending'}
            </span>
            <span className="admin-payment-method-badge">
              <CreditCard size={11} />
              {formatPaymentMethod(order.paymentMethod)}
            </span>
          </div>
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
  const [orders, setOrders] = useState<AdminOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { refresh: refreshDashboard } = useAdminDashboard()

  // Fetch orders (server applies preparation window filter)
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

  // Auto-refresh every 60 seconds to catch preparation window changes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(search)
      refreshDashboard()
    }, 60_000)
    return () => clearInterval(interval)
  }, [fetchOrders, search, refreshDashboard])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchTimerRef.current !== undefined) clearTimeout(searchTimerRef.current)
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
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
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

  // Client-side search filter (instant response before server round-trip)
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
        Paid orders awaiting acceptance
        {orders.length > 0 && (
          <span className="admin-order-count-badge">{orders.length}</span>
        )}
      </p>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={16} className="admin-filter-search-icon" />
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
              {search ? 'No matching orders' : 'No pending orders'}
            </div>
            <div className="admin-empty-state-desc">
              {search
                ? 'Try adjusting your search terms.'
                : 'All paid orders have been accepted. New orders will appear here when they enter the preparation window or if any pickup slot is missed.'}
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
