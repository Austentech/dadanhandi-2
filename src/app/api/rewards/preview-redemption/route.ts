/**
 * POST /api/rewards/preview-redemption
 * ------------------------------------
 * Preview the discount a user would get for redeeming N points.
 * Does NOT deduct points — pure calculation with validation.
 *
 * Use case: Step 4 (Donation & Rewards) — when the user enters the number
 * of points they want to redeem, this endpoint returns the discount amount
 * and the resulting balance. The actual deduction happens at order creation.
 *
 * Rules:
 *  - points must be >= 0
 *  - points must be a multiple of 10 (or 0)
 *  - points must be <= current balance
 *  - 10 points = ₹5 (500 paise) discount
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { previewRedemptionSchema } from '@/lib/validation/checkout-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'
import { previewRedemption } from '@/services/reward-service'

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'rewards_preview', {
      maxAttempts: 30,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const result = previewRedemptionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error.issues[0]?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    const preview = await previewRedemption(user.id, result.data.points)
    if (!preview.success) {
      return NextResponse.json(
        { success: false, message: preview.message || 'Failed to preview redemption.' },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Redemption preview loaded.',
      data: preview.data,
    })
  } catch (err) {
    console.error('[REWARDS PREVIEW UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
