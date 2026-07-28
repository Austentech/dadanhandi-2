/**
 * Account & Order Validation Schemas
 * -----------------------------------
 * Strict Zod schemas for profile updates, order listing, reward queries.
 * Used both client-side (instant feedback) and server-side (security).
 */

import { z } from 'zod/v4'

// ============================================================================
// PROFILE UPDATE
// ============================================================================

export const whatsappNumberSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit WhatsApp number')

export const mobileNumberSchema = z
  .string()
  .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))

export const areaSchema = z
  .string()
  .min(2, 'Area must be at least 2 characters')
  .max(100, 'Area is too long')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))

export const citySchema = z
  .string()
  .min(2, 'City must be at least 2 characters')
  .max(50, 'City is too long')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))

export const pincodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Enter a valid 6-digit pincode')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))

export const updateProfileSchema = z.object({
  whatsapp_number: whatsappNumberSchema.optional().or(z.literal('')),
  mobile_number: mobileNumberSchema,
  area: areaSchema,
  city: citySchema,
  pincode: pincodeSchema,
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ============================================================================
// ORDER LISTING / FILTERS
// ============================================================================

export const orderStatusFilterSchema = z
  .enum(['all', 'confirmed', 'awaiting_payment', 'cancelled', 'failed'])
  .optional()
  .default('all')

export const paymentStatusFilterSchema = z
  .enum(['all', 'succeeded', 'pending', 'failed'])
  .optional()
  .default('all')

export const dateRangeSchema = z.object({
  from: z.string().datetime({ message: 'Invalid start date' }).optional(),
  to: z.string().datetime({ message: 'Invalid end date' }).optional(),
}).optional()

export const sortOrderSchema = z.enum(['newest', 'oldest']).optional().default('newest')

export const branchFilterSchema = z.string().max(60).optional()

export const searchQuerySchema = z.string().max(40).optional()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const listOrdersSchema = z.object({
  orderStatus: orderStatusFilterSchema,
  paymentStatus: paymentStatusFilterSchema,
  sortOrder: sortOrderSchema,
  branch: branchFilterSchema,
  search: searchQuerySchema,
})
  .merge(paginationSchema)

export type ListOrdersInput = z.infer<typeof listOrdersSchema>

// ============================================================================
// ORDER DETAILS
// ============================================================================

export const orderIdParamSchema = z
  .string()
  .min(1, 'Order ID is required')
  .max(100, 'Invalid order ID')

// ============================================================================
// REWARD HISTORY
// ============================================================================

export const rewardTypeFilterSchema = z
  .enum(['all', 'earn', 'redeem', 'adjust', 'restore'])
  .optional()
  .default('all')

export const listRewardTransactionsSchema = paginationSchema.merge(
  z.object({
    type: rewardTypeFilterSchema,
  })
)
export type ListRewardTransactionsInput = z.infer<typeof listRewardTransactionsSchema>
