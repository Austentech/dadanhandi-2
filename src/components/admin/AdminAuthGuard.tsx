'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminStore } from '@/store/admin-store'

/**
 * AdminAuthGuard — wraps admin pages to verify auth before rendering.
 * Shows a full-page loading spinner while checking the session.
 * Redirects to /admin/login if not authenticated.
 */
export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoadingAuth, checkSession } = useAdminStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      router.replace('/admin/login')
    }
  }, [isLoadingAuth, isAuthenticated, router])

  // Still checking session
  if (isLoadingAuth) {
    return (
      <div className="admin-auth-loading">
        <div className="admin-auth-spinner" />
        <span className="admin-auth-loading-text">Verifying session...</span>
      </div>
    )
  }

  // Not authenticated — will redirect via useEffect
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
