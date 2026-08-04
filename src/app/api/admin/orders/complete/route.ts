/**
 * POST /api/admin/orders/complete
 * ---------------------------
 * Marks an order as completed.
 * Only works for orders in 'ready_for_pickup' status.
 * Protected: requires valid admin session.
 * Rate limited: 20 requests per minute.
 * Concurrent-safe: uses optimistic locking.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { completeOrder } from '@/services/admin/admin-order-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_complete_order',
    rateLimitConfig: ADMIN_CONFIG.RATE_LIMITS.COMPLETE_ORDER,
  })
  if (!auth.valid) return auth.errorResponse!

  let body: { orderId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { orderId } = body

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Order ID is required' },
      { status: 400 }
    )
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json(
      { success: false, message: 'Invalid order ID format' },
      { status: 400 }
    )
  }

  const result = await completeOrder(orderId, auth.userId!)

  if (!result.success) {
    const status = result.message.includes('not found') ? 404
      : result.message.includes('Cannot complete') || result.message.includes('already been completed') || result.message.includes('already changed') ? 409
      : 500
    return NextResponse.json(
      { success: false, message: result.message },
      { status }
    )
  }

  return NextResponse.json({
    success: true,
    message: result.message,
  })
}
