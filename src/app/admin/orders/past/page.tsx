'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { useAdminDashboard } from '@/hooks/use-admin-dashboard'
import {
  Archive,
  Search,
  RefreshCw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  KeyRound,
} from 'lucide-react'
import type { AdminPastOrder } from '@/services/admin/admin-order-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPaise(paise: number): string {
  return '\u20b9' + (paise / 100).toFixed(0)
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

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return value
  }
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

// ---------------------------------------------------------------------------
// Past Orders Page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

export default function PastOrdersPage() {
  const [orders, setOrders] = useState<AdminPastOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { refresh: refreshDashboard } = useAdminDashboard()

  const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1)

  const fetchOrders = useCallback(async (searchQuery?: string, sort?: 'newest' | 'oldest', pageNum?: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (sort) params.set('sort', sort)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(((pageNum || 1) - 1) * PAGE_SIZE))

      const res = await fetch(`/api/admin/orders/past?${params}`)
      if (res.status === 401) return
      const data = await res.json()
      if (data.success) {
        setOrders(data.orders || [])
        setTotalCount(data.totalCount || 0)
      } else {
        setError(data.message || 'Failed to load past orders')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + realtime subscription
  useEffect(() => {
    fetchOrders(search || undefined, sortOrder, page)

    let cleanup: (() => void) | null = null

    ;(async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseKey) return

        const supabase = createBrowserClient(supabaseUrl, supabaseKey)
        const channel = supabase
          .channel('admin-past-orders')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders' },
            (payload: { eventType: string; new: Record<string, unknown> }) => {
              const newStatus = payload.new?.order_status as string | undefined
              if (newStatus === 'completed') {
                fetchOrders(search || undefined, sortOrder, 1)
                refreshDashboard()
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
  }, [fetchOrders, search, sortOrder, page, refreshDashboard])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimerRef.current !== undefined) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      fetchOrders(value || undefined, sortOrder, 1)
    }, 400)
  }, [fetchOrders, sortOrder])

  const handleSortToggle = useCallback(() => {
    const next = sortOrder === 'newest' ? 'oldest' : 'newest'
    setSortOrder(next)
    setPage(1)
    fetchOrders(search || undefined, next, 1)
  }, [sortOrder, search, fetchOrders])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
    fetchOrders(search || undefined, sortOrder, newPage)
  }, [search, sortOrder, fetchOrders])

  return (
    <AdminShell>
      <h1 className="admin-page-title">Past Orders</h1>
      <p className="admin-page-subtitle">
        Completed order history
        {totalCount > 0 && (
          <span className="admin-order-count-badge">{totalCount}</span>
        )}
      </p>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={16} className="admin-filter-search-icon" />
          <input
            type="text"
            placeholder="Search by order # or customer..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="admin-filter-search-input"
            aria-label="Search past orders"
          />
        </div>
        <button
          onClick={handleSortToggle}
          className="admin-filter-refresh-btn"
          style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}
          aria-label={`Sort: ${sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}`}
        >
          <ArrowUpDown size={14} />
          {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </button>
        <button
          onClick={() => fetchOrders(search || undefined, sortOrder, page)}
          className="admin-filter-refresh-btn"
          disabled={loading}
          aria-label="Refresh past orders"
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
            <button onClick={() => fetchOrders(search || undefined, sortOrder, page)} className="admin-login-btn" style={{ width: 'auto', marginTop: 16, padding: '8px 20px' }}>
              Try Again
            </button>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="admin-card" style={{ padding: 60 }}>
          <div className="admin-empty-state">
            <Archive size={48} className="admin-empty-state-icon" />
            <div className="admin-empty-state-title">
              {search ? 'No matching orders' : 'No past orders'}
            </div>
            <div className="admin-empty-state-desc">
              {search
                ? 'Try adjusting your search terms.'
                : 'Completed orders will appear here.'}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Branch</th>
                  <th>Amount</th>
                  <th>PIN</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="admin-order-number" style={{ fontSize: '0.82rem' }}>
                        #{order.orderNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{order.customerName}</td>
                    <td>{order.branchName}</td>
                    <td style={{ fontWeight: 700 }}>{formatPaise(order.finalAmountPaise)}</td>
                    <td>
                      {order.pickupPin ? (
                        <span style={{
                          fontFamily: "'Courier New', Courier, monospace",
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: '#166534',
                          letterSpacing: 2,
                        }}>
                          {order.pickupPin}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {order.completedAt
                        ? <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{formatDateTime(order.completedAt)}</span>
                        : <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
              marginTop: 16,
              padding: '12px 0',
            }}>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="admin-order-btn"
                style={{ padding: '6px 12px', fontSize: '0.78rem', opacity: page <= 1 ? 0.4 : 1 }}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="admin-order-btn"
                style={{ padding: '6px 12px', fontSize: '0.78rem', opacity: page >= totalPages ? 0.4 : 1 }}
                aria-label="Next page"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </AdminShell>
  )
}
