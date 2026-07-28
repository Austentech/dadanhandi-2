/**
 * GET /api/account/orders/[id]
 * ---------------------------
 * Get full order details: header + items + branch + status history.
 *
 * Security: Auth + rate limit + ownership via SECURITY DEFINER RPC
 */

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getClientIp } from '@/lib/security/utils'
import { getAuthenticatedUser } from '@/services/cart-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'account_order_detail', {
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

    if (!orderId || orderId.length < 1 || orderId.length > 100) {
      return NextResponse.json(
        { success: false, message: 'Invalid order ID.' },
        { status: 400 },
      )
    }

    const { createServerClient } = await import('@/lib/supabase/client-server')
    const supabase = await createServerClient()

    const { data, error: rpcErr } = await supabase.rpc('get_order_details_for_user', {
      p_user_id: user.id,
      p_order_id: orderId,
    })

    if (rpcErr || !data?.success) {
      console.error('[ACCOUNT ORDER DETAIL] RPC error:', rpcErr?.message)
      return NextResponse.json(
        { success: false, message: 'Order not found.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      order: data.order,
    })
  } catch (err) {
    console.error('[ACCOUNT ORDER DETAIL] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
