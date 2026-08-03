/**
 * Account Store (zustand)
 * ----------------------
 * Client-side state for the account section.
 * Manages: active tab, profile update, orders, rewards, loading/error states.
 */

'use client'

import { create } from 'zustand'

// ============================================================================
// TYPES
// ============================================================================

export type AccountTab = 'account' | 'orders' | 'ongoing' | 'rewards' | 'order-detail'

export interface ProfileFormData {
  whatsapp_number: string
  mobile_number: string
  area: string
  city: string
  pincode: string
}

export interface OrderListItem {
  id: string
  orderNumber: string
  branchName: string
  pickupDate: string
  pickupSlotStart: string
  pickupSlotEnd: string
  subtotalPaise: number
  donationPlantationPaise: number
  donationHungerPaise: number
  rewardPointsRedeemed: number
  rewardDiscountPaise: number
  finalAmountPaise: number
  rewardPointsEarned: number
  paymentStatus: string
  orderStatus: string
  pickupPin: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderDetailItem {
  lineKey: string
  itemId: string
  variantId: string
  itemName: string
  itemEmoji: string
  itemType: string
  variantLabel: string
  weightGrams: number | null
  pieceCount: number | null
  unitPricePaise: number
  quantity: number
  lineTotalPaise: number
}

export interface OrderStatusEntry {
  status: string
  note: string | null
  createdAt: string
}

export interface OrderDetail {
  id: string
  orderNumber: string
  pickupDate: string
  pickupSlotStart: string
  pickupSlotEnd: string
  subtotalPaise: number
  donationPlantationPaise: number
  donationHungerPaise: number
  rewardPointsRedeemed: number
  rewardDiscountPaise: number
  finalAmountPaise: number
  rewardPointsEarned: number
  paymentStatus: string
  orderStatus: string
  pickupPin: string | null
  customerNotes: string | null
  branch: { name: string; addressLine1: string; city: string } | null
  items: OrderDetailItem[]
  statusHistory: OrderStatusEntry[]
  createdAt: string
  updatedAt: string
}

export interface OngoingOrder {
  id: string
  orderNumber: string
  branchName: string
  pickupDate: string
  pickupSlotStart: string
  pickupSlotEnd: string
  finalAmountPaise: number
  orderStatus: string
  pickupPin: string | null
  pinGeneratedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RewardTransaction {
  id: string
  orderId: string | null
  points: number
  type: string
  reason: string
  balanceAfter: number
  createdAt: string
}

export interface RewardSummary {
  balancePoints: number
  totalEarned: number
  totalRedeemed: number
  redeemableValuePaise: number
  redeemableValueDisplay: string
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================================
// STATE
// ============================================================================

interface AccountStoreState {
  // Navigation
  activeTab: AccountTab
  selectedOrderId: string | null
  setActiveTab: (tab: AccountTab) => void
  viewOrderDetail: (orderId: string) => void
  goBack: () => void

  // Profile Update
  isUpdatingProfile: boolean
  profileUpdateSuccess: string | null
  profileUpdateError: string | null
  updateProfile: (data: ProfileFormData) => Promise<{ success: boolean; message: string }>
  clearProfileMessages: () => void

  // Orders
  orders: OrderListItem[]
  ordersPagination: PaginationInfo | null
  isLoadingOrders: boolean
  ordersError: string | null
  orderFilters: {
    orderStatus: string
    paymentStatus: string
    sortOrder: string
    search: string
  }
  setOrderFilters: (filters: Partial<AccountStoreState['orderFilters']>) => void
  fetchOrders: (page?: number) => Promise<void>

  // Order Detail
  orderDetail: OrderDetail | null
  isLoadingOrderDetail: boolean
  orderDetailError: string | null
  fetchOrderDetail: (orderId: string) => Promise<void>

  // Ongoing Orders
  ongoingOrders: OngoingOrder[]
  isLoadingOngoing: boolean
  ongoingError: string | null
  fetchOngoingOrders: () => Promise<void>

  // Rewards
  rewardSummary: RewardSummary | null
  rewardTransactions: RewardTransaction[]
  rewardsPagination: PaginationInfo | null
  isLoadingRewards: boolean
  rewardsError: string | null
  rewardFilterType: string
  setRewardFilterType: (type: string) => void
  fetchRewards: (page?: number) => Promise<void>

