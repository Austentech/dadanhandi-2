/**
 * Checkout Service (orchestrator)
 * -------------------------------
 * Validates the ENTIRE checkout payload from scratch on every request.
 * Never trusts client-supplied prices, totals, or reward calculations.
 *
 * This is the SINGLE ENTRY POINT for both /api/checkout/validate and
 * /api/checkout/create-order. Both endpoints call the same `computeCheckout`
 * function to derive the final amount — ensuring zero drift between the
 * "preview" the user sees and the amount actually charged.
 *
 * PIPELINE (all steps run on every call):
 *  1. Load user's cart from server (never trust client cart)
 *  2. RE-VALIDATE every item + variant + price against the menu catalog
 *  3. RE-CALCULATE subtotal from scratch
 *  4. Validate branch exists and is active
 *  5. Validate pickup slot is real, today, and not yet passed
 *  6. Validate donations (only allowed values: 0 or 500 / 0 or 1000)
 *  7. Validate reward redemption (multiple of 10, <= balance, compute discount)
 *  8. Compute final amount = subtotal + donations - reward_discount
 *  9. Compute potential reward points to earn (5 if rules met)
 * 10. Return everything in paise (integer)
 */

import { getCart } from '@/services/cart-service'
import { getVariant } from '@/constants/menu-catalog'
import { calculateUnitPrice, calculateLineTotal } from '@/lib/pricing'
import { getBranchBySlug } from '@/services/branch-service'
import { validatePickupSlot, getISTTodayDate } from '@/services/pickup-slot-service'
import { getRewardBalance, calculateEarnablePoints, calculateRedemptionDiscount, previewRedemption } from '@/services/reward-service'
import { DONATION_CONFIG } from '@/types/checkout'
import type {
  Branch,
  BranchSnapshot,
  PickupSlot,
  DonationSelection,
} from '@/types/checkout'
import type { CartItem, Paise } from '@/types/menu'

// ============================================================================
// TYPES
// ============================================================================
export interface CheckoutValidationInput {
  userId: string
  branchSlug: string
  pickupSlotKey: string
  donations: DonationSelection
  rewardPointsToRedeem: number
}

export interface CheckoutValidationOutput {
  success: boolean
  message: string
  data?: {
    cartItems: CartItem[]
    subtotalPaise: Paise
    donationPlantationPaise: Paise
    donationHungerPaise: Paise
    rewardPointsRedeemed: number
    rewardDiscountPaise: Paise
    finalAmountPaise: Paise
    potentialPointsToEarn: number
    rewardBalance: number
    branch: BranchSnapshot
    pickupSlot: PickupSlot
  }
}

// ============================================================================
// HELPER: SANITIZE CUSTOMER NOTES
// ============================================================================
/**
 * Strip angle brackets and double quotes from customer notes.
 * We don't sanitize other characters because they're safe in DB
 * (parameterized queries) and rendered as text in React (auto-escaped).
 */
