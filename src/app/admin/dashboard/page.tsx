'use client'

import { useAdminDashboard } from '@/hooks/use-admin-dashboard'
import AdminShell from '@/components/admin/AdminShell'
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  PackageCheck,
  AlertCircle,
  CalendarClock,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Stat Card Component (reusable)
// ---------------------------------------------------------------------------
function StatCard({
  icon,
  iconBg,
  label,
  value,
  loading,
  subtitle,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: number
  loading: boolean
  subtitle?: string
}) {
  return (
    <div className="admin-stat-card">
      <div className={`admin-stat-icon ${iconBg}`}>{icon}</div>
      <div className="admin-stat-info">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-value">{loading ? '—' : value}</span>
        {subtitle && <span className="admin-stat-subtitle">{subtitle}</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { stats, loading, error, refresh } = useAdminDashboard()

  return (
    <AdminShell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>Dashboard</h1>
        {error && (
          <button
            onClick={refresh}
            className="admin-refresh-btn"
            aria-label="Retry loading dashboard"
          >
            Retry
          </button>
        )}
      </div>
      <p className="admin-page-subtitle">Live overview of restaurant activity</p>

      {/* Stat Cards — Row 1: Core metrics */}
      <div className="admin-stat-grid">
        <StatCard
          icon={<ShoppingCart size={22} />}
          iconBg="blue"
          label="Today's Orders"
          value={stats.todayOrders}
          loading={loading}
        />
        <StatCard
          icon={<Clock size={22} />}
          iconBg="amber"
          label="Current Queue"
          value={stats.pendingOrders}
          loading={loading}
          subtitle="Paid, in preparation window"
        />
        <StatCard
          icon={<CalendarClock size={22} />}
          iconBg="orange"
          label="Upcoming Orders"
          value={stats.upcomingOrders}
          loading={loading}
          subtitle="Paid, after preparation window"
        />
        <StatCard
          icon={<Truck size={22} />}
          iconBg="green"
          label="Ongoing"
          value={stats.acceptedOrders + stats.preparingOrders + stats.readyOrders}
          loading={loading}
        />
      </div>

      {/* Stat Cards — Row 2: Detailed breakdown */}
      <div className="admin-stat-grid">
        <StatCard
          icon={<CheckCircle size={22} />}
          iconBg="purple"
          label="Completed"
          value={stats.completedOrders}
          loading={loading}
        />
        <StatCard
          icon={<PackageCheck size={22} />}
          iconBg="blue"
          label="Accepted"
          value={stats.acceptedOrders}
          loading={loading}
        />
        <StatCard
          icon={<ChefHat size={22} />}
          iconBg="amber"
          label="Preparing"
          value={stats.preparingOrders}
          loading={loading}
        />
        <StatCard
          icon={<AlertCircle size={22} />}
          iconBg="teal"
          label="Ready for Pickup"
          value={stats.readyOrders}
          loading={loading}
        />
      </div>

      {/* Quick Info Card */}
      <div className="admin-card" style={{ marginTop: 8 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
        }}>
          <div className="admin-quick-info">
            <span className="admin-quick-info-label">Cancelled (Today)</span>
            <span className="admin-quick-info-value">{loading ? '—' : stats.cancelledOrders}</span>
          </div>
          <div className="admin-quick-info">
            <span className="admin-quick-info-label">Current + Upcoming</span>
            <span className="admin-quick-info-value">{loading ? '—' : stats.pendingOrders + stats.upcomingOrders}</span>
          </div>
          <div className="admin-quick-info">
            <span className="admin-quick-info-label">Total Ongoing</span>
            <span className="admin-quick-info-value">{loading ? '—' : stats.acceptedOrders + stats.preparingOrders + stats.readyOrders}</span>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
