'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminShell from '@/components/admin/AdminShell'
import { useAdminStore } from '@/store/admin-store'
import { ShoppingCart, Clock, Truck, CheckCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
interface DashboardStats {
  todayOrders: number
  pendingOrders: number
  ongoingOrders: number
  completedOrders: number
}

const DEFAULT_STATS: DashboardStats = {
  todayOrders: 0,
  pendingOrders: 0,
  ongoingOrders: 0,
  completedOrders: 0,
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      const data = await res.json()
      if (data.success && data.stats) {
        setStats(data.stats)
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <AdminShell>
      <h1 className="admin-page-title">Dashboard</h1>
      <p className="admin-page-subtitle">Overview of today&apos;s restaurant activity</p>

      {/* Stat Cards */}
      <div className="admin-stat-grid">
        {/* Today's Orders */}
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <ShoppingCart size={22} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Today&apos;s Orders</span>
            <span className="admin-stat-value">{loading ? '—' : stats.todayOrders}</span>
            <span className="admin-stat-change neutral">from yesterday</span>
          </div>
        </div>

        {/* Pending */}
        <div className="admin-stat-card">
          <div className="admin-stat-icon amber">
            <Clock size={22} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Pending Orders</span>
            <span className="admin-stat-value">{loading ? '—' : stats.pendingOrders}</span>
            <span className="admin-stat-change neutral">awaiting confirmation</span>
          </div>
        </div>

        {/* Ongoing */}
        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <Truck size={22} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Ongoing Orders</span>
            <span className="admin-stat-value">{loading ? '—' : stats.ongoingOrders}</span>
            <span className="admin-stat-change neutral">in progress</span>
          </div>
        </div>

        {/* Completed */}
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <CheckCircle size={22} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Completed</span>
            <span className="admin-stat-value">{loading ? '—' : stats.completedOrders}</span>
            <span className="admin-stat-change neutral">today</span>
          </div>
        </div>
      </div>

      {/* Placeholder for future charts / recent orders */}
      <div className="admin-card" style={{ padding: 40 }}>
        <div className="admin-empty-state">
          <div style={{ color: '#cbd5e1', marginBottom: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <div className="admin-empty-state-title">Detailed analytics coming soon</div>
          <div className="admin-empty-state-desc">
            Charts, revenue breakdowns, and order trends will be available in a future update.
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