function sanitizeCustomerNotes(notes: string | undefined): string {
  if (!notes) return ''
  return notes.replace(/[<>"]/g, '').trim().slice(0, 500)
}

export { sanitizeCustomerNotes }

// ============================================================================
// REVALIDATE CART (server-side price recalculation)
// ============================================================================
/**
 * Re-validate every item in the user's cart against the menu catalog and
 * recompute prices. Returns the validated cart + subtotal.
 *
 * This is the CRITICAL security step: even if the client tampered with
 * prices in their local cart store, the server recalculates from scratch.
 */
async function revalidateCart(userId: string): Promise<{
  success: boolean
  message: string
  cartItems?: CartItem[]
  subtotalPaise?: Paise
}> {
  const { cart } = await getCart(userId)

  if (cart.length === 0) {
    return { success: false, message: 'Your plate is empty. Add items before checkout.' }
  }

  if (cart.length > 30) {
    return { success: false, message: 'Too many items in plate. Maximum 30 lines allowed.' }
  }

  let subtotalPaise = 0
  const validatedItems: CartItem[] = []

  for (const item of cart) {
    // Verify item + variant exist in catalog
    const variantInfo = getVariant(item.itemId, item.variantId)
    if (!variantInfo) {
      return {
        success: false,
        message: `Item "${item.itemName}" is no longer available. Please remove it from your plate.`,
      }
    }

    const { item: menuItem, variant } = variantInfo

    // Verify item is available
    if (!menuItem.available) {
      return {
        success: false,
        message: `"${menuItem.name}" is currently unavailable. Please remove it from your plate.`,
      }
    }

    // RECALCULATE unit price (NEVER trust client)
    const unitPricePaise = calculateUnitPrice(menuItem.type, variant)
    const lineTotalPaise = calculateLineTotal(unitPricePaise, item.quantity)
    subtotalPaise += lineTotalPaise

    validatedItems.push({
      ...item,
      itemName: menuItem.name,  // refresh in case catalog changed
      itemEmoji: menuItem.emoji,
      itemType: menuItem.type,
      variantLabel: variant.label,
      weightGrams: variant.weightGrams,
      pieceCount: variant.pieceCount,
      unitPricePaise,
    })
  }

  return {
    success: true,
    message: 'Cart validated.',
    cartItems: validatedItems,
    subtotalPaise,
  }
}

// ============================================================================
// MAIN: COMPUTE CHECKOUT
// ============================================================================
/**
 * Validate the entire checkout payload and compute the final amount.
 * Pure-ish: reads from DB but does NOT mutate anything.
 *
 * Used by:
 *  - POST /api/checkout/validate (preview for the user)
 *  - POST /api/checkout/create-order (before creating the draft order)
 */
export async function computeCheckout(
  input: CheckoutValidationInput,
): Promise<CheckoutValidationOutput> {
  // -------- 1. REVALIDATE CART --------
  const cartResult = await revalidateCart(input.userId)
  if (!cartResult.success || !cartResult.cartItems || cartResult.subtotalPaise === undefined) {
    return { success: false, message: cartResult.message }
  }

  const { cartItems, subtotalPaise } = cartResult

  // -------- 2. VALIDATE BRANCH --------
  const branch: Branch | null = await getBranchBySlug(input.branchSlug)
  if (!branch) {
    return { success: false, message: 'Please select a valid pickup branch.' }
  }

  // -------- 3. VALIDATE PICKUP SLOT --------
  const slotResult = validatePickupSlot(input.pickupSlotKey)
  if (!slotResult.valid || !slotResult.slot) {
    return {
      success: false,
      message: slotResult.reason || 'Please select a valid pickup time.',
    }
  }
  const pickupSlot = slotResult.slot

  // -------- 4. VALIDATE DONATIONS --------
  // Donations are booleans in the request; convert to paise.
  // The DB enforces only 0 or the exact amount allowed.
  const donationPlantationPaise: Paise = input.donations.plantation ? DONATION_CONFIG.plantationPaise : 0
  const donationHungerPaise: Paise = input.donations.hunger ? DONATION_CONFIG.hungerPaise : 0

  // -------- 5. VALIDATE REWARD REDEMPTION --------
  const rewardBalance = await getRewardBalance(input.userId)

  let rewardPointsRedeemed = 0
  let rewardDiscountPaise: Paise = 0

  if (input.rewardPointsToRedeem > 0) {
    // Validate shape (multiple of 10, min 10)
    const discountCalc = calculateRedemptionDiscount(input.rewardPointsToRedeem)
    if (discountCalc === null) {
      return {
        success: false,
        message: 'Invalid reward points. Points must be a multiple of 10 (minimum 10).',
      }
    }

    // Verify user has enough points (DB is source of truth, but check here
    // for fast feedback; the RPC will re-check atomically with row lock)
    if (input.rewardPointsToRedeem > rewardBalance.balancePoints) {
      return {
        success: false,
        message: `Insufficient reward points. You have ${rewardBalance.balancePoints} points.`,
      }
    }

    // Verify against DB (the RPC preview_reward_redemption is the source of truth)
    const preview = await previewRedemption(input.userId, input.rewardPointsToRedeem)
    if (!preview.success || !preview.data) {
      return {
        success: false,
        message: preview.message || 'Failed to validate reward redemption.',
      }
    }

    rewardPointsRedeemed = preview.data.points
    rewardDiscountPaise = preview.data.discountPaise
  }

  // -------- 6. COMPUTE FINAL AMOUNT --------
  const finalAmountPaise: Paise =
    subtotalPaise + donationPlantationPaise + donationHungerPaise - rewardDiscountPaise

  if (finalAmountPaise < 0) {
    // Should never happen, but guard anyway
    return { success: false, message: 'Invalid checkout total. Please contact support.' }
  }

  // -------- 7. COMPUTE POTENTIAL REWARD POINTS --------
  // 5 points if subtotal > ₹500 AND plantation donation selected
  const potentialPointsToEarn = calculateEarnablePoints(subtotalPaise, donationPlantationPaise)

  // -------- 8. RETURN EVERYTHING --------
  return {
    success: true,
    message: 'Checkout validated.',
    data: {
      cartItems,
      subtotalPaise,
      donationPlantationPaise,
      donationHungerPaise,
      rewardPointsRedeemed,
      rewardDiscountPaise,
      finalAmountPaise,
      potentialPointsToEarn,
      rewardBalance: rewardBalance.balancePoints,
      branch: {
        id: branch.id,
        slug: branch.slug,
        name: branch.name,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2,
        city: branch.city,
        state: branch.state,
      },
      pickupSlot,
    },
  }
}

// ============================================================================
// GET TODAY'S IST DATE (re-exported for convenience)
// ============================================================================
export { getISTTodayDate }
