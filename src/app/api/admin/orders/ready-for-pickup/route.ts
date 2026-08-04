/**
 * GET /api/admin/orders/ready-for-pickup?search=query&limit=50&offset=0
 * Lists all orders in 'ready_for_pickup' status.
 * Protected: requires valid admin session.
 * Rate limited: 120 requests per minute.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { listReadyForPickupOrders } from '@/services/admin/admin-order-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_ongoing_list',
    rateLimitConfig: ADMIN_CONFIG.RATE_LIMITS.ONGOING_LIST,
  })
  if (!auth.valid) return auth.errorResponse!

  // Parse query params
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

  const result = await listReadyForPickupOrders({
    search,
    limit,
    offset,
  })

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error || 'Failed to fetch ready orders' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    orders: result.orders,
    totalCount: result.totalCount,
  })
}
