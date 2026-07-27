/**
 * GET /api/rewards/balance
 * ------------------------
 * Get the authenticated user's reward point balance.
 *
 * Returns:
 *  - { balancePoints, totalEarned, totalRedeemed }
 *  - 0 for all fields if user has never earned any points
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getAuthenticatedUser } from '@/services/cart-service'
import { getRewardBalance } from '@/services/reward-service'

export async function GET() {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'rewards_balance', {
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

    const balance = await getRewardBalance(user.id)

    return NextResponse.json({
      success: true,
      message: 'Reward balance loaded.',
      data: {
        balancePoints: balance.balancePoints,
        totalEarned: balance.totalEarned,
        totalRedeemed: balance.totalRedeemed,
      },
    })
  } catch (err) {
    console.error('[REWARDS BALANCE UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
