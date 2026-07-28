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

    // Try RPCs first, fall back to direct queries
    let summary: Record<string, unknown> | null = null
    let transactions: Array<Record<string, unknown>> = []
    let pagination = { page: input.page, limit: input.limit, total: 0, totalPages: 0 }

    const [summaryRes, transactionsRes] = await Promise.all([
      supabase.rpc('get_full_reward_summary', { p_user_id: user.id }),
      supabase.rpc('list_reward_transactions_for_user', {
        p_user_id: user.id,
        p_type: input.type === 'all' ? null : input.type,
        p_page: input.page,
        p_limit: input.limit,
      }),
    ])

    if (!summaryRes.error && summaryRes.data) {
      summary = summaryRes.data?.data || null
    }
    if (!transactionsRes.error && transactionsRes.data) {
      transactions = transactionsRes.data?.transactions || []
      pagination = transactionsRes.data?.pagination || pagination
    }

    // Direct fallback for summary if RPC failed
    if (!summary) {
      console.warn('[ACCOUNT REWARDS] Summary RPC not available, using direct query')
      try {
        // Lazy init reward_balance row
        await supabase
          .from('reward_balance')
          .upsert({ user_id: user.id }, { onConflict: 'user_id' })

        const { data: balData } = await supabase
          .from('reward_balance')
          .select('balance_points, total_earned, total_redeemed')
          .eq('user_id', user.id)
          .single()

        if (balData) {
          const balance = balData.balance_points || 0
          const redeemableValue = (Math.floor(balance / 10)) * 500
          summary = {
            balancePoints: balance,
            totalEarned: balData.total_earned || 0,
            totalRedeemed: balData.total_redeemed || 0,
            redeemableValuePaise: redeemableValue,
            redeemableValueDisplay: 'Rs ' + (redeemableValue / 100).toString(),
          }
        }
      } catch (e) {
        console.error('[ACCOUNT REWARDS] Direct summary error:', e)
      }
    }

    // Direct fallback for transactions if RPC failed
    if (transactions.length === 0 && (transactionsRes.error || !transactionsRes.data)) {
      console.warn('[ACCOUNT REWARDS] Transactions RPC not available, using direct query')
      try {
        let txQuery = supabase
          .from('reward_transactions')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)

        if (input.type && input.type !== 'all') {
          txQuery = txQuery.eq('type', input.type)
        }

        const txOffset = (input.page - 1) * input.limit
        const { data: txData, error: txErr, count: txCount } = await txQuery
          .order('created_at', { ascending: false })
          .range(txOffset, txOffset + input.limit - 1)

        if (!txErr && txData) {
          transactions = txData.map((tx: Record<string, unknown>) => ({
            id: tx.id,
            orderId: tx.order_id,
            points: tx.points,
            type: tx.type,
            reason: tx.reason,
            balanceAfter: tx.balance_after,
            createdAt: tx.created_at,
          }))
          const total = txCount || 0
          pagination = {
            page: input.page,
            limit: input.limit,
            total,
            totalPages: Math.ceil(total / input.limit),
          }
        }
      } catch (e) {
        console.error('[ACCOUNT REWARDS] Direct transactions error:', e)
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      transactions,
      pagination,
    })
  } catch (err) {
    console.error('[ACCOUNT REWARDS] Unexpected error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
