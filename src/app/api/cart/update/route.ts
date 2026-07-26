/**
 * POST /api/cart/update
 * ---------------------
 * Set absolute quantity for a cart line.
 * quantity >= 1 updates; the schema enforces 1..max.
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { updateCartQuantitySchema } from '@/lib/validation/cart-schemas'
import { getAuthenticatedUser, updateQuantity } from '@/services/cart-service'

export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'cart_action', {
      maxAttempts: 60,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many actions. Please slow down.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const result = updateCartQuantitySchema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    const op = await updateQuantity(user.id, result.data.lineKey, result.data.quantity)
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
    console.error('[CART UPDATE UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
