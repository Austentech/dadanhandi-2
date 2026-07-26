/**
 * Checkout Store (zustand)
 * ------------------------
 * Client-side state for the multi-step checkout flow.
 *
 * RESPONSIBILITIES:
 *  - Hold the user's selections (branch, slot, donations, reward points)
 *  - Hold the server-validated final amount
 *  - Hold the created order ID + Stripe client_secret (after step 5)
 *  - Track loading / error states for each API call
 *  - Provide actions: validateCheckout, createOrder, fetchRewardBalance,
 *    fetchPickupSlots, fetchBranches, fetchOrderStatus, cancelOrder
 *
 * SECURITY NOTE:
 *  - The client store holds a COPY of the validated amount for display.
 *  - The server re-validates everything before creating the order —
 *    the client's copy is for UX only, never trusted.
 *  - The Stripe client_secret IS safe to store client-side (it's designed
 *    to be embedded in client code; it can only be used to confirm the
 *    specific PaymentIntent it belongs to).
 */

'use client'

import { create } from 'zustand'
import type {
  Branch,
  PickupSlot,
  DonationSelection,
  ValidateCheckoutResponse,
  CreateOrderResponse,
} from '@/types/checkout'
import type { CartItem, CartTotals, Paise } from '@/types/menu'

// ============================================================================
// TYPES
// ============================================================================
interface CheckoutStoreState {
  // -------- STEP STATE --------
  currentStep: number  // 1-indexed
  branchSlug: string | null
  pickupSlotKey: string | null
  donations: DonationSelection
  rewardPointsToRedeem: number
  customerNotes: string

  // -------- LOADED DATA --------
  branches: Branch[]
  pickupSlots: PickupSlot[]
  cartItems: CartItem[]
  cartTotals: CartTotals | null
  rewardBalance: number  // user's current reward points
  stripePublishableKey: string | null

  // -------- SERVER-VALIDATED STATE (from /api/checkout/validate) --------
  validatedSubtotalPaise: Paise | null
  validatedDonationPlantationPaise: Paise | null
  validatedDonationHungerPaise: Paise | null
  validatedRewardPointsRedeemed: number
  validatedRewardDiscountPaise: Paise | null
  validatedFinalAmountPaise: Paise | null
  potentialPointsToEarn: number

  // -------- CREATED ORDER --------
  orderId: string | null
  orderNumber: string | null
  clientSecret: string | null
  idempotencyKey: string | null

  // -------- UI STATE --------
  isValidating: boolean
  isCreatingOrder: boolean
  isFetchingBalance: boolean
  isFetchingSlots: boolean
  isFetchingBranches: boolean
  isPollingOrder: boolean
  error: string | null

  // -------- ACTIONS --------
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setBranch: (slug: string) => void
  setPickupSlot: (key: string) => void
  setDonations: (d: Partial<DonationSelection>) => void
  setRewardPointsToRedeem: (n: number) => void
  setCustomerNotes: (s: string) => void

  fetchConfig: () => Promise<void>
  fetchBranches: () => Promise<void>
  fetchPickupSlots: () => Promise<void>
  fetchRewardBalance: () => Promise<void>
  fetchCart: () => Promise<void>

  validateCheckout: () => Promise<{ success: boolean; message: string }>
  createOrder: () => Promise<{ success: boolean; message: string; data?: CreateOrderResponse['data'] }>
  pollOrderStatus: (orderId: string) => Promise<{ success: boolean; orderStatus?: string; message?: string }>
  cancelOrder: (orderId: string) => Promise<{ success: boolean; message: string }>

  reset: () => void
  setError: (msg: string | null) => void
}

