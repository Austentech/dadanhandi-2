/**
 * Reward Service (server-side)
 * ----------------------------
 * Reads + mutates reward point balances.
 *
 * SECURITY MODEL:
 *  - All reads use the user's authenticated session (RLS-enforced).
 *  - All mutations (award, redeem, restore) go through SECURITY DEFINER
 *    RPCs in the database. The application layer NEVER directly mutates
 *    reward_balance or reward_transactions tables.
 *
 * REWARD RULES (per Phase 2 Module 3 spec):
 *  - EARN: 5 points if BOTH conditions true:
 *      1. Final order subtotal > ₹500 (50000 paise)
 *      2. Customer selected Contribute ₹5 for Plantation
 *  - Points are credited ONLY AFTER successful payment.
 *  - REDEEM: 10 points = ₹5 discount (500 paise). Multiples of 10 only.
 *  - Min 10 points required to redeem.
 *  - Redeemed points are deducted at order creation (draft).
 *    If payment fails, points are restored automatically.
 *  - Server validates every redemption request.
 *  - Negative points, fractional redemption, and over-redemption are all rejected.
 */

import { createServerClient } from '@/lib/supabase/client-server'
import { REWARD_CONFIG } from '@/types/checkout'
import type { RewardBalance } from '@/types/checkout'

// ============================================================================
// TYPES
// ============================================================================
interface DbRewardBalanceRow {
  balance_points: number
  total_earned: number
  total_redeemed: number
}

interface PreviewRedemptionResult {
  success: boolean
  message?: string
  data?: {
    points: number
    discountPaise: number
    balanceAfter: number
  }
}

// ============================================================================
// GET BALANCE
// ============================================================================
/**
 * Get the user's current reward balance. Returns 0 for everything if user
 * has never earned any points (the RPC lazy-initializes a zero row).
 */
export async function getRewardBalance(userId: string): Promise<RewardBalance> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('get_reward_balance', {
    p_user_id: userId,
  })

  if (error) {
    console.error('[REWARD SERVICE] getRewardBalance RPC error:', error.message)
    return { balancePoints: 0, totalEarned: 0, totalRedeemed: 0 }
  }

  if (!data || (data as DbRewardBalanceRow[]).length === 0) {
    return { balancePoints: 0, totalEarned: 0, totalRedeemed: 0 }
  }

  const row = (data as DbRewardBalanceRow[])[0]
  return {
    balancePoints: row.balance_points,
    totalEarned: row.total_earned,
    totalRedeemed: row.total_redeemed,
  }
}

// ============================================================================
// PREVIEW REDEMPTION (no deduction)
// ============================================================================
/**
 * Preview the discount a user would get for redeeming N points.
 * Does NOT deduct — pure calculation with validation.
 *
 * Returns:
 *  - { success, data: { points, discountPaise, balanceAfter } } on valid input
 *  - { success: false, message } on invalid input or insufficient balance
 */
export async function previewRedemption(
  userId: string,
  points: number,
): Promise<PreviewRedemptionResult> {
  // Pre-validate at app layer for instant feedback before DB call
  if (!Number.isInteger(points) || points < 0) {
    return { success: false, message: 'Invalid points value.' }
  }

  if (points > 0 && points < REWARD_CONFIG.minRedeemPoints) {
    return {
      success: false,
      message: `Minimum ${REWARD_CONFIG.minRedeemPoints} points required to redeem.`,
    }
  }

  if (points % REWARD_CONFIG.redeemStepPoints !== 0) {
    return {
      success: false,
      message: `Points must be a multiple of ${REWARD_CONFIG.redeemStepPoints}.`,
    }
  }

  if (points === 0) {
    const balance = await getRewardBalance(userId)
    return {
      success: true,
      data: { points: 0, discountPaise: 0, balanceAfter: balance.balancePoints },
    }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('preview_reward_redemption', {
    p_user_id: userId,
    p_points: points,
  })

  if (error) {
    console.error('[REWARD SERVICE] previewRedemption RPC error:', error.message)
    return { success: false, message: 'Failed to preview redemption. Please try again.' }
  }

  const result = data as {
    success: boolean
    message?: string
    points?: number
    discount_paise?: number
    balance_after?: number
    available?: number
  } | null

  if (!result?.success) {
    return {
      success: false,
      message: result?.message || 'Failed to preview redemption.',
    }
  }

  return {
    success: true,
    data: {
      points: result.points!,
      discountPaise: result.discount_paise!,
      balanceAfter: result.balance_after!,
    },
  }
}

// ============================================================================
// CALCULATE EARNABLE POINTS (pure function)
// ============================================================================
/**
 * Calculate how many points would be earned for an order with the given
 * subtotal and plantation donation.
 *
 * Rules:
 *  - 5 points if subtotal > ₹500 (50000 paise) AND plantation donation = 500 paise
 *  - 0 points otherwise
 *
 * This is a PURE function — does NOT credit the points. The actual crediting
 * happens in the `mark_order_succeeded` RPC when payment succeeds.
 */
export function calculateEarnablePoints(
  subtotalPaise: number,
  donationPlantationPaise: number,
): number {
  if (
    subtotalPaise > REWARD_CONFIG.earnThresholdPaise &&
    donationPlantationPaise === REWARD_CONFIG.earnRequiredDonationPaise
  ) {
    return REWARD_CONFIG.earnPointsPerQualifyingOrder
  }
  return 0
}

// ============================================================================
// CALCULATE REDEMPTION DISCOUNT (pure function)
// ============================================================================
/**
 * Calculate the discount (paise) for a given number of points redeemed.
 * Pure function. Returns 0 if points is 0 or invalid.
 *
 * Formula: discount = (points / 10) * 500
 *
 * Returns null if the input is invalid (not a multiple of 10, negative, etc.)
 */
export function calculateRedemptionDiscount(points: number): number | null {
  if (!Number.isInteger(points) || points < 0) return null
  if (points > 0 && points < REWARD_CONFIG.minRedeemPoints) return null
  if (points % REWARD_CONFIG.redeemStepPoints !== 0) return null
  return Math.floor(points / REWARD_CONFIG.redeemStepPoints) * REWARD_CONFIG.discountPerStepPaise
}
