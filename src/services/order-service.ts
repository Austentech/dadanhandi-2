/**
 * Order Service (server-side)
 * ---------------------------
 * Creates, retrieves, and updates orders.
 *
 * SECURITY:
 *  - Every mutation goes through SECURITY DEFINER RPCs in the database
 *    (never direct table writes from the app layer).
 *  - The application layer performs FULL server-side validation BEFORE
 *    calling the RPC: cart re-pricing, branch validation, slot validation,
 *    reward redemption preview. The RPC then re-validates everything
 *    (defense in depth).
 *
 * LIFECYCLE:
 *  - createDraftOrder() → order_status='draft', payment_status='pending'
 *  - attachPaymentIntent() → order_status='awaiting_payment'
 *  - markSucceeded() (webhook) → order_status='confirmed', payment_status='succeeded',
 *      reward points awarded, cart cleared
 *  - markFailed() (webhook) → order_status='failed', payment_status='failed',
 *      redeemed reward points restored
 *  - cancelOrder() → order_status='cancelled', redeemed points restored
 */

import { createServerClient } from '@/lib/supabase/client-server'
import type {
  OrderHeader,
  OrderItem,
  OrderWithDetails,
} from '@/types/checkout'
import type { CartItem } from '@/types/menu'

// ============================================================================
// TYPES
// ============================================================================
interface DbOrderRow {
  id: string
  order_number: string
  user_id: string
  branch_id: string
  pickup_date: string
  pickup_slot_start: string
  pickup_slot_end: string
  subtotal_paise: number
  donation_plantation_paise: number
  donation_hunger_paise: number
  reward_points_redeemed: number
  reward_discount_paise: number
  final_amount_paise: number
  reward_points_earned: number
  payment_status: string
  order_status: string
  razorpay_order_id: string | null
  customer_notes: string | null
  created_at: string
  updated_at: string
}

interface DbOrderItemRow {
  line_key: string
  item_id: string
  variant_id: string
  item_name: string
  item_emoji: string
  item_type: 'fixed' | 'weight' | 'piece'
  variant_label: string
  weight_grams: number | null
  piece_count: number | null
  unit_price_paise: number
  quantity: number
  line_total_paise: number
}

