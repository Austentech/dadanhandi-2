/**
 * LoginPromptModal
 * ----------------
 * Shown when a guest user clicks "Add to Plate".
 *
 * Behaviour (UPDATED per user request):
 *  - Now uses the GLOBAL TOAST system instead of a centered modal.
 *  - Toast appears centered on every device screen.
 *  - Auto-dismisses after 5 seconds.
 *  - Has a "Login" action button that opens the existing AuthModal.
 *  - User can dismiss manually via the toast's X button or by clicking the
 *    toast body.
 *
 * Why a toast instead of a modal?
 *   - Less intrusive (doesn't block the page).
 *   - Auto-dismisses so user doesn't have to take action.
 *   - Visible on every device without overlay/scroll issues.
 *   - User explicitly asked for this in their feedback.
 *
 * Note: This component renders nothing visible — it only TRIGGERS the toast
 * on mount via the toast store. The actual toast UI lives in ToastCenter.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useToastStore } from '@/store/toast-store'

interface LoginPromptModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginPromptModal({ isOpen, onClose }: LoginPromptModalProps) {
  const { openAuthModal } = useAuthContext()
  const pushToast = useToastStore((s) => s.pushToast)
  const removeToast = useToastStore((s) => s.removeToast)
  const toastIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      // If user closed parent state while toast still on screen, remove it
      if (toastIdRef.current) {
        removeToast(toastIdRef.current)
        toastIdRef.current = null
      }
      return
    }

    // Avoid duplicate toasts — if one is already shown, don't add another
    if (toastIdRef.current) return

    const handleLogin = () => {
      // Remove the toast first, then open the auth modal
      if (toastIdRef.current) {
        removeToast(toastIdRef.current)
        toastIdRef.current = null
      }
      onClose()
      openAuthModal('login')
    }

    const id = pushToast({
      type: 'warning',
      title: 'Login Required',
      message: 'Please log in to add items to your plate.',
      durationMs: 5000,
      actionLabel: 'Login',
      onAction: handleLogin,
    })
    toastIdRef.current = id

    // Poll the store — when the toast disappears (auto-dismiss or manual
    // close), sync the parent's isOpen state so it can be opened again.
    const poll = setInterval(() => {
      const stillExists = useToastStore.getState().toasts.some((t) => t.id === id)
      if (!stillExists) {
        clearInterval(poll)
        toastIdRef.current = null
        onClose()
      }
    }, 250)

    return () => {
      clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  return null
}
