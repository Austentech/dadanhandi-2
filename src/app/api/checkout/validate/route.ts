/**
 * POST /api/checkout/validate
 * ---------------------------
 * Validate the entire checkout payload and return the server-computed
 * final amount. Does NOT create an order or charge the user.
 *
 * Called from Step 4 (Donation & Rewards) before proceeding to Step 5
 * (Payment), and again before creating the order in Step 5.
 *
 * Security:
 *  - Requires authenticated session
 *  - Validates request body with Zod
 *  - Re-validates cart, branch, slot, donations, rewards on server
 *  - RECALCULATES all prices from menu catalog (never trusts client)
 *  - Rate limited per user + per IP
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { validateCheckoutSchema } from '@/lib/validation/checkout-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'
import { computeCheckout } from '@/services/checkout-service'

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    // 2. Rate limit
    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'checkout_validate', {
      maxAttempts: 20,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please slow down.' },
        { status: 429 },
      )
    }
    const userCheck = checkRateLimit(user.id, 'checkout_validate', {
      maxAttempts: 20,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!userCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please slow down.' },
        { status: 429 },
      )
    }

    // 3. Parse + validate body
    const body = await request.json()
    const result = validateCheckoutSchema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    // 4. Compute checkout (server-side validation + price recalculation)
    const checkout = await computeCheckout({
      userId: user.id,
      branchSlug: result.data.branchSlug,
      pickupSlotKey: result.data.pickupSlotKey,
      donations: result.data.donations,
      rewardPointsToRedeem: result.data.rewardPointsToRedeem,
    })

    if (!checkout.success || !checkout.data) {
      return NextResponse.json(
        { success: false, message: checkout.message },
        { status: 400 },
      )
    }

    // 5. Return the validated checkout state
    return NextResponse.json({
      success: true,
      message: checkout.message,
      data: {
        subtotalPaise: checkout.data.subtotalPaise,
        donationPlantationPaise: checkout.data.donationPlantationPaise,
        donationHungerPaise: checkout.data.donationHungerPaise,
        rewardPointsRedeemed: checkout.data.rewardPointsRedeemed,
        rewardDiscountPaise: checkout.data.rewardDiscountPaise,
        finalAmountPaise: checkout.data.finalAmountPaise,
        potentialPointsToEarn: checkout.data.potentialPointsToEarn,
        rewardBalance: checkout.data.rewardBalance,
        branch: checkout.data.branch,
        pickupSlot: checkout.data.pickupSlot,
      },
    })
  } catch (err) {
    console.error('[CHECKOUT VALIDATE UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
