/**
 * Checkout & Payment Type System
 * ------------------------------
 * Strongly-typed models for branches, orders, payments, rewards, and pickup slots.
 *
 * Money is INTEGER PAISE (1 INR = 100 paise). All weights are INTEGER GRAMS.
 * Quantity is always a positive integer.
 *
 * These types mirror the Supabase tables defined in
 * supabase/migrations/004_create_checkout_payment_rewards.sql.
 */

import type { Paise, Quantity, Grams, ItemType } from '@/types/menu'

// ============================================================================
// BRANCHES
// ============================================================================

export interface Branch {
  id: string
  slug: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  pincode: string | null
  latitude: number | null
  longitude: number | null
  /** 24h format "HH:MM:SS" */
  openingTime: string
  /** 24h format "HH:MM:SS" */
  closingTime: string
  status: 'active' | 'inactive' | 'coming_soon'
  sortOrder: number
}

/** Snapshot of branch info attached to an order (denormalized for display). */
export interface BranchSnapshot {
  id: string
  slug: string
  name: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
}

// ============================================================================
// PICKUP SLOTS
// ============================================================================

/**
 * A pickup time slot. Slots are GENERATED DYNAMICALLY based on the current
 * time in Asia/Kolkata (IST) — never stored in the database.
 *
 * Each slot is 1 hour long (configurable). Slots that have already started
 * are marked `disabled: true` and cannot be selected.
 */
export interface PickupSlot {
  /** Unique key: "HH:MM-HH:MM" (24h) */
  key: string
  /** Start time "HH:MM" (24h) */
  startTime: string
  /** End time "HH:MM" (24h) */
  endTime: string
  /** Display label: "10:00 AM – 11:00 AM" */
  label: string
  /** Short display label: "10:00 AM" */
  shortLabel: string
  /** True if this slot has already passed (cannot be selected) */
  disabled: boolean
  /** Disabled reason (when disabled=true), for accessibility */
  disabledReason?: string
}

// ============================================================================
// ORDERS
// ============================================================================

export type OrderStatus = 'draft' | 'awaiting_payment' | 'confirmed' | 'cancelled' | 'failed'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

/**
 * An order header. Matches the public.orders table.
 */
