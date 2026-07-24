'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'

interface UserDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const DRAWER_ITEMS = [
  { icon: 'fas fa-user', label: 'My Account', href: '/account' },
  { icon: 'fas fa-box', label: 'Order History', href: '/account?tab=orders' },
  { icon: 'fas fa-truck', label: 'Ongoing Orders', href: '/account?tab=ongoing' },
  { icon: 'fas fa-map-marker-alt', label: 'Saved Addresses', href: '/account?tab=addresses' },
]

export default function UserDrawer({ isOpen, onClose }: UserDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const { user, profile, signOut } = useAuth()

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Outside click to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === drawerRef.current) onClose()
    },
    [onClose]
  )

  const handleSignOut = useCallback(async () => {
    await signOut()
    onClose()
  }, [signOut, onClose])

  const firstName = profile?.full_name?.split(' ')[0] ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    'User'

  if (!isOpen) return null

  return (
    <div
      ref={drawerRef}
      className="user-drawer-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="User Menu"
    >
      <div className="user-drawer">
        {/* User Info Header */}
        <div className="user-drawer-header">
          <button className="user-drawer-close" onClick={onClose} aria-label="Close menu">
            <i className="fas fa-times"></i>
          </button>
          <div className="user-drawer-avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={firstName} />
            ) : (
              <div className="user-drawer-avatar-fallback">
                {firstName[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <h3 className="user-drawer-name">{firstName}</h3>
          {profile?.email && (
            <p className="user-drawer-email">{profile.email}</p>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="user-drawer-nav" aria-label="User navigation">
          {DRAWER_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="user-drawer-item"
              onClick={onClose}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
              <i className="fas fa-chevron-right user-drawer-arrow"></i>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="user-drawer-footer">
          <button
            className="user-drawer-logout"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  )
}
