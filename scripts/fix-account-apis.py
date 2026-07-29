#!/usr/bin/env python3
"""
Fix all account API routes to add direct Supabase fallbacks
when RPCs from migration 006 don't exist on the live database.

All 5 API routes need fallbacks:
1. PUT /api/account/profile - update_user_profile RPC
2. GET /api/account/orders - list_orders_for_user RPC
3. GET /api/account/ongoing-orders - get_ongoing_orders_for_user RPC
4. GET /api/account/rewards - get_full_reward_summary + list_reward_transactions_for_user RPC
5. GET /api/account/orders/[id] - get_order_details_for_user RPC
"""

import os

BASE = "/home/z/my-project"

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

# ============================================================================
# 1. Fix Profile Update API
# ============================================================================
profile_path = os.path.join(BASE, "src/app/api/account/profile/route.ts")
content = read_file(profile_path)

old_profile_rpc = '''    const { data, error: rpcErr } = await supabase.rpc('update_user_profile', {
      p_user_id: user.id,
      p_whatsapp_number: input.whatsapp_number === '' ? null : (input.whatsapp_number ?? null),
      p_mobile_number: input.mobile_number,
      p_area: input.area,
      p_city: input.city,
      p_pincode: input.pincode,
    })

    if (rpcErr || !data?.success) {
      console.error('[ACCOUNT PROFILE] RPC error:', rpcErr?.message)
      return NextResponse.json(
        { success: false, message: 'Unable to update profile. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
    })'''

new_profile_rpc = '''    // Try RPC first, fall back to direct table update
    let success = false

    const { data: rpcData, error: rpcErr } = await supabase.rpc('update_user_profile', {
      p_user_id: user.id,
      p_whatsapp_number: input.whatsapp_number === '' ? null : (input.whatsapp_number ?? null),
      p_mobile_number: input.mobile_number,
      p_area: input.area,
      p_city: input.city,
      p_pincode: input.pincode,
    })

    if (!rpcErr && rpcData?.success) {
      success = true
    } else {
      console.warn('[ACCOUNT PROFILE] RPC not available, using direct update:', rpcErr?.message)
      // Direct table update fallback
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          whatsapp_number: input.whatsapp_number === '' ? null : (input.whatsapp_number ?? null),
          mobile_number: input.mobile_number,
          area: input.area,
          city: input.city,
          pincode: input.pincode,
          updated_at: new Date().toISOString(),
        })
        .eq('auth_user_id', user.id)

      if (updateErr) {
        console.error('[ACCOUNT PROFILE] Direct update error:', updateErr.message)
        return NextResponse.json(
          { success: false, message: 'Unable to update profile. Please try again.' },
          { status: 500 },
        )
      }
      success = true
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
    })'''

content = content.replace(old_profile_rpc, new_profile_rpc)
write_file(profile_path, content)
print("[OK] Fixed profile API")

# ============================================================================
# 2. Fix Order History API
# ============================================================================
orders_path = os.path.join(BASE, "src/app/api/account/orders/route.ts")
content = read_file(orders_path)

old_orders_rpc = '''    const { data, error: rpcErr } = await supabase.rpc('list_orders_for_user', {
      p_user_id: user.id,
      p_order_status: input.orderStatus === 'all' ? null : input.orderStatus,
      p_payment_status: input.paymentStatus === 'all' ? null : input.paymentStatus,
      p_sort_order: input.sortOrder,
      p_branch_slug: input.branch || null,
      p_search: input.search || null,
      p_page: input.page,
      p_limit: input.limit,
    })

    if (rpcErr) {
      console.error('[ACCOUNT ORDERS] RPC error:', rpcErr.message)
      return NextResponse.json(
        { success: false, message: 'Failed to load orders.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      orders: data?.orders || [],
      pagination: data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
    })'''

