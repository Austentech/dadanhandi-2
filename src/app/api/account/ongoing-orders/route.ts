/**
 * GET /api/account/ongoing-orders
 * ------------------------------
 * Get only active (non-terminal) orders for the user.
 * Active = confirmed (includes future: preparing, ready_for_pickup, etc.)
 * Excludes: draft, awaiting_payment, cancelled, failed, completed
 *
 * Security: Auth + rate limit
 */

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getClientIp } from '@/lib/security/utils'
import { getAuthenticatedUser } from '@/services/cart-service'

export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'account_ongoing', {
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

    const { createServerClient } = await import('@/lib/supabase/client-server')
    const supabase = await createServerClient()

    const { data, error: rpcErr } = await supabase.rpc('get_ongoing_orders_for_user', {
      p_user_id: user.id,
    })

    if (rpcErr) {
      console.error('[ACCOUNT ONGOING] RPC error:', rpcErr.message)
      return NextResponse.json(
        { success: false, message: 'Failed to load orders.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      orders: data?.orders || [],
    })
  } catch (err) {
    console.error('[ACCOUNT ONGOING] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
