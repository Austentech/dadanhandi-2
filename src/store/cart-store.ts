/**
 * Cart Store (zustand)
 * --------------------
 * Client-side cart state with optimistic updates + DB sync.
 *
 * AUTH MODEL:
 *  - Guest users: cart is empty in memory; can never have items (server rejects).
 *  - Logged-in users: cart is loaded from server on first mount; every mutation
 *    is sent to the server, and on success the server-returned cart REPLACES
 *    local state (server is source of truth).
 *
 * OPTIMISTIC UPDATES:
 *  - We update local state IMMEDIATELY for instant UI feedback.
 *  - We then call the API; on failure we ROLLBACK to the previous state.
 *  - On success we replace with server state (handles merge logic correctly).
 */

'use client'

import { create } from 'zustand'
import type { CartItem, CartTotals, AddToCartRequest, UpdateCartQuantityRequest, RemoveFromCartRequest } from '@/types/menu'
import { calculateCartTotals } from '@/lib/pricing'

// ============================================================================
// TYPES
// ============================================================================
interface CartState {
  // State
  items: CartItem[]
  totals: CartTotals
  isLoading: boolean  // true while a server op is in-flight
  isInitialized: boolean  // true after first server fetch completed
  lastError: string | null

  // Actions
  initFromServer: () => Promise<void>
  addItem: (req: AddToCartRequest) => Promise<{ success: boolean; message: string }>
  updateQuantity: (req: UpdateCartQuantityRequest) => Promise<{ success: boolean; message: string }>
  removeItem: (req: RemoveFromCartRequest) => Promise<{ success: boolean; message: string }>
  clear: () => Promise<{ success: boolean; message: string }>
  reset: () => void
}

const EMPTY_TOTALS: CartTotals = {
  subtotalPaise: 0,
  totalItems: 0,
  totalLines: 0,
  subtotalDisplay: '₹0',
  taxesPaise: 0,
  deliveryFeePaise: 0,
  discountPaise: 0,
  grandTotalPaise: 0,
  grandTotalDisplay: '₹0',
}

// ============================================================================
// STORE
// ============================================================================
export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  totals: EMPTY_TOTALS,
  isLoading: false,
  isInitialized: false,
  lastError: null,

  // --------------------------------------------------------------------------
  // INIT FROM SERVER
  // --------------------------------------------------------------------------
  initFromServer: async () => {
    if (get().isInitialized) return
    set({ isLoading: true, lastError: null })

    try {
      const res = await fetch('/api/cart/get', { method: 'GET' })
      const data = await res.json()

      if (data.success && data.data) {
        const items = (data.data.cart || []) as CartItem[]
        const totals = (data.data.totals || calculateCartTotals(items)) as CartTotals
        set({
          items,
          totals,
          isLoading: false,
          isInitialized: true,
          lastError: null,
        })
      } else {
        // Not authenticated — empty cart
        set({
          items: [],
          totals: EMPTY_TOTALS,
          isLoading: false,
          isInitialized: true,
          lastError: null,
        })
      }
    } catch {
      set({
        items: [],
        totals: EMPTY_TOTALS,
        isLoading: false,
        isInitialized: true,
        lastError: 'Failed to load cart. Please refresh.',
      })
    }
  },

  // --------------------------------------------------------------------------
  // ADD ITEM
  // --------------------------------------------------------------------------
  addItem: async (req) => {
    set({ isLoading: true, lastError: null })

    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      const data = await res.json()

      if (data.success && data.data) {
        const items = data.data.cart as CartItem[]
        const totals = data.data.totals as CartTotals
        set({ items, totals, isLoading: false })
        return { success: true, message: data.message || 'Added to plate.' }
      }

      set({ isLoading: false, lastError: data.message })
      return { success: false, message: data.message || 'Failed to add item.' }
    } catch {
      set({ isLoading: false, lastError: 'Network error.' })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  // --------------------------------------------------------------------------
  // UPDATE QUANTITY
  // --------------------------------------------------------------------------
  updateQuantity: async (req) => {
    // Optimistic: update local first
    const prevItems = get().items
    const optimisticItems = prevItems.map((it) =>
      it.lineKey === req.lineKey ? { ...it, quantity: req.quantity } : it,
    )
    set({ items: optimisticItems, totals: calculateCartTotals(optimisticItems) })

    try {
      const res = await fetch('/api/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      const data = await res.json()

      if (data.success && data.data) {
        const items = data.data.cart as CartItem[]
        const totals = data.data.totals as CartTotals
        set({ items, totals, isLoading: false, lastError: null })
        return { success: true, message: data.message }
      }

      // Rollback
      set({ items: prevItems, totals: calculateCartTotals(prevItems), isLoading: false, lastError: data.message })
      return { success: false, message: data.message || 'Failed to update quantity.' }
    } catch {
      // Rollback
      set({ items: prevItems, totals: calculateCartTotals(prevItems), isLoading: false, lastError: 'Network error.' })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  // --------------------------------------------------------------------------
  // REMOVE ITEM
  // --------------------------------------------------------------------------
  removeItem: async (req) => {
    const prevItems = get().items
    const optimisticItems = prevItems.filter((it) => it.lineKey !== req.lineKey)
    set({ items: optimisticItems, totals: calculateCartTotals(optimisticItems) })

    try {
      const res = await fetch('/api/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      const data = await res.json()

      if (data.success && data.data) {
        const items = data.data.cart as CartItem[]
        const totals = data.data.totals as CartTotals
        set({ items, totals, isLoading: false, lastError: null })
        return { success: true, message: data.message }
      }

      // Rollback
      set({ items: prevItems, totals: calculateCartTotals(prevItems), isLoading: false, lastError: data.message })
      return { success: false, message: data.message || 'Failed to remove item.' }
    } catch {
      // Rollback
      set({ items: prevItems, totals: calculateCartTotals(prevItems), isLoading: false, lastError: 'Network error.' })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  // --------------------------------------------------------------------------
  // CLEAR
  // --------------------------------------------------------------------------
  clear: async () => {
    const prevItems = get().items
    set({ items: [], totals: EMPTY_TOTALS })

    try {
      const res = await fetch('/api/cart/clear', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        set({ items: [], totals: EMPTY_TOTALS, isLoading: false, lastError: null })
        return { success: true, message: data.message }
      }

      // Rollback
      set({ items: prevItems, totals: calculateCartTotals(prevItems), isLoading: false, lastError: data.message })
      return { success: false, message: data.message || 'Failed to clear plate.' }
    } catch {
      // Rollback
      set({ items: prevItems, totals: calculateCartTotals(prevItems), isLoading: false, lastError: 'Network error.' })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  // --------------------------------------------------------------------------
  // RESET (on logout)
  // --------------------------------------------------------------------------
  reset: () => {
    set({
      items: [],
      totals: EMPTY_TOTALS,
      isLoading: false,
      isInitialized: false,
      lastError: null,
    })
  },
}))

// ============================================================================
// SELECTORS (memoized helpers for components)
// ============================================================================
export const selectCartCount = (s: CartState) => s.totals.totalItems
export const selectCartTotal = (s: CartState) => s.totals.subtotalDisplay
export const selectCartItems = (s: CartState) => s.items
export const selectIsLoading = (s: CartState) => s.isLoading
