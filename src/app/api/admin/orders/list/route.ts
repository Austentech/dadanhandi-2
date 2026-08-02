/**
 * GET /api/admin/orders/list?status=confirmed&branch=slug&search=query
 * Lists orders by status with items and customer info.
 * Protected: requires valid admin session.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { listOrdersByStatus } from '@/services/admin/admin-order-service'
import type { AdminOrderStatus } from '@/services/admin/admin-order-service'

const ALLOWED_STATUSES: AdminOrderStatus[] = [
  'confirmed', 'accepted', 'preparing', 'ready_for_pickup', 'completed', 'cancelled', 'failed',
]

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_orders_list',
    rateLimitConfig: { maxAttempts: 120, windowMs: 60 * 1000, blockDurationMs: 60 * 1000 },
  })
  if (!auth.valid) return auth.errorResponse!

  // Parse query params
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'confirmed'
  const branch = searchParams.get('branch') || undefined
  const search = searchParams.get('search') || undefined
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

  // Validate status
  if (!ALLOWED_STATUSES.includes(status as AdminOrderStatus)) {
    return NextResponse.json(
      { success: false, message: 'Invalid status filter' },
      { status: 400 }
    )
  }

  const result = await listOrdersByStatus(status as AdminOrderStatus, {
    branchSlug: branch,
    search,
    limit,
    offset,
  })

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error || 'Failed to fetch orders' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    orders: result.orders,
    totalCount: result.totalCount,
  })
}
