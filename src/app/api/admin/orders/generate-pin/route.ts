/**
 * POST /api/admin/orders/generate-pin
 * ---------------------------------
 * Generates a secure 4-digit Pickup PIN for an order.
 * Only works for orders in 'preparing' status.
 * Transitions the order to 'ready_for_pickup' atomically.
 *
 * Security:
 * - Requires valid admin session
 * - Rate limited: 15 requests per minute
 * - UUID format validation on orderId
 * - Service-layer validates: order existence, status, no existing PIN
 * - Optimistic locking prevents duplicate generation
 * - All operations are logged to pickup_pin_audit_log
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { generatePickupPin } from '@/services/admin/admin-pickup-pin-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function POST(request: Request) {
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_pin_generate',
    rateLimitConfig: ADMIN_CONFIG.RATE_LIMITS.PIN_GENERATE,
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

  const { orderId } = body

  // Validate orderId presence
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Order ID is required' },
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

  // Generate the PIN
  const result = await generatePickupPin(orderId, auth.userId!)

  if (!result.success) {
    const status = result.message.includes('not found') ? 404
      : result.message.includes('Cannot generate') || result.message.includes('already been generated') || result.message.includes('already changed') || result.message.includes('already generated') ? 409
      : 500
    return NextResponse.json(
      { success: false, message: result.message },
      { status }
    )
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    pickupPin: result.pickupPin,
    generatedAt: result.generatedAt,
  })
}
