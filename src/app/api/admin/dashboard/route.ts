/**
 * GET /api/admin/dashboard
 * Returns live dashboard summary stats from the database.
 * Protected: requires valid admin session.
 * Rate limited: 60 requests per minute.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { getDashboardStats } from '@/services/admin/admin-order-service'

export async function GET(request: Request) {
  // Auth + rate limit
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_dashboard',
    rateLimitConfig: { maxAttempts: 60, windowMs: 60 * 1000, blockDurationMs: 60 * 1000 },
  })
  if (!auth.valid) return auth.errorResponse!

  const result = await getDashboardStats()

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: 'Failed to load dashboard stats' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    stats: result.stats,
  })
}
