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
  User,
  CreditCard,
  ChefHat,
  Clock,
} from 'lucide-react'
import type { AdminOrderWithItems } from '@/services/admin/admin-order-service'

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, {
  label: string
  cssClass: string
  nextAction: string | null
  nextStatus: string | null
  nextIcon: React.ReactNode
}> = {
  accepted: {
    label: 'Accepted',
    cssClass: 'accepted',
    nextAction: 'Start Preparing',
    nextStatus: 'preparing',
    nextIcon: <ChefHat size={16} />,
  },
  preparing: {
    label: 'Preparing',
    cssClass: 'preparing',
    nextAction: 'Mark Complete',
    nextStatus: 'ready_for_pickup',
    nextIcon: <CheckCircle size={16} />,
  },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    cssClass: 'ready',
    nextAction: null,
    nextStatus: null,
    nextIcon: null,
  },
}

// ---------------------------------------------------------------------------
// Helpers (shared with New Orders page patterns)
// ---------------------------------------------------------------------------

function formatPaise(paise: number): string {
  return '\u20b9' + (paise / 100).toFixed(0)
}

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

function formatSlot(start: string, end: string): string {
  return `${formatTime(start)} \u2013 ${formatTime(end)}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return 'Online'
  if (method === 'razorpay' || method === 'online') return 'Razorpay'
  return method.charAt(0).toUpperCase() + method.slice(1)
}

// ---------------------------------------------------------------------------
// Ongoing Order Card
// ---------------------------------------------------------------------------

function OngoingOrderCard({
  order,
  onStatusUpdate,
  updatingId,
}: {
  order: AdminOrderWithItems
  onStatusUpdate: (orderId: string, targetStatus: string) => void
  updatingId: string | null
}) {
  const isUpdating = updatingId === order.id
  const totalDonation = order.donationPlantationPaise + order.donationHungerPaise
  const hasReward = order.rewardPointsRedeemed > 0
  const statusCfg = STATUS_CONFIG[order.orderStatus]
  const branchContact = order.branch?.slug ? getBranchContact(order.branch.slug) : null

  return (
    <div
      className={`admin-order-card admin-ongoing-card admin-ongoing-card--${statusCfg?.cssClass || ''}`}
      role="article"
      aria-label={`Order ${order.orderNumber}, status: ${statusCfg?.label || order.orderStatus}`}
    >
      {/* Header row */}
      <div className="admin-order-card-header">
        <div className="admin-order-card-id">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="admin-order-number">#{order.orderNumber}</span>
            <span className={`admin-status-badge ${statusCfg?.cssClass || ''}`}>
              {statusCfg?.label || order.orderStatus}
            </span>
          </div>
          <span className="admin-order-time">{timeAgo(order.updatedAt)}</span>
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

        {order.acceptedAt && (
          <div className="admin-order-meta-row">
            <span className="admin-order-meta-label">Accepted</span>
            <span className="admin-order-meta-value">
              {formatTime(order.acceptedAt)}
            </span>
          </div>
        )}
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

      {/* Payment status + Action Buttons */}
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
        </div>

        {/* Workflow Action Buttons */}
        <div className="admin-order-actions">
          {statusCfg?.nextAction && statusCfg.nextStatus ? (
            <button
              className={`admin-order-btn status-action admin-status-btn-${statusCfg.cssClass}`}
              onClick={() => onStatusUpdate(order.id, statusCfg.nextStatus!)}
              disabled={isUpdating}
              aria-label={`${statusCfg.nextAction} for order ${order.orderNumber}`}
            >
              {isUpdating ? (
                <><span className="admin-btn-spinner" /> Updating...</>
              ) : (
                <>{statusCfg.nextIcon} {statusCfg.nextAction}</>
              )}
            </button>
          ) : (
            <button
              className="admin-order-btn pickup-pin-soon"
              disabled
              title="Pickup PIN generation coming in the next module"
              aria-label="Generate pickup PIN — coming soon"
            >
              <Clock size={16} /> Pickup PIN
            </button>
          )}
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
// Ongoing Orders Page
// ---------------------------------------------------------------------------

export default function OngoingOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { refresh: refreshDashboard } = useAdminDashboard()

  // Fetch ongoing orders
  const fetchOrders = useCallback(async (searchQuery?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/admin/orders/ongoing?${params}`)
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
          .channel('admin-ongoing-orders')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            (payload: { eventType: string; new: Record<string, unknown> }) => {
              const newStatus = payload.new?.order_status as string | undefined
              const ongoingStatuses = ['accepted', 'preparing', 'ready_for_pickup']

              if (payload.eventType === 'UPDATE') {
                if (newStatus && ongoingStatuses.includes(newStatus)) {
                  fetchOrders(search)
                  refreshDashboard()
                } else if (newStatus && !ongoingStatuses.includes(newStatus)) {
                  // Order left ongoing (e.g. accepted → cancelled), remove from list
                  setOrders((prev) => prev.filter((o) => o.id !== payload.new?.id))
                  refreshDashboard()
                }
              }
              if (payload.eventType === 'INSERT') {
                if (newStatus && ongoingStatuses.includes(newStatus)) {
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

  // Auto-refresh every 60 seconds
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

  // Status update handler
  const handleStatusUpdate = useCallback(async (orderId: string, targetStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch('/api/admin/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, targetStatus }),
      })
      const data = await res.json()
      if (data.success) {
        // Remove from list and refresh (realtime will also trigger)
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
        refreshDashboard()
      } else {
        alert(data.message || 'Failed to update order status')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }, [refreshDashboard])

  // Client-side search filter
  const displayOrders = search
    ? orders.filter((o) => {
        const q = search.toLowerCase()
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customer?.name || '').toLowerCase().includes(q)
        )
      })
    : orders

  // Count by status
  const acceptedCount = orders.filter((o) => o.orderStatus === 'accepted').length
  const preparingCount = orders.filter((o) => o.orderStatus === 'preparing').length
  const readyCount = orders.filter((o) => o.orderStatus === 'ready_for_pickup').length

  return (
    <AdminShell>
      <h1 className="admin-page-title">Ongoing Orders</h1>
      <p className="admin-page-subtitle">
        Accepted orders in progress
        {orders.length > 0 && (
          <span className="admin-order-count-badge">{orders.length}</span>
        )}
      </p>

      {/* Status summary chips */}
      {orders.length > 0 && (
        <div className="admin-ongoing-summary">
          <span className="admin-ongoing-chip accepted">
            <ChefHat size={13} /> {acceptedCount} Accepted
          </span>
          <span className="admin-ongoing-chip preparing">
            <ChefHat size={13} /> {preparingCount} Preparing
          </span>
          <span className="admin-ongoing-chip ready">
            <CheckCircle size={13} /> {readyCount} Ready
          </span>
        </div>
      )}

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
              {search ? 'No matching orders' : 'No ongoing orders'}
            </div>
            <div className="admin-empty-state-desc">
              {search
                ? 'Try adjusting your search terms.'
                : 'Accepted orders will appear here as they progress through the kitchen.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="admin-orders-grid">
          {displayOrders.map((order) => (
            <OngoingOrderCard
              key={order.id}
              order={order}
              onStatusUpdate={handleStatusUpdate}
              updatingId={updatingId}
            />
          ))}
        </div>
      )}
    </AdminShell>
  )
}
