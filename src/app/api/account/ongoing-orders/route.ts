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

    // Try RPC first, fall back to direct query
    let ongoingOrders: Array<Record<string, unknown>> = []

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_ongoing_orders_for_user', {
      p_user_id: user.id,
    })

    if (!rpcErr && rpcData) {
      ongoingOrders = rpcData.orders || []
    } else {
      console.warn('[ACCOUNT ONGOING] RPC not available, using direct query:', rpcErr?.message)

      // Direct query fallback — active statuses
      const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup']
      const { data: directData, error: directErr } = await supabase
        .from('orders')
        .select('id, order_number, branch_id, pickup_date, pickup_slot_start, pickup_slot_end, final_amount_paise, order_status, pickup_pin, created_at, updated_at')
        .eq('user_id', user.id)
        .in('order_status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(20)

      if (directErr) {
        console.error('[ACCOUNT ONGOING] Direct query error:', directErr.message)
        return NextResponse.json(
          { success: false, message: 'Failed to load orders.' },
          { status: 500 },
        )
      }

      if (directData && directData.length > 0) {
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

        ongoingOrders = directData.map((o: Record<string, unknown>) => ({
          id: o.id,
          orderNumber: o.order_number,
          branchName: branchMap[o.branch_id as string] || 'Unknown Branch',
          pickupDate: o.pickup_date,
          pickupSlotStart: o.pickup_slot_start,
          pickupSlotEnd: o.pickup_slot_end,
          finalAmountPaise: o.final_amount_paise,
          orderStatus: o.order_status,
          pickupPin: o.pickup_pin,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }))
      }
    }

    return NextResponse.json({
      success: true,
      orders: ongoingOrders,
    })
  } catch (err) {
    console.error('[ACCOUNT ONGOING] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
