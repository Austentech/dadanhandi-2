/**
 * GET /api/checkout/order/[id]
 * ----------------------------
 * Get the full order (header + items + branch snapshot) for the authenticated user.
 *
 * Used by the confirmation page to poll for payment status. Once the
 * Stripe webhook fires and marks the order as 'confirmed', this endpoint
 * returns the updated state and the client stops polling.
 *
 * Security:
 *  - Requires authenticated session
 *  - Order can only be fetched by its owner (RLS + RPC double-check)
 *  - Rate limited (generous — polling endpoint)
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { orderIdSchema } from '@/lib/validation/checkout-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'
import { getOrderForUser } from '@/services/order-service'
import type { Branch } from '@/types/checkout'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Auth check
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    // 2. Rate limit (generous — polling endpoint)
    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'checkout_get_order', {
      maxAttempts: 60,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests.' },
        { status: 429 },
      )
    }

    // 3. Parse path param
    const { id: orderId } = await params
    const parsed = orderIdSchema.safeParse(orderId)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid order ID.' },
        { status: 400 },
      )
    }

    // 4. Fetch order
    const result = await getOrderForUser(user.id, parsed.data)
    if (!result.success || !result.order) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 404 },
      )
    }

    const order = result.order

    // 5. Fetch branch snapshot for display
    let branchSnapshot: {
      id: string
      slug: string
      name: string
      addressLine1: string
      addressLine2: string | null
      city: string
      state: string
    } | undefined

    try {
      const { createServerClient } = await import('@/lib/supabase/client-server')
      const supabase = await createServerClient()
      const { data: branchRow } = await supabase
        .from('branches')
        .select('*')
        .eq('id', order.branchId)
        .maybeSingle()

      if (branchRow) {
        const branch = branchRow as unknown as Branch
        branchSnapshot = {
          id: branch.id,
          slug: branch.slug,
          name: branch.name,
          addressLine1: branch.addressLine1,
          addressLine2: branch.addressLine2,
          city: branch.city,
          state: branch.state,
        }
      }
    } catch {
      // Non-critical — confirmation page can render without branch snapshot
    }

    // 6. Return order with items + branch
    return NextResponse.json({
      success: true,
      message: 'Order loaded.',
      data: {
        order: {
          ...order,
          branch: branchSnapshot,
        },
      },
    })
  } catch (err) {
    console.error('[GET ORDER UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