  // Reset
  reset: () => void
}

const initialPagination = { page: 1, limit: 20, total: 0, totalPages: 0 }

const initialState = {
  activeTab: 'account' as AccountTab,
  selectedOrderId: null as string | null,

  isUpdatingProfile: false,
  profileUpdateSuccess: null as string | null,
  profileUpdateError: null as string | null,

  orders: [] as OrderListItem[],
  ordersPagination: null as PaginationInfo | null,
  isLoadingOrders: false,
  ordersError: null as string | null,
  orderFilters: { orderStatus: 'all', paymentStatus: 'all', sortOrder: 'newest', search: '' },

  orderDetail: null as OrderDetail | null,
  isLoadingOrderDetail: false,
  orderDetailError: null as string | null,

  ongoingOrders: [] as OngoingOrder[],
  isLoadingOngoing: false,
  ongoingError: null as string | null,

  rewardSummary: null as RewardSummary | null,
  rewardTransactions: [] as RewardTransaction[],
  rewardsPagination: null as PaginationInfo | null,
  isLoadingRewards: false,
  rewardsError: null as string | null,
  rewardFilterType: 'all',
}

// ============================================================================
// STORE
// ============================================================================

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 'all') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export const useAccountStore = create<AccountStoreState>((set, get) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab, selectedOrderId: null, orderDetail: null, ordersError: null, ongoingError: null, rewardsError: null, orderDetailError: null }),

  viewOrderDetail: (orderId) => set({ activeTab: 'order-detail', selectedOrderId: orderId, orderDetail: null }),

  goBack: () => {
    const { activeTab } = get()
    if (activeTab === 'order-detail') {
      set({ activeTab: 'orders', selectedOrderId: null, orderDetail: null })
    } else {
      set({ activeTab: 'account' })
    }
  },

  // Profile Update
  updateProfile: async (data) => {
    set({ isUpdatingProfile: true, profileUpdateSuccess: null, profileUpdateError: null })
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        set({ isUpdatingProfile: false, profileUpdateSuccess: result.message })
        return { success: true, message: result.message }
      }
      set({ isUpdatingProfile: false, profileUpdateError: result.message })
      return { success: false, message: result.message }
    } catch {
      set({ isUpdatingProfile: false, profileUpdateError: 'Network error. Please try again.' })
      return { success: false, message: 'Network error. Please try again.' }
    }
  },

  clearProfileMessages: () => set({ profileUpdateSuccess: null, profileUpdateError: null }),

  // Orders
  setOrderFilters: (filters) => {
    set({ orderFilters: { ...get().orderFilters, ...filters }, orders: [], ordersPagination: null })
  },

  fetchOrders: async (page = 1) => {
    set({ isLoadingOrders: true, ordersError: null })
    try {
      const { orderFilters } = get()
      const qs = buildQueryString({
        orderStatus: orderFilters.orderStatus,
        paymentStatus: orderFilters.paymentStatus,
        sortOrder: orderFilters.sortOrder,
        search: orderFilters.search || undefined,
        page,
        limit: 20,
      })
      const res = await fetch(`/api/account/orders${qs}`)
      const result = await res.json()
      if (result.success) {
        set({
          orders: result.orders,
          ordersPagination: result.pagination,
          isLoadingOrders: false,
        })
      } else {
        set({ isLoadingOrders: false, ordersError: result.message })
      }
    } catch {
      set({ isLoadingOrders: false, ordersError: 'Failed to load orders.' })
    }
  },

  // Order Detail
  fetchOrderDetail: async (orderId) => {
    set({ isLoadingOrderDetail: true, orderDetailError: null, orderDetail: null })
    try {
      const res = await fetch(`/api/account/orders/${orderId}`)
      const result = await res.json()
      if (result.success) {
        set({ orderDetail: result.order, isLoadingOrderDetail: false })
      } else {
        set({ isLoadingOrderDetail: false, orderDetailError: result.message })
      }
    } catch {
      set({ isLoadingOrderDetail: false, orderDetailError: 'Failed to load order details.' })
    }
  },

  // Ongoing Orders
  fetchOngoingOrders: async () => {
    set({ isLoadingOngoing: true, ongoingError: null })
    try {
      const res = await fetch('/api/account/ongoing-orders')
      const result = await res.json()
      if (result.success) {
        set({ ongoingOrders: result.orders, isLoadingOngoing: false })
      } else {
        set({ isLoadingOngoing: false, ongoingError: result.message })
      }
    } catch {
      set({ isLoadingOngoing: false, ongoingError: 'Failed to load orders.' })
    }
  },

  // Rewards
  setRewardFilterType: (type) => {
    set({ rewardFilterType: type, rewardTransactions: [], rewardsPagination: null })
  },

  fetchRewards: async (page = 1) => {
    set({ isLoadingRewards: true, rewardsError: null })
    try {
      const { rewardFilterType } = get()
      const qs = buildQueryString({
        type: rewardFilterType,
        page,
        limit: 20,
      })
      const res = await fetch(`/api/account/rewards${qs}`)
      const result = await res.json()
      if (result.success) {
        set({
          rewardSummary: result.summary,
          rewardTransactions: result.transactions,
          rewardsPagination: result.pagination,
          isLoadingRewards: false,
        })
      } else {
        set({ isLoadingRewards: false, rewardsError: result.message })
      }
    } catch {
      set({ isLoadingRewards: false, rewardsError: 'Failed to load rewards.' })
    }
  },

  reset: () => set({ ...initialState }),
}))
