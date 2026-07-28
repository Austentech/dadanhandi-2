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

    // Try RPC first, fall back to direct query
    let orders: Array<Record<string, unknown>> = []
    let pagination = { page: input.page, limit: input.limit, total: 0, totalPages: 0 }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('list_orders_for_user', {
      p_user_id: user.id,
      p_order_status: input.orderStatus === 'all' ? null : input.orderStatus,
      p_payment_status: input.paymentStatus === 'all' ? null : input.paymentStatus,
      p_sort_order: input.sortOrder,
      p_branch_slug: input.branch || null,
      p_search: input.search || null,
      p_page: input.page,
      p_limit: input.limit,
    })

    if (!rpcErr && rpcData) {
      orders = rpcData.orders || []
      pagination = rpcData.pagination || pagination
    } else {
      console.warn('[ACCOUNT ORDERS] RPC not available, using direct query:', rpcErr?.message)

      // Direct query fallback
      let query = supabase
        .from('orders')
        .select('id, order_number, branch_id, pickup_date, pickup_slot_start, pickup_slot_end, subtotal_paise, donation_plantation_paise, donation_hunger_paise, reward_points_redeemed, reward_discount_paise, final_amount_paise, reward_points_earned, payment_status, order_status, pickup_pin, created_at, updated_at', { count: 'exact' })
        .eq('user_id', user.id)
        .neq('order_status', 'draft')

      if (input.orderStatus && input.orderStatus !== 'all') {
        query = query.eq('order_status', input.orderStatus)
      }
      if (input.paymentStatus && input.paymentStatus !== 'all') {
        query = query.eq('payment_status', input.paymentStatus)
      }
      if (input.search) {
        query = query.or(`order_number.ilike.%${input.search}%,id.ilike.%${input.search}%`)
      }

      const orderCol = input.sortOrder === 'oldest' ? 'created_at' : 'created_at'
      query = query.order(orderCol, input.sortOrder === 'oldest' ? 'asc' : 'desc')
        .range((input.page - 1) * input.limit, input.page * input.limit - 1)

      const { data: directData, error: directErr, count } = await query

      if (directErr) {
        console.error('[ACCOUNT ORDERS] Direct query error:', directErr.message)
        return NextResponse.json(
          { success: false, message: 'Failed to load orders.' },
          { status: 500 },
        )
      }

      if (directData && directData.length > 0) {
        // Fetch branch names
        const branchIds = [...new Set(directData.map((o: Record<string, unknown>) => o.branch_id).filter(Boolean))]
        let branchMap: Record<string, string> = {}
        if (branchIds.length > 0) {
          const { data: branches } = await supabase
            .from('branches')
            .select('id, name')
            .in('id', branchIds)
          if (branches) {
            branchMap = Object.fromEntries(branches.map((b: { id: string; name: string }) => [b.id, b.name]))
          }
        }

        orders = directData.map((o: Record<string, unknown>) => ({
          id: o.id,
          orderNumber: o.order_number,
          branchName: branchMap[o.branch_id as string] || 'Unknown Branch',
          pickupDate: o.pickup_date,
          pickupSlotStart: o.pickup_slot_start,
          pickupSlotEnd: o.pickup_slot_end,
          subtotalPaise: o.subtotal_paise,
          donationPlantationPaise: o.donation_plantation_paise,
          donationHungerPaise: o.donation_hunger_paise,
          rewardPointsRedeemed: o.reward_points_redeemed,
          rewardDiscountPaise: o.reward_discount_paise,
          finalAmountPaise: o.final_amount_paise,
          rewardPointsEarned: o.reward_points_earned,
          paymentStatus: o.payment_status,
          orderStatus: o.order_status,
          pickupPin: o.pickup_pin,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }))
      }

      const total = count || 0
      pagination = {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      }
    }

    return NextResponse.json({
      success: true,
      orders,
      pagination,
    })
  } catch (err) {
    console.error('[ACCOUNT ORDERS] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
