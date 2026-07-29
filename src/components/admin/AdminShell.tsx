'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAdminStore } from '@/store/admin-store'
import {
  LayoutDashboard,
  User,
  UtensilsCrossed,
  Package,
  Truck,
  Archive,
  XCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Nav definition
// ---------------------------------------------------------------------------
interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Account', href: '/admin/account', icon: <User size={18} /> },
  { label: 'Menu', href: '/admin/menu', icon: <UtensilsCrossed size={18} /> },
]

const ORDER_ITEMS: NavItem[] = [
  { label: 'New Orders', href: '/admin/orders/new', icon: <Package size={18} /> },
  { label: 'Ongoing', href: '/admin/orders/ongoing', icon: <Truck size={18} /> },
  { label: 'Past Orders', href: '/admin/orders/past', icon: <Archive size={18} /> },
  { label: 'Cancelled', href: '/admin/orders/cancelled', icon: <XCircle size={18} /> },
]

// ---------------------------------------------------------------------------
// AdminShell component
// ---------------------------------------------------------------------------
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const {
    isAuthenticated,
    isLoadingAuth,
    adminUser,
    sidebarCollapsed,
    sidebarOpen,
    checkSession,
    logout,
    setSidebarOpen,
    toggleSidebarCollapsed,
  } = useAdminStore()

  // Check session on mount
  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Redirect if not authenticated after loading
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      router.replace('/admin/login')
    }
  }, [isLoadingAuth, isAuthenticated, router])

  // Close mobile sidebar on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false)
      }
    },
    [sidebarOpen, setSidebarOpen],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href)
      setSidebarOpen(false) // close mobile sidebar on nav
    },
    [router, setSidebarOpen],
  )

  const handleLogout = useCallback(async () => {
    await logout()
  }, [logout])

  // Derived state
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const sidebarMainClass = sidebarCollapsed
    ? 'admin-shell-main sidebar-collapsed'
    : 'admin-shell-main sidebar-expanded'

  const initials = useMemo(() => {
    if (!adminUser?.name) return 'A'
    const parts = adminUser.name.trim().split(/\s+/)
    return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2)
  }, [adminUser?.name])

  // Loading state
  if (isLoadingAuth) {
    return (
      <div className="admin-auth-loading">
        <div className="admin-auth-spinner" />
        <span className="admin-auth-loading-text">Verifying session...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="admin-shell">
      {/* ---------- Sidebar Column ---------- */}
      <div
        className={`admin-shell-sidebar-col ${sidebarOpen ? 'mobile-open' : ''}`}
      >
        <aside className={`admin-shell-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'mobile-open' : ''}`}>
          {/* Brand */}
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-brand-title">DH Admin</div>
            <div className="admin-sidebar-brand-sub">Dadan Handi</div>
          </div>

          {/* Main Nav */}
          <div className="admin-sidebar-section">
            <div className="admin-sidebar-section-title">Main</div>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <button
                  key={item.href}
                  className={`admin-sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigateTo(item.href)}
                  title={item.label}
                >
                  <span className="admin-sidebar-nav-icon">{item.icon}</span>
                  <span className="admin-sidebar-label">{item.label}</span>
                </button>
              )
            })}

            <div className="admin-sidebar-section-title" style={{ marginTop: 16 }}>
              Orders
            </div>
            {ORDER_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <button
                  key={item.href}
                  className={`admin-sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => navigateTo(item.href)}
                  title={item.label}
                >
                  <span className="admin-sidebar-nav-icon">{item.icon}</span>
                  <span className="admin-sidebar-label">{item.label}</span>
                </button>
              )
            })}
          </div>

          {/* Footer — Logout */}
          <div className="admin-sidebar-footer">
            <button className="admin-sidebar-logout" onClick={handleLogout}>
              <LogOut size={18} className="admin-sidebar-logout-icon" />
              <span className="admin-sidebar-logout-text">Logout</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ---------- Mobile Backdrop ---------- */}
      <div
        className={`admin-mobile-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ---------- Main Content ---------- */}
      <div className={sidebarMainClass}>
        {/* Header */}
        <header className="admin-header">
          <div className="admin-header-left">
            {/* Collapse toggle — visible on tablet+ */}
            <button
              className="admin-header-toggle"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            {/* Mobile hamburger */}
            <button
              className="admin-header-mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          </div>

          <div className="admin-header-right">
            {adminUser && (
              <div className="admin-header-user-info">
                <div className="admin-header-avatar">{initials}</div>
                <div className="admin-header-user-details">
                  <span className="admin-header-user-name">{adminUser.name}</span>
                  <span className="admin-header-user-email">{adminUser.email_masked}</span>
                </div>
                <span className="admin-header-role-badge">{adminUser.role.replace('_', ' ')}</span>
              </div>
            )}

            {/* Mobile avatar only */}
            {adminUser && (
              <button
                className="admin-header-mobile-menu"
                onClick={() => setSidebarOpen(true)}
                aria-label="User menu"
              >
                <div className="admin-header-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
                  {initials}
                </div>
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-shell-content">{children}</main>
      </div>
    </div>
  )
}