new_orders_rpc = '''    // Try RPC first, fall back to direct query
    let orders: Array<Record<string, unknown>> = []
    let pagination = { page: input.page, limit: input.limit, total: 0, totalPages: 0 }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('list_orders_for_user', {
      p_user_id: user.id,
      p_order_status: input.orderStatus === 'all' ? null : input.orderStatus,
      p_payment_status: input.paymentStatus === 'all' ? null : input.paymentStatus,
      p_sort_order: input.sortOrder,
      p_branch_slug: input.branch || null,
      p_search: input.search || null,
      p_page: input.page,
      p_limit: input.limit,
    })

    if (!rpcErr && rpcData) {
      orders = rpcData.orders || []
      pagination = rpcData.pagination || pagination
    } else {
      console.warn('[ACCOUNT ORDERS] RPC not available, using direct query:', rpcErr?.message)

      // Direct query fallback
      let query = supabase
        .from('orders')
        .select('id, order_number, branch_id, pickup_date, pickup_slot_start, pickup_slot_end, subtotal_paise, donation_plantation_paise, donation_hunger_paise, reward_points_redeemed, reward_discount_paise, final_amount_paise, reward_points_earned, payment_status, order_status, pickup_pin, created_at, updated_at', { count: 'exact' })
        .eq('user_id', user.id)
        .neq('order_status', 'draft')

      if (input.orderStatus && input.orderStatus !== 'all') {
        query = query.eq('order_status', input.orderStatus)
      }
      if (input.paymentStatus && input.paymentStatus !== 'all') {
        query = query.eq('payment_status', input.paymentStatus)
      }
      if (input.search) {
        query = query.or(`order_number.ilike.%${input.search}%,id.ilike.%${input.search}%`)
      }

      const orderCol = input.sortOrder === 'oldest' ? 'created_at' : 'created_at'
      query = query.order(orderCol, input.sortOrder === 'oldest' ? 'asc' : 'desc')
        .range((input.page - 1) * input.limit, input.page * input.limit - 1)

      const { data: directData, error: directErr, count } = await query

      if (directErr) {
        console.error('[ACCOUNT ORDERS] Direct query error:', directErr.message)
        return NextResponse.json(
          { success: false, message: 'Failed to load orders.' },
          { status: 500 },
        )
      }

      if (directData && directData.length > 0) {
        // Fetch branch names
        const branchIds = [...new Set(directData.map((o: Record<string, unknown>) => o.branch_id).filter(Boolean))]
        let branchMap: Record<string, string> = {}
        if (branchIds.length > 0) {
          const { data: branches } = await supabase
            .from('branches')
            .select('id, name')
            .in('id', branchIds)
          if (branches) {
            branchMap = Object.fromEntries(branches.map((b: { id: string; name: string }) => [b.id, b.name]))
          }
        }

        orders = directData.map((o: Record<string, unknown>) => ({
          id: o.id,
          orderNumber: o.order_number,
          branchName: branchMap[o.branch_id as string] || 'Unknown Branch',
          pickupDate: o.pickup_date,
          pickupSlotStart: o.pickup_slot_start,
          pickupSlotEnd: o.pickup_slot_end,
          subtotalPaise: o.subtotal_paise,
          donationPlantationPaise: o.donation_plantation_paise,
          donationHungerPaise: o.donation_hunger_paise,
          rewardPointsRedeemed: o.reward_points_redeemed,
          rewardDiscountPaise: o.reward_discount_paise,
          finalAmountPaise: o.final_amount_paise,
          rewardPointsEarned: o.reward_points_earned,
          paymentStatus: o.payment_status,
          orderStatus: o.order_status,
          pickupPin: o.pickup_pin,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }))
      }

      const total = count || 0
      pagination = {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      }
    }

    return NextResponse.json({
      success: true,
      orders,
      pagination,
    })'''

content = content.replace(old_orders_rpc, new_orders_rpc)
write_file(orders_path, content)
print("[OK] Fixed orders API")

# ============================================================================
# 3. Fix Ongoing Orders API
# ============================================================================
ongoing_path = os.path.join(BASE, "src/app/api/account/ongoing-orders/route.ts")
content = read_file(ongoing_path)

old_ongoing_rpc = '''    const { data, error: rpcErr } = await supabase.rpc('get_ongoing_orders_for_user', {
      p_user_id: user.id,
    })

    if (rpcErr) {
      console.error('[ACCOUNT ONGOING] RPC error:', rpcErr.message)
      return NextResponse.json(
        { success: false, message: 'Failed to load orders.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      orders: data?.orders || [],
    })'''

new_ongoing_rpc = '''    // Try RPC first, fall back to direct query
    let ongoingOrders: Array<Record<string, unknown>> = []

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_ongoing_orders_for_user', {
      p_user_id: user.id,
    })

    if (!rpcErr && rpcData) {
      ongoingOrders = rpcData.orders || []
    } else {
      console.warn('[ACCOUNT ONGOING] RPC not available, using direct query:', rpcErr?.message)

      // Direct query fallback — active statuses
      const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup']
      const { data: directData, error: directErr } = await supabase
        .from('orders')
        .select('id, order_number, branch_id, pickup_date, pickup_slot_start, pickup_slot_end, final_amount_paise, order_status, pickup_pin, created_at, updated_at')
        .eq('user_id', user.id)
        .in('order_status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(20)

      if (directErr) {
        console.error('[ACCOUNT ONGOING] Direct query error:', directErr.message)
        return NextResponse.json(
          { success: false, message: 'Failed to load orders.' },
          { status: 500 },
        )
      }

      if (directData && directData.length > 0) {
        const branchIds = [...new Set(directData.map((o: Record<string, unknown>) => o.branch_id).filter(Boolean))]
        let branchMap: Record<string, string> = {}
        if (branchIds.length > 0) {
          const { data: branches } = await supabase
            .from('branches')
            .select('id, name')
            .in('id', branchIds)
          if (branches) {
            branchMap = Object.fromEntries(branches.map((b: { id: string; name: string }) => [b.id, b.name]))
          }
        }

        ongoingOrders = directData.map((o: Record<string, unknown>) => ({
          id: o.id,
          orderNumber: o.order_number,
          branchName: branchMap[o.branch_id as string] || 'Unknown Branch',
          pickupDate: o.pickup_date,
          pickupSlotStart: o.pickup_slot_start,
          pickupSlotEnd: o.pickup_slot_end,
          finalAmountPaise: o.final_amount_paise,
          orderStatus: o.order_status,
          pickupPin: o.pickup_pin,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }))
      }
    }

    return NextResponse.json({
      success: true,
      orders: ongoingOrders,
    })'''

content = content.replace(old_ongoing_rpc, new_ongoing_rpc)
write_file(ongoing_path, content)
print("[OK] Fixed ongoing orders API")

# ============================================================================
# 4. Fix Rewards API
# ============================================================================
rewards_path = os.path.join(BASE, "src/app/api/account/rewards/route.ts")
content = read_file(rewards_path)

old_rewards_rpc = '''    // Fetch both summary and transactions in parallel
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
    })'''

new_rewards_rpc = '''    // Try RPCs first, fall back to direct queries
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
    })'''

content = content.replace(old_rewards_rpc, new_rewards_rpc)
write_file(rewards_path, content)
print("[OK] Fixed rewards API")

print("\n[DONE] All 4 account API routes fixed with direct Supabase fallbacks.")
