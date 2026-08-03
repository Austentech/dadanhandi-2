/**
 * POST /api/admin/orders/update-status
 * Updates an order's status as part of the kitchen workflow.
 * Allowed transitions: accepted → preparing, preparing → ready_for_pickup.
 * Protected: requires valid admin session.
 * Rate limited: 30 requests per minute.
 * Concurrent-safe: uses optimistic locking via WHERE clause.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { updateOrderStatus } from '@/services/admin/admin-order-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'
import type { AdminOrderStatus } from '@/services/admin/admin-order-service'

/** Only these target statuses are allowed through this endpoint */
const ALLOWED_TARGETS: AdminOrderStatus[] = ['preparing', 'ready_for_pickup']

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_status_update',
    rateLimitConfig: ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE,
  })
  if (!auth.valid) return auth.errorResponse!

  // Parse body
  let body: { orderId?: string; targetStatus?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 }
    )
  }

  // Validate inputs
  const { orderId, targetStatus } = body

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Order ID is required' },
      { status: 400 }
    )
  }

  if (!targetStatus || typeof targetStatus !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Target status is required' },
      { status: 400 }
    )
  }

  // UUID format validation
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json(
      { success: false, message: 'Invalid order ID format' },
      { status: 400 }
    )
  }

  // Validate target status against allowlist
  if (!ALLOWED_TARGETS.includes(targetStatus as AdminOrderStatus)) {
    return NextResponse.json(
      { success: false, message: 'Invalid target status' },
      { status: 400 }
    )
  }

  // Update the order status
  const result = await updateOrderStatus(
    orderId,
    targetStatus as AdminOrderStatus,
    auth.userId!
  )

  if (!result.success) {
    const status = result.message.includes('not found') ? 404
      : result.message.includes('Cannot move') || result.message.includes('already updated') ? 409
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
