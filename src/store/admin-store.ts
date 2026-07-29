/**
 * Admin Store (Zustand)
 * Manages admin auth state, sidebar, and common UI state.
 */

'use client'

import { create } from 'zustand'

export type AdminTab = 'dashboard' | 'account' | 'menu' | 'orders-new' | 'orders-ongoing' | 'orders-past' | 'orders-cancelled'

interface AdminStoreState {
  // Auth
  isAuthenticated: boolean
  isLoadingAuth: boolean
  adminUser: {
    id: string
    name: string
    email_masked: string
    role: string
    last_login_at: string | null
  } | null

  // OTP Login
  otpEmail: string
  otpSent: boolean
  isSendingOtp: boolean
  otpError: string | null
  otpMessage: string | null
  isVerifyingOtp: boolean
  otpDigits: string[]

  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean

  // Actions
  setOtpEmail: (email: string) => void
  sendOtp: () => Promise<boolean>
  setOtpDigits: (digits: string[]) => void
  verifyOtp: () => Promise<boolean>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  reset: () => void
}

const initialState = {
  isAuthenticated: false,
  isLoadingAuth: true,
  adminUser: null as AdminStoreState['adminUser'],

  otpEmail: '',
  otpSent: false,
  isSendingOtp: false,
  otpError: null as string | null,
  otpMessage: null as string | null,
  isVerifyingOtp: false,
  otpDigits: ['', '', '', '', '', ''],

  sidebarOpen: false,
  sidebarCollapsed: false,
}

export const useAdminStore = create<AdminStoreState>((set, get) => ({
  ...initialState,

  setOtpEmail: (email) => set({ otpEmail: email, otpError: null, otpMessage: null }),

  sendOtp: async () => {
    const { otpEmail } = get()
    if (!otpEmail) {
      set({ otpError: 'Please enter your email address.' })
      return false
    }
    set({ isSendingOtp: true, otpError: null, otpMessage: null })
    try {
      const res = await fetch('/api/admin/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail }),
      })
      const result = await res.json()
      if (result.success) {
        set({ isSendingOtp: false, otpSent: true, otpMessage: result.message })
        return true
      }
      set({ isSendingOtp: false, otpError: result.message })
      return false
    } catch {
      set({ isSendingOtp: false, otpError: 'Network error. Please try again.' })
      return false
    }
  },

  setOtpDigits: (digits) => set({ otpDigits: digits, otpError: null }),

  verifyOtp: async () => {
    const { otpEmail, otpDigits } = get()
    const otp = otpDigits.join('')
    if (otp.length !== 6) {
      set({ otpError: 'Please enter all 6 digits.' })
      return false
    }
    set({ isVerifyingOtp: true, otpError: null })
    try {
      const res = await fetch('/api/admin/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, otp }),
      })
      const result = await res.json()
      if (result.success) {
        set({ isVerifyingOtp: false, isAuthenticated: true })
        return true
      }
      set({ isVerifyingOtp: false, otpError: result.message })
      return false
    } catch {
      set({ isVerifyingOtp: false, otpError: 'Network error. Please try again.' })
      return false
    }
  },

  logout: async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    set({ ...initialState, isLoadingAuth: false })
    window.location.href = '/admin/login'
  },

  checkSession: async () => {
    set({ isLoadingAuth: true })
    try {
      const res = await fetch('/api/admin/auth/session')
      const result = await res.json()
      if (result.authenticated && result.user) {
        set({ isAuthenticated: true, isLoadingAuth: false, adminUser: result.user })
      } else {
        set({ isAuthenticated: false, isLoadingAuth: false, adminUser: null })
      }
    } catch {
      set({ isAuthenticated: false, isLoadingAuth: false, adminUser: null })
    }
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  reset: () => set({ ...initialState, isLoadingAuth: false }),
}))
