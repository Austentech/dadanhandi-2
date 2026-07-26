/**
 * Cart Validation Schemas
 * -----------------------
 * Strict Zod schemas for every cart API request.
 * Used both client-side (for fast feedback) and server-side (for security).
 *
 * The server is the source of truth — client validation is a UX nicety,
 * not a security boundary.
 */

import { z } from 'zod/v4'
import { CART_CONFIG } from '@/types/menu'

// ============================================================================
// ADD TO CART
// ============================================================================
export const addToCartSchema = z.object({
  itemId: z
    .string()
    .min(1, 'Item ID is required')
    .max(80, 'Item ID too long')
    .regex(/^[a-z0-9-]+$/, 'Invalid item ID format'),
  variantId: z
    .string()
    .min(1, 'Variant ID is required')
    .max(120, 'Variant ID too long')
    .regex(/^[a-z0-9-]+$/, 'Invalid variant ID format'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(CART_CONFIG.maxQuantityPerLine, `Maximum ${CART_CONFIG.maxQuantityPerLine} per item`),
})

export type AddToCartInput = z.infer<typeof addToCartSchema>

// ============================================================================
// UPDATE QUANTITY
// ============================================================================
export const updateCartQuantitySchema = z.object({
  lineKey: z
    .string()
    .min(1, 'Line key is required')
    .max(240, 'Line key too long')
    .regex(/^[a-z0-9-]+--[a-z0-9-]+$/, 'Invalid line key format'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(CART_CONFIG.maxQuantityPerLine, `Maximum ${CART_CONFIG.maxQuantityPerLine} per item`),
})

export type UpdateCartQuantityInput = z.infer<typeof updateCartQuantitySchema>

// ============================================================================
// REMOVE FROM CART
// ============================================================================
export const removeFromCartSchema = z.object({
  lineKey: z
    .string()
    .min(1, 'Line key is required')
    .max(240, 'Line key too long')
    .regex(/^[a-z0-9-]+--[a-z0-9-]+$/, 'Invalid line key format'),
})

export type RemoveFromCartInput = z.infer<typeof removeFromCartSchema>

// ============================================================================
// CLEAR CART (no body needed, but include for symmetry)
// ============================================================================
export const clearCartSchema = z.object({}).optional()

// ============================================================================
// HELPER: Validate item + variant exist in catalog (server-side only)
// ============================================================================
/**
 * Returns true if (itemId, variantId) refers to a real item+variant
 * combination in the menu catalog.
 *
 * This is the SINGLE source of truth for "is this item real?".
 * Used by every cart API route to prevent injection of fake items.
 *
 * NOTE: This is now imported directly where needed (see cart-service.ts)
 * via `getVariant` from '@/constants/menu-catalog'. The helper below is
 * kept for backward compatibility but is not currently used.
 */
