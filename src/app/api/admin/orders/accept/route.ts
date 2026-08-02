/**
 * POST /api/admin/orders/accept
 * Accepts a pending order (confirmed → accepted).
 * Protected: requires valid admin session.
 * Rate limited: 30 requests per minute.
 * Idempotent: returns success if order is already accepted.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { acceptOrder } from '@/services/admin/admin-order-service'

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_accept_order',
    rateLimitConfig: { maxAttempts: 30, windowMs: 60 * 1000, blockDurationMs: 2 * 60 * 1000 },
  })
  if (!auth.valid) return auth.errorResponse!

  // Parse body
  let body: { orderId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 }
    )
  }

  // Validate input
  const { orderId } = body
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Order ID is required' },
      { status: 400 }
    )
  }

  // UUID format validation (basic)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json(
      { success: false, message: 'Invalid order ID format' },
      { status: 400 }
    )
  }

  // Accept the order
  const result = await acceptOrder(orderId, auth.userId!)

  if (!result.success) {
    const status = result.message.includes('not found') ? 404
      : result.message.includes('Cannot accept') ? 409
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