export interface OrderHeader {
  id: string
  orderNumber: string
  userId: string
  branchId: string
  pickupDate: string  // ISO date "YYYY-MM-DD"
  pickupSlotStart: string  // "HH:MM:SS"
  pickupSlotEnd: string  // "HH:MM:SS"
  subtotalPaise: Paise
  donationPlantationPaise: Paise
  donationHungerPaise: Paise
  rewardPointsRedeemed: number
  rewardDiscountPaise: Paise
  finalAmountPaise: Paise
  rewardPointsEarned: number
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  razorpayOrderId: string | null
  customerNotes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * A snapshot of an item in an order (immutable). Matches public.order_items.
 * Once an order is created, item data is frozen — later menu price changes
 * do not affect historical orders.
 */
export interface OrderItem {
  lineKey: string
  itemId: string
  variantId: string
  itemName: string
  itemEmoji: string
  itemType: ItemType
  variantLabel: string
  weightGrams: Grams | null
  pieceCount: number | null
  unitPricePaise: Paise
  quantity: Quantity
  lineTotalPaise: Paise
}

/** Full order with items + branch snapshot (for confirmation page). */
export interface OrderWithDetails extends OrderHeader {
  items: OrderItem[]
  branch?: BranchSnapshot
}

// ============================================================================
// PAYMENTS
// ============================================================================

export interface Payment {
  id: string
  orderId: string
  userId: string
  razorpayOrderId: string
  razorpayPaymentId: string | null
  razorpaySignature: string | null
  amountPaise: Paise
  currency: string
  status: PaymentStatus
  webhookProcessedAt: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

// ============================================================================
// REWARDS
// ============================================================================

export type RewardTransactionType = 'earn' | 'redeem' | 'adjust' | 'restore'

export interface RewardBalance {
  balancePoints: number
  totalEarned: number
  totalRedeemed: number
}

export interface RewardTransaction {
  id: string
  userId: string
  orderId: string | null
  /** Signed: positive for earn/restore, negative for redeem */
  points: number
  type: RewardTransactionType
  reason: string
  /** Running balance AFTER this transaction */
  balanceAfter: number
  createdAt: string
}

// ============================================================================
// CHECKOUT STATE (used by frontend store + API)
// ============================================================================

export interface DonationSelection {
  plantation: boolean  // ₹5
  hunger: boolean  // ₹10
}

/** The full state of the multi-step checkout flow. */
export interface CheckoutState {
  /** 1-indexed step number (1 = Review Plate, 6 = Confirmation) */
  currentStep: number
  /** Selected branch slug (null until step 2 complete) */
  branchSlug: string | null
  /** Selected pickup slot key (null until step 3 complete) */
  pickupSlotKey: string | null
  /** Donation selections (step 4) */
  donations: DonationSelection
  /** Reward points to redeem (must be multiple of 10, 0 if none) */
  rewardPointsToRedeem: number
  /** Server-computed final amount (paise). Always revalidated before payment. */
  finalAmountPaise: Paise | null
  /** Created order ID (set in step 5) */
  orderId: string | null
  /** Order number (set in step 5) */
  orderNumber: string | null
  /** Razorpay order_id (server-created; passed to Razorpay Checkout) */
  razorpayOrderId: string | null
  /** Optional customer note */
  customerNotes: string
}

// ============================================================================
// API REQUEST / RESPONSE SHAPES
// ============================================================================

/** Request body for POST /api/checkout/validate */
export interface ValidateCheckoutRequest {
  branchSlug: string
  pickupSlotKey: string
  donations: DonationSelection
  rewardPointsToRedeem: number
}

/** Response from POST /api/checkout/validate */
export interface ValidateCheckoutResponse {
  success: boolean
  message: string
  data?: {
    subtotalPaise: Paise
    donationPlantationPaise: Paise
    donationHungerPaise: Paise
    rewardPointsRedeemed: number
    rewardDiscountPaise: Paise
    finalAmountPaise: Paise
    /** Preview: points that would be earned if payment succeeds */
    potentialPointsToEarn: number
    /** User's current reward balance (for display) */
    rewardBalance: number
    /** Branch + slot info echoed back for client to display */
    branch: BranchSnapshot
    pickupSlot: PickupSlot
  }
}

/** Request body for POST /api/checkout/create-order */
export interface CreateOrderRequest {
  branchSlug: string
  pickupSlotKey: string
  donations: DonationSelection
  rewardPointsToRedeem: number
  customerNotes?: string
  /** Client-generated idempotency key (UUID). Prevents duplicate orders. */
  idempotencyKey: string
}

/** Response from POST /api/checkout/create-order */
export interface CreateOrderResponse {
  success: boolean
  message: string
  data?: {
    orderId: string
    orderNumber: string
    /** Razorpay order_id — used by Razorpay Checkout */
    razorpayOrderId: string
    /** Amount to charge (paise) */
    amountPaise: Paise
    currency: string
    /** Final server-validated amount */
    finalAmountPaise: Paise
  }
}

/** Request body for POST /api/checkout/verify-payment */
export interface VerifyPaymentRequest {
  orderId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

/** Response from POST /api/checkout/verify-payment */
export interface VerifyPaymentResponse {
  success: boolean
  message: string
  data?: {
    orderId: string
    orderNumber: string
    orderStatus: OrderStatus
    rewardPointsEarned: number
  }
}

/** Response from GET /api/checkout/order/[id] */
export interface GetOrderResponse {
  success: boolean
  message: string
  data?: {
    order: OrderWithDetails
    payment?: Payment
  }
}

// ============================================================================
// REWARD PREVIEW
// ============================================================================

export interface RewardRedemptionPreview {
  success: boolean
  message?: string
  data?: {
    points: number
    discountPaise: Paise
    balanceAfter: number
  }
}

// ============================================================================
// CONFIG
// ============================================================================

export const REWARD_CONFIG = {
  /** Points earned when both conditions met: subtotal > ₹500 + plantation donation */
  earnPointsPerQualifyingOrder: 5,
  /** Subtotal threshold (paise) for earning points: ₹500 */
  earnThresholdPaise: 50000,
  /** Plantation donation amount required to earn points */
  earnRequiredDonationPaise: 500,
  /** Minimum points required to redeem */
  minRedeemPoints: 10,
  /** Points must be multiple of this */
  redeemStepPoints: 10,
  /** Discount per redeemStepPoints (paise). 10 points = ₹5 = 500 paise */
  discountPerStepPaise: 500,
} as const

export const DONATION_CONFIG = {
  plantationPaise: 500,  // ₹5
  hungerPaise: 1000,     // ₹10
} as const

export const PICKUP_CONFIG = {
  /** Restaurant timezone — all pickup date/time calculations use this */
  timezone: 'Asia/Kolkata',
  /** Operating hours (24h) */
  openingHour: 10,  // 10:00 AM
  closingHour: 22,  // 10:00 PM
  /** Slot interval in minutes (default 60 = 1 hour) */
  slotIntervalMinutes: 60,
} as const

export const CHECKOUT_CONFIG = {
  /** Allowed steps in order. 1-indexed. */
  totalSteps: 6,
  stepNames: [
    'Review Plate',
    'Select Branch',
    'Select Pickup Time',
    'Donation & Rewards',
    'Payment',
    'Confirmation',
  ] as const,
  /** Max customer notes length */
  maxCustomerNotesLength: 500,
  /** Currency code (always 'inr' for Razorpay India) */
  currency: 'inr' as const,
} as const