// ============================================================================
// ROW → DOMAIN MAPPING
// ============================================================================
function dbOrderToHeader(row: DbOrderRow): OrderHeader {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    branchId: row.branch_id,
    pickupDate: row.pickup_date,
    pickupSlotStart: row.pickup_slot_start,
    pickupSlotEnd: row.pickup_slot_end,
    subtotalPaise: row.subtotal_paise,
    donationPlantationPaise: row.donation_plantation_paise,
    donationHungerPaise: row.donation_hunger_paise,
    rewardPointsRedeemed: row.reward_points_redeemed,
    rewardDiscountPaise: row.reward_discount_paise,
    finalAmountPaise: row.final_amount_paise,
    rewardPointsEarned: row.reward_points_earned,
    paymentStatus: row.payment_status as OrderHeader['paymentStatus'],
    orderStatus: row.order_status as OrderHeader['orderStatus'],
    razorpayOrderId: row.razorpay_order_id,
    customerNotes: row.customer_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function dbItemToOrderItem(row: DbOrderItemRow): OrderItem {
  return {
    lineKey: row.line_key,
    itemId: row.item_id,
    variantId: row.variant_id,
    itemName: row.item_name,
    itemEmoji: row.item_emoji,
    itemType: row.item_type,
    variantLabel: row.variant_label,
    weightGrams: row.weight_grams,
    pieceCount: row.piece_count,
    unitPricePaise: row.unit_price_paise,
    quantity: row.quantity,
    lineTotalPaise: row.line_total_paise,
  }
}

// ============================================================================
// CREATE DRAFT ORDER
// ============================================================================
export interface CreateDraftOrderParams {
  userId: string
  branchId: string
  pickupDate: string  // YYYY-MM-DD
  pickupSlotStart: string  // HH:MM:SS
  pickupSlotEnd: string  // HH:MM:SS
  subtotalPaise: number
  donationPlantationPaise: number
  donationHungerPaise: number
  rewardPointsToRedeem: number
  rewardDiscountPaise: number
  finalAmountPaise: number
  idempotencyKey: string
  cartItems: CartItem[]
}

export interface CreateDraftOrderResult {
  success: boolean
  message: string
  orderId?: string
  orderNumber?: string
}

/**
 * Create a draft order with all items. Atomic via SECURITY DEFINER RPC.
 *
 * The RPC handles:
 *  - Reward point deduction (if any)
 *  - Reward transaction ledger entry (redeem type)
 *  - Order row insert
 *  - Order items row insert
 *  - Subtotal verification (sum of items vs declared subtotal)
 *  - Final amount verification (subtotal + donations - discount)
 *  - Idempotency key uniqueness (DB constraint)
 *
 * If the same idempotency_key is submitted twice, the second call fails
 * with a unique constraint violation — caller catches and returns the
 * original order info.
 */
export async function createDraftOrder(
  params: CreateDraftOrderParams,
): Promise<CreateDraftOrderResult> {
  const supabase = await createServerClient()

  // Build items JSON for the RPC
  const itemsJson = params.cartItems.map((item) => ({
    line_key: item.lineKey,
    item_id: item.itemId,
    variant_id: item.variantId,
    item_name: item.itemName,
    item_emoji: item.itemEmoji,
    item_type: item.itemType,
    variant_label: item.variantLabel,
    weight_grams: item.weightGrams ?? null,
    piece_count: item.pieceCount ?? null,
    unit_price_paise: item.unitPricePaise,
    quantity: item.quantity,
    line_total_paise: item.unitPricePaise * item.quantity,
  }))

  const { data, error } = await supabase.rpc('create_draft_order', {
    p_user_id: params.userId,
    p_branch_id: params.branchId,
    p_pickup_date: params.pickupDate,
    p_slot_start: params.pickupSlotStart,
    p_slot_end: params.pickupSlotEnd,
    p_subtotal_paise: params.subtotalPaise,
    p_donation_plantation_paise: params.donationPlantationPaise,
    p_donation_hunger_paise: params.donationHungerPaise,
    p_reward_points_to_redeem: params.rewardPointsToRedeem,
    p_reward_discount_paise: params.rewardDiscountPaise,
    p_final_amount_paise: params.finalAmountPaise,
    p_idempotency_key: params.idempotencyKey,
    p_items: itemsJson,
  })

  if (error) {
    // Idempotency conflict: caller has submitted this key before.
    // Return the existing order if we can find it.
    if (error.code === '23505' && error.message.includes('idempotency_key')) {
      return {
        success: false,
        message: 'DUPLICATE_IDEMPOTENCY_KEY',  // special code caller checks for
      }
    }
    console.error('[ORDER SERVICE] createDraftOrder RPC error:', error.message, error.code)
    return { success: false, message: 'Failed to create order. Please try again.' }
  }

  const result = data as {
    success: boolean
    message?: string
    order_id?: string
    order_number?: string
  } | null

  if (!result?.success) {
    return { success: false, message: result?.message || 'Failed to create order.' }
  }

  return {
    success: true,
    message: 'Draft order created.',
    orderId: result.order_id,
    orderNumber: result.order_number,
  }
}

// ============================================================================
// FIND ORDER BY IDEMPOTENCY KEY
// ============================================================================
/**
 * Find an existing draft/awaiting_payment order by idempotency key.
 * Used to handle duplicate create-order requests gracefully — if the
 * same idempotency_key is submitted twice, we return the original order
 * instead of erroring out.
 */
export async function findOrderByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): Promise<OrderHeader | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error) {
    console.error('[ORDER SERVICE] findOrderByIdempotencyKey error:', error.message)
    return null
  }

  if (!data) return null
  return dbOrderToHeader(data as DbOrderRow)
}

// ============================================================================
// ATTACH RAZORPAY ORDER TO INTERNAL ORDER
// ============================================================================
export async function attachRazorpayOrderToOrder(params: {
  orderId: string
  userId: string
  razorpayOrderId: string
  amountPaise: number
}): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('attach_razorpay_order_to_order', {
    p_order_id: params.orderId,
    p_user_id: params.userId,
    p_razorpay_order_id: params.razorpayOrderId,
    p_amount_paise: params.amountPaise,
  })

  if (error) {
    console.error('[ORDER SERVICE] attachRazorpayOrderToOrder RPC error:', error.message)
    return { success: false, message: 'Failed to link payment to order.' }
  }

  const result = data as { success: boolean; message?: string } | null
  return {
    success: result?.success ?? false,
    message: result?.message || 'Failed to link payment to order.',
  }
}

