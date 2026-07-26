/**
 * POST /api/cart/clear
 * --------------------
 * Empty the user's entire plate.
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getAuthenticatedUser, clearCart } from '@/services/cart-service'

export async function POST() {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'cart_action', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many actions. Please slow down.' },
        { status: 429 },
      )
    }

    const op = await clearCart(user.id)
    if (!op.success) {
      return NextResponse.json(
        { success: false, message: op.message },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: op.message,
      data: { cart: op.cart, totals: op.totals },
    })
  } catch (err) {
    console.error('[CART CLEAR UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
