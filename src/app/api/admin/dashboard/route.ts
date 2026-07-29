/**
 * GET /api/admin/dashboard
 * Returns dashboard summary stats.
 * Reads from the orders table to show real counts.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todayRes, pendingRes, ongoingRes, completedRes] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('order_status', 'confirmed'),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .in('order_status', ['confirmed', 'preparing', 'ready_for_pickup']),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('order_status', 'completed'),
    ])

    return NextResponse.json({
      success: true,
      stats: {
        todayOrders: todayRes.count || 0,
        pendingOrders: pendingRes.count || 0,
        ongoingOrders: ongoingRes.count || 0,
        completedOrders: completedRes.count || 0,
      },
    })
  } catch (err) {
    console.error('[ADMIN API] dashboard error:', err)
    return NextResponse.json(
      { success: true, stats: { todayOrders: 0, pendingOrders: 0, ongoingOrders: 0, completedOrders: 0 } },
    )
  }
}
