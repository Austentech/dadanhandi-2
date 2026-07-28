/**
 * GET /api/account/rewards
 * ----------------------
 * Get reward summary + transaction history.
 *
 * Query params:
 *   type  — all | earn | redeem | adjust | restore (default: all)
 *   page  — page number (default 1)
 *   limit — items per page (default 20)
 *
 * Returns combined reward summary + paginated transactions.
 */

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { getClientIp } from '@/lib/security/utils'
import { listRewardTransactionsSchema } from '@/lib/validation/account-schemas'
import { getAuthenticatedUser } from '@/services/cart-service'

export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'account_rewards', {
      maxAttempts: 20,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please slow down.' },
        { status: 429 },
      )
    }

    const { searchParams } = new URL(request.url)
    const rawParams = {
      type: searchParams.get('type') || 'all',
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    }

    const parsed = listRewardTransactionsSchema.safeParse(rawParams)
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstErr?.message || 'Invalid parameters.' },
        { status: 400 },
      )
    }

    const input = parsed.data

    const { createServerClient } = await import('@/lib/supabase/client-server')
    const supabase = await createServerClient()

    // Fetch both summary and transactions in parallel
    const [summaryRes, transactionsRes] = await Promise.all([
      supabase.rpc('get_full_reward_summary', { p_user_id: user.id }),
      supabase.rpc('list_reward_transactions_for_user', {
        p_user_id: user.id,
        p_type: input.type === 'all' ? null : input.type,
        p_page: input.page,
        p_limit: input.limit,
      }),
    ])

    if (summaryRes.error) {
      console.error('[ACCOUNT REWARDS] Summary RPC error:', summaryRes.error.message)
    }
    if (transactionsRes.error) {
      console.error('[ACCOUNT REWARDS] Transactions RPC error:', transactionsRes.error.message)
    }

    return NextResponse.json({
      success: true,
      summary: summaryRes.data?.data || null,
      transactions: transactionsRes.data?.transactions || [],
      pagination: transactionsRes.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
  } catch (err) {
    console.error('[ACCOUNT REWARDS] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
