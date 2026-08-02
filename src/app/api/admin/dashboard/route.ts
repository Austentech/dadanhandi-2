/**
 * GET /api/admin/dashboard
 * Returns live dashboard summary stats from the database.
 * Protected: requires valid admin session.
 * Rate limited: 60 requests per minute.
 */

import { NextResponse } from 'next/server'
import { validateAdminRequest } from '@/lib/admin/auth-helpers'
import { getDashboardStats } from '@/services/admin/admin-order-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function GET(request: Request) {
  // Auth + rate limit (uses centralized config)
  const auth = await validateAdminRequest(request, {
    rateLimitType: 'admin_dashboard',
    rateLimitConfig: ADMIN_CONFIG.RATE_LIMITS.DASHBOARD,
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