// ============================================================================
// INITIAL STATE
// ============================================================================
const initialState = {
  currentStep: 1,
  branchSlug: null,
  pickupSlotKey: null,
  donations: { plantation: false, hunger: false } as DonationSelection,
  rewardPointsToRedeem: 0,
  customerNotes: '',

  branches: [] as Branch[],
  pickupSlots: [] as PickupSlot[],
  cartItems: [] as CartItem[],
  cartTotals: null as CartTotals | null,
  rewardBalance: 0,
  stripePublishableKey: null as string | null,

  validatedSubtotalPaise: null as Paise | null,
  validatedDonationPlantationPaise: null as Paise | null,
  validatedDonationHungerPaise: null as Paise | null,
  validatedRewardPointsRedeemed: 0,
  validatedRewardDiscountPaise: null as Paise | null,
  validatedFinalAmountPaise: null as Paise | null,
  potentialPointsToEarn: 0,

  orderId: null as string | null,
  orderNumber: null as string | null,
  clientSecret: null as string | null,
  idempotencyKey: null as string | null,

  isValidating: false,
  isCreatingOrder: false,
  isFetchingBalance: false,
  isFetchingSlots: false,
  isFetchingBranches: false,
  isPollingOrder: false,
  error: null as string | null,
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a fresh idempotency key. Used when starting a new checkout
 * attempt. The key is stored in the checkout store and submitted with
 * the create-order request.
 */
function generateIdempotencyKey(): string {
  // Use crypto.randomUUID if available (modern browsers), else fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: timestamp + random string
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ============================================================================
// STORE
// ============================================================================
export const useCheckoutStore = create<CheckoutStoreState>((set, get) => ({
  ...initialState,

  // --------------------------------------------------------------------------
  // STEP NAVIGATION
  // --------------------------------------------------------------------------
  setStep: (step) => {
    if (step < 1 || step > 6) return
    set({ currentStep: step, error: null })
  },

  nextStep: () => {
    const s = get().currentStep
    if (s < 6) set({ currentStep: s + 1, error: null })
  },

  prevStep: () => {
    const s = get().currentStep
    if (s > 1) set({ currentStep: s - 1, error: null })
  },

  // --------------------------------------------------------------------------
  // SETTERS
  // --------------------------------------------------------------------------
  setBranch: (slug) => {
    set({ branchSlug: slug, error: null })
  },

  setPickupSlot: (key) => {
    set({ pickupSlotKey: key, error: null })
  },

  setDonations: (d) => {
    set((state) => ({ donations: { ...state.donations, ...d }, error: null }))
  },

  setRewardPointsToRedeem: (n) => {
    // Clamp to >= 0 and multiple of 10
    let clamped = Math.max(0, Math.floor(n))
    if (clamped > 0 && clamped % 10 !== 0) {
      clamped = Math.floor(clamped / 10) * 10
    }
    set({ rewardPointsToRedeem: clamped, error: null })
  },

  setCustomerNotes: (s) => {
    set({ customerNotes: s.slice(0, 500), error: null })
  },

  // --------------------------------------------------------------------------
  // FETCH CONFIG (Stripe publishable key + constants)
  // --------------------------------------------------------------------------
  fetchConfig: async () => {
    try {
      const res = await fetch('/api/checkout/config')
      const data = await res.json()
      if (data.success && data.data) {
        set({ stripePublishableKey: data.data.stripePublishableKey })
      }
    } catch {
      // Non-critical — payment step will show error if no key
    }
  },

  // --------------------------------------------------------------------------
  // FETCH BRANCHES
  // --------------------------------------------------------------------------
  fetchBranches: async () => {
    set({ isFetchingBranches: true })
    try {
      const res = await fetch('/api/branches')
      const data = await res.json()
      if (data.success && data.data) {
        set({ branches: data.data.branches, isFetchingBranches: false })
      } else {
        set({ isFetchingBranches: false })
      }
    } catch {
      set({ isFetchingBranches: false })
    }
  },

  // --------------------------------------------------------------------------
  // FETCH PICKUP SLOTS
  // --------------------------------------------------------------------------
  fetchPickupSlots: async () => {
    set({ isFetchingSlots: true })
    try {
      const res = await fetch('/api/checkout/pickup-slots')
      const data = await res.json()
      if (data.success && data.data) {
        set({
          pickupSlots: data.data.slots,
          isFetchingSlots: false,
        })
      } else {
        set({ isFetchingSlots: false })
      }
    } catch {
      set({ isFetchingSlots: false })
    }
  },

  // --------------------------------------------------------------------------
  // FETCH REWARD BALANCE
  // --------------------------------------------------------------------------
  fetchRewardBalance: async () => {
    set({ isFetchingBalance: true })
    try {
      const res = await fetch('/api/rewards/balance')
      const data = await res.json()
      if (data.success && data.data) {
        set({
          rewardBalance: data.data.balancePoints,
          isFetchingBalance: false,
        })
      } else {
        set({ isFetchingBalance: false })
      }
    } catch {
      set({ isFetchingBalance: false })
    }
  },

  // --------------------------------------------------------------------------
  // FETCH CART (from existing cart API)
  // --------------------------------------------------------------------------
  fetchCart: async () => {
    try {
      const res = await fetch('/api/cart/get')
      const data = await res.json()
      if (data.success && data.data) {
        set({
          cartItems: data.data.cart || [],
          cartTotals: data.data.totals || null,
        })
      } else {
        set({ cartItems: [], cartTotals: null })
      }
    } catch {
      set({ cartItems: [], cartTotals: null })
    }
  },

  // --------------------------------------------------------------------------
  // VALIDATE CHECKOUT
  // --------------------------------------------------------------------------
  validateCheckout: async () => {
    const { branchSlug, pickupSlotKey, donations, rewardPointsToRedeem } = get()

    if (!branchSlug) {
      set({ error: 'Please select a pickup branch.' })
      return { success: false, message: 'Please select a pickup branch.' }
    }
    if (!pickupSlotKey) {
      set({ error: 'Please select a pickup time.' })
      return { success: false, message: 'Please select a pickup time.' }
    }

    set({ isValidating: true, error: null })

    try {
      const res = await fetch('/api/checkout/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchSlug,
          pickupSlotKey,
          donations,
          rewardPointsToRedeem,
        }),
      })
      const data: ValidateCheckoutResponse = await res.json()

      if (data.success && data.data) {
        set({
          isValidating: false,
          validatedSubtotalPaise: data.data.subtotalPaise,
          validatedDonationPlantationPaise: data.data.donationPlantationPaise,
          validatedDonationHungerPaise: data.data.donationHungerPaise,
          validatedRewardPointsRedeemed: data.data.rewardPointsRedeemed,
          validatedRewardDiscountPaise: data.data.rewardDiscountPaise,
          validatedFinalAmountPaise: data.data.finalAmountPaise,
          potentialPointsToEarn: data.data.potentialPointsToEarn,
          rewardBalance: data.data.rewardBalance,
        })
        return { success: true, message: data.message }
      }

      set({ isValidating: false, error: data.message })
      return { success: false, message: data.message }
    } catch {
      set({
        isValidating: false,
        error: 'Network error. Please check your connection and try again.',
      })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  // --------------------------------------------------------------------------
  // CREATE ORDER (creates draft order + Stripe PaymentIntent)
  // --------------------------------------------------------------------------
  createOrder: async () => {
    const state = get()
    const { branchSlug, pickupSlotKey, donations, rewardPointsToRedeem, customerNotes } = state

    if (!branchSlug || !pickupSlotKey) {
      return { success: false, message: 'Missing branch or pickup slot.' }
    }

    // Generate idempotency key if we don't have one yet
    const idempotencyKey = state.idempotencyKey || generateIdempotencyKey()
    if (!state.idempotencyKey) {
      set({ idempotencyKey })
    }

    set({ isCreatingOrder: true, error: null })

    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchSlug,
          pickupSlotKey,
          donations,
          rewardPointsToRedeem,
          customerNotes,
          idempotencyKey,
        }),
      })
      const data: CreateOrderResponse = await res.json()

      if (data.success && data.data) {
        set({
          isCreatingOrder: false,
          orderId: data.data.orderId,
          orderNumber: data.data.orderNumber,
          clientSecret: data.data.clientSecret,
          validatedFinalAmountPaise: data.data.finalAmountPaise,
        })
        return { success: true, message: data.message, data: data.data }
      }

      set({ isCreatingOrder: false, error: data.message })
      return { success: false, message: data.message }
    } catch {
      set({
        isCreatingOrder: false,
        error: 'Network error. Please try again.',
      })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  // --------------------------------------------------------------------------
  // POLL ORDER STATUS (after Stripe confirms payment)
  // --------------------------------------------------------------------------
  pollOrderStatus: async (orderId) => {
    set({ isPollingOrder: true })
    try {
      const res = await fetch(`/api/checkout/order/${orderId}`)
      const data = await res.json()

      if (data.success && data.data?.order) {
        set({ isPollingOrder: false })
        return {
          success: true,
          orderStatus: data.data.order.orderStatus,
        }
      }

      set({ isPollingOrder: false })
      return { success: false, message: data.message || 'Failed to load order.' }
    } catch {
      set({ isPollingOrder: false })
      return { success: false, message: 'Network error.' }
    }
  },

  // --------------------------------------------------------------------------
  // CANCEL ORDER (abandon checkout)
  // --------------------------------------------------------------------------
  cancelOrder: async (orderId) => {
    try {
      const res = await fetch('/api/checkout/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      return { success: data.success, message: data.message }
    } catch {
      return { success: false, message: 'Network error.' }
    }
  },

  // --------------------------------------------------------------------------
  // RESET (on cancel / success / unmount)
  // --------------------------------------------------------------------------
  reset: () => {
    set({ ...initialState })
  },

  setError: (msg) => set({ error: msg }),
}))
