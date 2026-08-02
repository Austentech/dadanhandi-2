/**
 * Admin Store (Zustand)
 * Manages admin auth state, sidebar, and common UI state.
 */

'use client'

import { create } from 'zustand'
import { ADMIN_CONFIG } from '@/lib/admin/config'

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

  // Sidebar
  sidebarOpen: boolean
  sidebarCollapsed: boolean

  // Dashboard (for realtime updates)
  dashboardStats: DashboardStats | null

  // Actions
  setOtpEmail: (email: string) => void
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  reset: () => void
  setDashboardStats: (stats: DashboardStats) => void
}

export interface DashboardStats {
  todayOrders: number
  pendingOrders: number
  acceptedOrders: number
  preparingOrders: number
  readyOrders: number
  completedOrders: number
  cancelledOrders: number
  upcomingOrders: number
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

  sidebarOpen: false,
  sidebarCollapsed: false,

  dashboardStats: null as DashboardStats | null,
}

// ---- Session check deduplication ----
// Prevents concurrent checkSession() calls from multiple components
// (login page, AdminShell, etc.) causing state thrashing / UI freeze.
let _sessionPromise: Promise<void> | null = null

export const useAdminStore = create<AdminStoreState>((set, get) => ({
  ...initialState,

  setOtpEmail: (email) => set({ otpEmail: email, otpError: null, otpMessage: null }),

  logout: async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    _sessionPromise = null
    set({ ...initialState, isLoadingAuth: false })
    window.location.href = '/admin/login'
  },

  checkSession: async () => {
    // If a session check is already in-flight, piggyback on it.
    if (_sessionPromise) return _sessionPromise

    _sessionPromise = (async () => {
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
      } finally {
        _sessionPromise = null
      }
    })()

    return _sessionPromise
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  reset: () => {
    _sessionPromise = null
    set({ ...initialState, isLoadingAuth: false })
  },

  setDashboardStats: (stats) => set({ dashboardStats: stats }),
}))
