/**
 * GET /api/account/orders
 * -----------------------
 * List orders for the authenticated user with filters and pagination.
 *
 * Query params:
 *   orderStatus  — all | confirmed | awaiting_payment | cancelled | failed
 *   paymentStatus — all | succeeded | pending | failed
 *   sortOrder    — newest | oldest
 *   branch       — branch slug
 *   search       — order number or order ID
 *   page         — page number (default 1)
 *   limit        — items per page (default 20, max 50)
 *
 * Security: Auth + rate limit + Zod validation
 */

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getClientIp } from '@/lib/security/utils'
import { listOrdersSchema } from '@/lib/validation/account-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'

export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'account_orders_list', {
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

    const { searchParams } = new URL(request.url)
    const rawParams = {
      orderStatus: searchParams.get('orderStatus') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
      branch: searchParams.get('branch') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    }

    const parsed = listOrdersSchema.safeParse(rawParams)
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstErr?.message || 'Invalid filter parameters.' },
        { status: 400 },
      )
    }

    const input = parsed.data

    const { createServerClient } = await import('@/lib/supabase/client-server')
    const supabase = await createServerClient()

    const { data, error: rpcErr } = await supabase.rpc('list_orders_for_user', {
      p_user_id: user.id,
      p_order_status: input.orderStatus === 'all' ? null : input.orderStatus,
      p_payment_status: input.paymentStatus === 'all' ? null : input.paymentStatus,
      p_sort_order: input.sortOrder,
      p_branch_slug: input.branch || null,
      p_search: input.search || null,
      p_page: input.page,
      p_limit: input.limit,
    })

    if (rpcErr) {
      console.error('[ACCOUNT ORDERS] RPC error:', rpcErr.message)
      return NextResponse.json(
        { success: false, message: 'Failed to load orders.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      orders: data?.orders || [],
      pagination: data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
  } catch (err) {
    console.error('[ACCOUNT ORDERS] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
