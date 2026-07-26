/**
 * POST /api/cart/add
 * ------------------
 * Add an item (or merge qty) to the user's plate.
 *
 * Security:
 *  - Requires authenticated session
 *  - Validates request body with Zod
 *  - Validates item + variant exist in catalog (server-side)
 *  - RECALCULATES unit price server-side (never trusts client)
 *  - Rate limited per user + per IP
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { addToCartSchema } from '@/lib/validation/cart-schemas'
import { getAuthenticatedUser, addItem } from '@/services/cart-service'

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    // 2. Rate limit (per IP + per user)
    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'cart_action', {
      maxAttempts: 30,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many actions. Please slow down.' },
        { status: 429 },
      )
    }
    const userCheck = checkRateLimit(user.id, 'cart_action', {
      maxAttempts: 30,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!userCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many actions. Please slow down.' },
        { status: 429 },
      )
    }

    // 3. Parse + validate body
    const body = await request.json()
    const result = addToCartSchema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Invalid request.' },
        { status: 400 },
      )
    }

    // 4. Add item (server-side validation + price recalc happens here)
    const op = await addItem(user.id, result.data)
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
    console.error('[CART ADD UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
