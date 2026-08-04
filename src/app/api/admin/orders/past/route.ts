/**
 * GET /api/admin/orders/past?search=query&sort=newest&limit=20&offset=0
 * Lists all completed orders with customer, branch, PIN, and completion info.
 * Protected: requires valid admin session.
 * Rate limited: 60 requests per minute.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { listPastOrders } from '@/services/admin/admin-order-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function GET(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_past_list',
    rateLimitConfig: ADMIN_CONFIG.RATE_LIMITS.PAST_LIST,
  })
  if (!auth.valid) return auth.errorResponse!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const sortOrder = (searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest') as 'newest' | 'oldest'
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 100)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

  const result = await listPastOrders({ search, sortOrder, limit, offset })

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error || 'Failed to fetch past orders' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    orders: result.orders,
    totalCount: result.totalCount,
  })
}
