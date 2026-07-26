/**
 * POST /api/cart/remove
 * ---------------------
 * Remove a single cart line by line_key.
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { removeFromCartSchema } from '@/lib/validation/cart-schemas'
import { getAuthenticatedUser, removeItem } from '@/services/cart-service'

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
    const result = removeFromCartSchema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    const op = await removeItem(user.id, result.data.lineKey)
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
    console.error('[CART REMOVE UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
