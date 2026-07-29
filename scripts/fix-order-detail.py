#!/usr/bin/env python3
"""Fix order detail API to add direct Supabase fallback."""

import os

BASE = "/home/z/my-project"

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

detail_path = os.path.join(BASE, "src/app/api/account/orders/[id]/route.ts")
content = read_file(detail_path)

old_rpc = """    const { data, error: rpcErr } = await supabase.rpc('get_order_details_for_user', {
      p_user_id: user.id,
      p_order_id: orderId,
    })

    if (rpcErr || !data?.success) {
      console.error('[ACCOUNT ORDER DETAIL] RPC error:', rpcErr?.message)
      return NextResponse.json(
        { success: false, message: 'Order not found.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      order: data.order,
    })"""

new_rpc = """    // Try RPC first, fall back to direct query
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_order_details_for_user', {
      p_user_id: user.id,
      p_order_id: orderId,
    })

    if (!rpcErr && rpcData?.success) {
      return NextResponse.json({
        success: true,
        order: rpcData.order,
      })
    }

    console.warn('[ACCOUNT ORDER DETAIL] RPC not available, using direct query:', rpcErr?.message)

    // Direct query fallback
    const { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (orderErr || !orderData) {
      return NextResponse.json(
        { success: false, message: 'Order not found.' },
        { status: 404 },
      )
    }

    // Fetch items, branch, and status history in parallel
    const [itemsRes, branchRes, historyRes] = await Promise.all([
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId),
      orderData.branch_id
        ? supabase.from('branches').select('name, address_line1, city').eq('id', orderData.branch_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from('order_status_history')
        .select('status, note, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    ])

    const order = {
      id: orderData.id,
      orderNumber: orderData.order_number,
      pickupDate: orderData.pickup_date,
      pickupSlotStart: orderData.pickup_slot_start,
      pickupSlotEnd: orderData.pickup_slot_end,
      subtotalPaise: orderData.subtotal_paise,
      donationPlantationPaise: orderData.donation_plantation_paise,
      donationHungerPaise: orderData.donation_hunger_paise,
      rewardPointsRedeemed: orderData.reward_points_redeemed,
      rewardDiscountPaise: orderData.reward_discount_paise,
      finalAmountPaise: orderData.final_amount_paise,
      rewardPointsEarned: orderData.reward_points_earned,
      paymentStatus: orderData.payment_status,
      orderStatus: orderData.order_status,
      pickupPin: orderData.pickup_pin,
      customerNotes: orderData.customer_notes,
      branch: branchRes.data ? {
        name: branchRes.data.name,
        addressLine1: branchRes.data.address_line1,
        city: branchRes.data.city,
      } : null,
      items: (itemsRes.data || []).map((oi: Record<string, unknown>) => ({
        lineKey: oi.line_key,
        itemId: oi.item_id,
        variantId: oi.variant_id,
        itemName: oi.item_name,
        itemEmoji: oi.item_emoji,
        itemType: oi.item_type,
        variantLabel: oi.variant_label,
        weightGrams: oi.weight_grams,
        pieceCount: oi.piece_count,
        unitPricePaise: oi.unit_price_paise,
        quantity: oi.quantity,
        lineTotalPaise: oi.line_total_paise,
      })),
      statusHistory: (historyRes.data || []).map((osh: Record<string, unknown>) => ({
        status: osh.status,
        note: osh.note,
        createdAt: osh.created_at,
      })),
      createdAt: orderData.created_at,
      updatedAt: orderData.updated_at,
    }

    return NextResponse.json({
      success: true,
      order,
    })"""

content = content.replace(old_rpc, new_rpc)
write_file(detail_path, content)
print("[OK] Fixed order detail API with direct Supabase fallback")
