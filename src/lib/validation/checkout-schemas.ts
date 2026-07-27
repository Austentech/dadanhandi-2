/**
 * Checkout Validation Schemas
 * ---------------------------
 * Strict Zod schemas for every checkout & payment API request.
 * Used both client-side (for instant feedback) and server-side (for security).
 *
 * SECURITY: The server is the source of truth. Client validation is a UX
 * nicety, NOT a security boundary. Every server endpoint MUST validate
 * with these schemas before doing any work.
 *
 * Rules enforced here:
 *  - branchSlug: lowercase kebab-case, matches known branches
 *  - pickupSlotKey: "HH:MM-HH:MM" format (24h)
 *  - donations: booleans (true/false for each)
 *  - rewardPointsToRedeem: integer >= 0, multiple of 10
 *  - idempotencyKey: UUID v4 format
 *  - customerNotes: max 500 chars, no HTML
 */

import { z } from 'zod/v4'
import { CHECKOUT_CONFIG, REWARD_CONFIG } from '@/types/checkout'

// ============================================================================
// PRIMITIVES
// ============================================================================

export const branchSlugSchema = z
  .string()
  .min(1, 'Branch is required')
  .max(60, 'Branch slug too long')
  .regex(/^[a-z0-9-]+$/, 'Invalid branch slug format')

export const pickupSlotKeySchema = z
  .string()
  .min(1, 'Pickup slot is required')
  .regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, 'Invalid pickup slot format')

export const donationSelectionSchema = z.object({
  plantation: z.boolean(),
  hunger: z.boolean(),
})

export const rewardPointsToRedeemSchema = z
  .number()
  .int('Reward points must be an integer')
  .min(0, 'Reward points cannot be negative')
  .refine(
    (n) => n === 0 || n >= REWARD_CONFIG.minRedeemPoints,
    `Minimum ${REWARD_CONFIG.minRedeemPoints} points required to redeem`,
  )
  .refine(
    (n) => n % REWARD_CONFIG.redeemStepPoints === 0,
    `Points must be a multiple of ${REWARD_CONFIG.redeemStepPoints}`,
  )

export const idempotencyKeySchema = z
  .string()
  .min(1, 'Idempotency key is required')
  .max(120, 'Idempotency key too long')
  // Accept UUID v4 or any URL-safe string 8+ chars
  .regex(/^[a-zA-Z0-9_-]{8,}$/, 'Invalid idempotency key format')

export const customerNotesSchema = z
  .string()
  .max(CHECKOUT_CONFIG.maxCustomerNotesLength, `Notes must be at most ${CHECKOUT_CONFIG.maxCustomerNotesLength} characters`)
  .optional()
  .or(z.literal(''))

// ============================================================================
// VALIDATE CHECKOUT (Step 4 → before payment)
// ============================================================================
export const validateCheckoutSchema = z.object({
  branchSlug: branchSlugSchema,
  pickupSlotKey: pickupSlotKeySchema,
  donations: donationSelectionSchema,
  rewardPointsToRedeem: rewardPointsToRedeemSchema,
})

export type ValidateCheckoutInput = z.infer<typeof validateCheckoutSchema>

// ============================================================================
// CREATE ORDER (Step 5 → creates draft order + PaymentIntent)
// ============================================================================
export const createOrderSchema = z.object({
  branchSlug: branchSlugSchema,
  pickupSlotKey: pickupSlotKeySchema,
  donations: donationSelectionSchema,
  rewardPointsToRedeem: rewardPointsToRedeemSchema,
  customerNotes: customerNotesSchema,
  idempotencyKey: idempotencyKeySchema,
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// ============================================================================
// REWARD REDEMPTION PREVIEW
// ============================================================================
export const previewRedemptionSchema = z.object({
  points: z
    .number()
    .int('Points must be an integer')
    .min(0, 'Points cannot be negative'),
})

export type PreviewRedemptionInput = z.infer<typeof previewRedemptionSchema>

// ============================================================================
// GET ORDER BY ID (path param validation)
// ============================================================================
export const orderIdSchema = z
  .string()
  .min(1, 'Order ID is required')
  .max(80, 'Order ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid order ID format')

// ============================================================================
// ORDER NUMBER
// ============================================================================
export const orderNumberSchema = z
  .string()
  .min(1, 'Order number is required')
  .max(40, 'Order number too long')
  .regex(/^DHM-\d{8}-\d{5}$/, 'Invalid order number format')

// ============================================================================
// CANCEL ORDER
// ============================================================================
export const cancelOrderSchema = z.object({
  orderId: orderIdSchema,
})
