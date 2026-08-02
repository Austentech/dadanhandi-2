'use client'

/**
 * AdminAuthGuard — thin wrapper that delegates to AdminShell's auth.
 * AdminShell already calls checkSession() and redirects if unauthenticated,
 * so this component is intentionally minimal. It exists as a named export
 * for layout consistency but does NOT call checkSession() itself (which
 * would cause duplicate session requests and session freeze).
 */
export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