// ============================================================================
// MARK ORDER SUCCEEDED
// ============================================================================
// Called EITHER from:
//  - /api/checkout/verify-payment (primary, after client verifies signature)
//  - /api/razorpay/webhook (secondary, for resilience if client closes browser)
export async function markOrderSucceeded(params: {
  orderId: string
  razorpayPaymentId: string
  razorpaySignature: string
  webhookEventId: string
  eventType: string
  rawPayload: unknown
}): Promise<{ success: boolean; message: string; rewardPointsEarned?: number }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('mark_order_succeeded', {
    p_order_id: params.orderId,
    p_razorpay_payment_id: params.razorpayPaymentId,
    p_razorpay_signature: params.razorpaySignature,
    p_webhook_event_id: params.webhookEventId,
    p_event_type: params.eventType,
    p_raw_payload: params.rawPayload,
  })

  if (error) {
    console.error('[ORDER SERVICE] markOrderSucceeded RPC error:', error.message)
    return { success: false, message: 'Failed to mark order as succeeded.' }
  }

  const result = data as {
    success: boolean
    message?: string
    reward_points_earned?: number
    idempotent?: boolean
  } | null

  return {
    success: result?.success ?? false,
    message: result?.message || 'Failed to mark order as succeeded.',
    rewardPointsEarned: result?.reward_points_earned,
  }
}

// ============================================================================
// MARK ORDER FAILED
// ============================================================================
// Called EITHER from verify-payment (signature invalid) or from webhook.
export async function markOrderFailed(params: {
  orderId: string
  failureReason: string
  webhookEventId: string
  eventType: string
  rawPayload: unknown
}): Promise<{ success: boolean; message: string; rewardPointsRestored?: number }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('mark_order_failed', {
    p_order_id: params.orderId,
    p_failure_reason: params.failureReason,
    p_webhook_event_id: params.webhookEventId,
    p_event_type: params.eventType,
    p_raw_payload: params.rawPayload,
  })

  if (error) {
    console.error('[ORDER SERVICE] markOrderFailed RPC error:', error.message)
    return { success: false, message: 'Failed to mark order as failed.' }
  }

  const result = data as {
    success: boolean
    message?: string
    reward_points_restored?: number
    idempotent?: boolean
  } | null

  return {
    success: result?.success ?? false,
    message: result?.message || 'Failed to mark order as failed.',
    rewardPointsRestored: result?.reward_points_restored,
  }
}

// ============================================================================
// GET ORDER (with items + branch)
// ============================================================================
export async function getOrderForUser(
  userId: string,
  orderId: string,
): Promise<{ success: boolean; message: string; order?: OrderWithDetails }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('get_order_for_user', {
    p_user_id: userId,
    p_order_id: orderId,
  })

  if (error) {
    console.error('[ORDER SERVICE] getOrderForUser RPC error:', error.message)
    return { success: false, message: 'Failed to load order.' }
  }

  const result = data as {
    success: boolean
    message?: string
    order?: DbOrderRow
    items?: DbOrderItemRow[]
  } | null

  if (!result?.success || !result.order) {
    return { success: false, message: result?.message || 'Order not found.' }
  }

  const order: OrderWithDetails = {
    ...dbOrderToHeader(result.order),
    items: (result.items || []).map(dbItemToOrderItem),
  }

  return { success: true, message: 'Order loaded.', order }
}

// ============================================================================
// CANCEL DRAFT ORDER
// ============================================================================
export async function cancelDraftOrder(
  userId: string,
  orderId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('cancel_draft_order', {
    p_user_id: userId,
    p_order_id: orderId,
  })

  if (error) {
    console.error('[ORDER SERVICE] cancelDraftOrder RPC error:', error.message)
    return { success: false, message: 'Failed to cancel order.' }
  }

  const result = data as { success: boolean; message?: string } | null
  return {
    success: result?.success ?? false,
    message: result?.message || 'Failed to cancel order.',
  }
}

// ============================================================================
// GET ORDER BY RAZORPAY ORDER ID (used by webhook)
// ============================================================================
/**
 * Find an order by its Razorpay order_id. Used by the webhook handler
 * to locate the order from the webhook payload.
 */
export async function findOrderByRazorpayOrderId(
  razorpayOrderId: string,
): Promise<OrderHeader | null> {
  // Use the admin client for webhook (service role bypasses RLS)
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('razorpay_order_id', razorpayOrderId)
    .maybeSingle()

  if (error) {
    console.error('[ORDER SERVICE] findOrderByRazorpayOrderId error:', error.message)
    return null
  }

  if (!data) return null
  return dbOrderToHeader(data as DbOrderRow)
}
