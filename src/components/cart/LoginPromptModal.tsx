/**
 * LoginPromptModal
 * ----------------
 * Shown when a guest user clicks "Add to Plate".
 *
 * Behaviour:
 *  - Two buttons: "Login" and "Cancel"
 *  - "Login" opens the existing AuthModal in login view (via useAuthContext)
 *  - "Cancel" just closes this modal
 *  - Does NOT auto-redirect — user must explicitly choose.
 */

'use client'

import { useEffect } from 'react'
import { useAuthContext } from '@/components/auth/AuthProvider'

interface LoginPromptModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginPromptModal({ isOpen, onClose }: LoginPromptModalProps) {
  const { openAuthModal } = useAuthContext()

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleLogin = () => {
    onClose()
    openAuthModal('login')
  }

  return (
    <div
      className="menu-notice-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
      onClick={onClose}
    >
      <div
        className="menu-notice-modal login-prompt-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-notice-header">
          <span className="menu-notice-icon">🔐</span>
          <h2 id="login-prompt-title">Login Required</h2>
          <p className="menu-notice-subtitle">
            Please log in to add items to your plate
          </p>
        </div>

        <div className="login-prompt-body">
          <p>
            You can browse the menu and view prices without logging in,
            but to add items to your plate and place an order, please log in
            to your account.
          </p>
        </div>

        <div className="menu-notice-footer">
          <button
            type="button"
            className="menu-notice-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="menu-notice-btn-primary"
            onClick={handleLogin}
            autoFocus
          >
            <i className="fas fa-sign-in-alt" style={{ marginRight: 6 }}></i>
            Login
          </button>
        </div>
      </div>
    </div>
  )
}
