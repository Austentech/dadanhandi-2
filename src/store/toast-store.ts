/**
 * Toast Store (zustand)
 * ---------------------
 * Global toast/alert popup system.
 *
 * Use `pushToast` from anywhere in the app to show a centered, auto-dismissing
 * alert popup. The popup:
 *   - Renders in the center of the viewport on every device
 *   - Auto-closes after 5 seconds
 *   - Has a manual X close button (user can dismiss early)
 *   - Stacks vertically if multiple toasts are active
 *
 * Usage:
 *   import { useToastStore } from '@/store/toast-store'
 *   const { pushToast } = useToastStore()
 *   pushToast({ type: 'error', title: 'Login Required', message: 'Please log in to add items.' })
 *
 * OR use the helper (recommended — does not require hook):
 *   import { toast } from '@/store/toast-store'
 *   toast.error('Login Required', 'Please log in to add items.')
 *   toast.success('Added!', 'Item added to your plate.')
 *   toast.info('Heads up', 'Pickup orders only.')
 */

'use client'

import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  durationMs: number  // 0 = no auto-close
  createdAt: number
}

interface ToastState {
  toasts: ToastItem[]

  pushToast: (opts: {
    type: ToastType
    title: string
    message?: string
    durationMs?: number  // default 5000
  }) => string  // returns id

  removeToast: (id: string) => void
  clearAll: () => void
}

const DEFAULT_DURATION = 5000

function genId(): string {
  // Crypto.randomUUID if available, fallback to timestamp+random
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  pushToast: ({ type, title, message, durationMs = DEFAULT_DURATION }) => {
    const id = genId()
    const item: ToastItem = {
      id,
      type,
      title,
      message,
      durationMs,
      createdAt: Date.now(),
    }
    set((state) => ({ toasts: [...state.toasts, item] }))
    return id
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },

  clearAll: () => set({ toasts: [] }),
}))

/**
 * Helper API — use outside React components or in event handlers
 * without needing the hook.
 *
 * Example:
 *   import { toast } from '@/store/toast-store'
 *   toast.error('Oops', 'Something went wrong.')
 */
export const toast = {
  success: (title: string, message?: string, durationMs?: number) =>
    useToastStore.getState().pushToast({ type: 'success', title, message, durationMs }),
  error: (title: string, message?: string, durationMs?: number) =>
    useToastStore.getState().pushToast({ type: 'error', title, message, durationMs }),
  info: (title: string, message?: string, durationMs?: number) =>
    useToastStore.getState().pushToast({ type: 'info', title, message, durationMs }),
  warning: (title: string, message?: string, durationMs?: number) =>
    useToastStore.getState().pushToast({ type: 'warning', title, message, durationMs }),
  remove: (id: string) => useToastStore.getState().removeToast(id),
  clearAll: () => useToastStore.getState().clearAll(),
}
