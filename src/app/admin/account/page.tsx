'use client'

import AdminShell from '@/components/admin/AdminShell'
import { useAdminStore } from '@/store/admin-store'
import { Building2, User, Shield, Clock, Settings, Info } from 'lucide-react'
import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Account Page
// ---------------------------------------------------------------------------
export default function AccountPage() {
  const { adminUser } = useAdminStore()

  const initials = useMemo(() => {
    if (!adminUser?.name) return 'A'
    const parts = adminUser.name.trim().split(/\s+/)
    return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
  }, [adminUser?.name])

  const formattedLastLogin = useMemo(() => {
    if (!adminUser?.last_login_at) return 'N/A'
    try {
      return new Date(adminUser.last_login_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return 'N/A'
    }
  }, [adminUser?.last_login_at])

  const roleBadgeColor = useMemo(() => {
    switch (adminUser?.role) {
      case 'super_admin':
        return { bg: '#fef2f2', color: '#dc2626' }
      case 'admin':
        return { bg: '#eff6ff', color: '#2563eb' }
      default:
        return { bg: '#f1f5f9', color: '#64748b' }
    }
  }, [adminUser?.role])

  return (
    <AdminShell>
      <h1 className="admin-page-title">Account</h1>

      {/* Business Info Card */}
      <div className="admin-card admin-account-section">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="admin-stat-icon"
              style={{ background: '#eff6ff', color: '#3b82f6', width: 40, height: 40 }}
            >
              <Building2 size={20} />
            </div>
            <div className="admin-card-title">Business Information</div>
          </div>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Business Name</span>
          <span className="admin-account-info-value">Dadan Handi Mutton Hotel</span>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Type</span>
          <span className="admin-account-info-value">Restaurant / Cloud Kitchen</span>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Status</span>
          <span className="admin-account-info-value">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                color: '#10b981',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block',
                }}
              />
              Active
            </span>
          </span>
        </div>
      </div>

      {/* Admin Info Card */}
      <div className="admin-card admin-account-section">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="admin-header-avatar" style={{ width: 40, height: 40, fontSize: '0.85rem' }}>
              {initials}
            </div>
            <div>
              <div className="admin-card-title">{adminUser?.name || 'Admin'}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                {adminUser?.email_masked || '—'}
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 10,
              background: roleBadgeColor.bg,
              color: roleBadgeColor.color,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
            }}
          >
            {adminUser?.role?.replace('_', ' ') || 'viewer'}
          </span>
        </div>

        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Name</span>
          <span className="admin-account-info-value">{adminUser?.name || '—'}</span>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Email</span>
          <span className="admin-account-info-value">{adminUser?.email_masked || '—'}</span>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Role</span>
          <span className="admin-account-info-value" style={{ textTransform: 'capitalize' }}>
            {adminUser?.role?.replace('_', ' ') || 'viewer'}
          </span>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Last Login</span>
          <span className="admin-account-info-value">{formattedLastLogin}</span>
        </div>
      </div>

      {/* Session Info Card */}
      <div className="admin-card admin-account-section">
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="admin-stat-icon"
              style={{ background: '#ecfdf5', color: '#10b981', width: 40, height: 40 }}
            >
              <Clock size={20} />
            </div>
            <div className="admin-card-title">Current Session</div>
          </div>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Status</span>
          <span className="admin-account-info-value">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 600, fontSize: '0.82rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Active
            </span>
          </span>
        </div>
        <div className="admin-account-info-row">
          <span className="admin-account-info-label">Duration</span>
          <span className="admin-account-info-value">Session active</span>
        </div>
      </div>

      {/* Settings Placeholder */}
      <div className="admin-card admin-account-section" style={{ opacity: 0.5, pointerEvents: 'none' }}>
        <div className="admin-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="admin-stat-icon" style={{ background: '#f1f5f9', color: '#94a3b8', width: 40, height: 40 }}>
              <Settings size={20} />
            </div>
            <div className="admin-card-title" style={{ color: '#94a3b8' }}>Settings</div>
          </div>
        </div>
        <div className="admin-account-placeholder">
          <div className="admin-account-placeholder-title">Settings Coming Soon</div>
          <div className="admin-account-placeholder-desc">
            Account settings will be available in a future update.
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
