/**
 * GET /api/cart/get
 * -----------------
 * Fetch the user's current cart and totals.
 * Returns empty cart for unauthenticated users (with 401 status so client
 * can fallback to local-only state if desired).
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getCart } from '@/services/cart-service'

export async function GET() {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const { cart, totals } = await getCart(user.id)
    return NextResponse.json({
      success: true,
      data: { cart, totals },
    })
  } catch (err) {
    console.error('[CART GET UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
