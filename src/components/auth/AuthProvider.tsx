'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import AuthModal from '@/components/auth/AuthModal'
import UserDrawer from '@/components/auth/UserDrawer'
import { useAuth } from '@/hooks/use-auth'
import { useSessionManager } from '@/hooks/use-session-manager'
import type { AuthModalState, UserDrawerState } from '@/types/auth'

interface AuthContextValue {
  openAuthModal: (view?: AuthModalState['view'], email?: string) => void
  closeAuthModal: () => void
  openUserDrawer: () => void
  closeUserDrawer: () => void
  authModalState: AuthModalState
  userDrawerOpen: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authModalState, setAuthModalState] = useState<AuthModalState>({
    isOpen: false,
    view: 'login',
  })
  const [userDrawerOpen, setUserDrawerOpen] = useState(false)

  // Enforce session lifetime rules:
  //  - Force sign-out on fresh browser session (fixes "logged in after deploy")
  //  - Auto sign-out after 30 min of inactivity
  useSessionManager()

  const openAuthModal = useCallback((view: AuthModalState['view'] = 'login', email?: string) => {
    setAuthModalState({ isOpen: true, view, email })
  }, [])

  const closeAuthModal = useCallback(() => {
    setAuthModalState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  const handleViewChange = useCallback((view: AuthModalState['view'], email?: string) => {
    setAuthModalState((prev) => ({ ...prev, view, email }))
  }, [])

  const openUserDrawer = useCallback(() => setUserDrawerOpen(true), [])
  const closeUserDrawer = useCallback(() => setUserDrawerOpen(false), [])

  return (
    <AuthContext.Provider
      value={{
        openAuthModal,
        closeAuthModal,
        openUserDrawer,
        closeUserDrawer,
        authModalState,
        userDrawerOpen,
      }}
    >
      {children}
      <AuthModal
        state={authModalState}
        onClose={closeAuthModal}
        onViewChange={handleViewChange}
      />
      <UserDrawer isOpen={userDrawerOpen} onClose={closeUserDrawer} />
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
