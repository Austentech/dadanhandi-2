/**
 * GET /api/branches
 * -----------------
 * List all active pickup branches. Public (requires auth, but any logged-in
 * user can see branches — branch list is not sensitive).
 *
 * Returns branches sorted by sort_order. Branches with status='coming_soon'
 * or 'inactive' are excluded.
 */

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getAuthenticatedUser } from '@/services/cart-service'
import { listBranches } from '@/services/branch-service'

export async function GET() {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'branches_list', {
      maxAttempts: 30,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests.' },
        { status: 429 },
      )
    }

    const branches = await listBranches()

    return NextResponse.json({
      success: true,
      message: 'Branches loaded.',
      data: { branches },
    })
  } catch (err) {
    console.error('[BRANCHES LIST UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
