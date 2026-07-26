/**
 * POST /api/checkout/cancel
 * -------------------------
 * Cancel a draft/awaiting_payment order. Restores redeemed reward points.
 * Once an order is 'confirmed' or 'failed', it cannot be cancelled.
 *
 * Use case: user abandons checkout at the payment step. We cancel the
 * draft order so the cart is freed up for a new checkout attempt.
 *
 * Security:
 *  - Requires authenticated session
 *  - Only the order owner can cancel
 *  - Rate limited
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { cancelOrderSchema } from '@/lib/validation/checkout-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'
import { cancelDraftOrder } from '@/services/order-service'

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'checkout_cancel', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const result = cancelOrderSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error.issues[0]?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    const cancelResult = await cancelDraftOrder(user.id, result.data.orderId)
    if (!cancelResult.success) {
      return NextResponse.json(
        { success: false, message: cancelResult.message },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, message: 'Order cancelled.' })
  } catch (err) {
    console.error('[CHECKOUT CANCEL UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
