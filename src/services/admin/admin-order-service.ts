/**
 * Admin Order Service
 * Handles admin-side order operations: listing, status transitions, stats.
 * All database access uses the service_role client to bypass RLS.
 *
 * Phase 3 Module 3: Integrated preparation window scheduling.
 * - Dashboard "Pending" = confirmed + paid + in preparation window
 * - Dashboard "Upcoming" = confirmed + paid + today + AFTER preparation window
 * - New Orders list only shows orders within the preparation window
 */

import { createAdminClient } from '@/lib/supabase/client-admin'
import type { DashboardStats } from '@/store/admin-store'
import { getPreparationWindowBounds } from './admin-scheduling-service'

// ============================================================================
// TYPES
// ============================================================================

/** Order statuses relevant to admin operations */
export type AdminOrderStatus =
  | 'confirmed'        // paid, awaiting admin acceptance
  | 'accepted'         // admin accepted, kitchen starts
  | 'preparing'        // kitchen is cooking
  | 'ready_for_pickup' // food ready, customer can collect
  | 'completed'        // picked up / done
  | 'cancelled'        // cancelled
  | 'failed'           // payment failed

/** Valid status transitions (from -> allowed to[]) */
const VALID_TRANSITIONS: Record<string, AdminOrderStatus[]> = {
  confirmed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: [],
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export interface DashboardStatsResult {
  success: boolean
  stats: DashboardStats
  error?: string
}

/**
 * Fetch dashboard statistics from the database.
 * Returns counts for each order status category.
 *
 * IMPORTANT: "Pending" and "Upcoming" now use the preparation window.
 *   - Pending (Current Queue): confirmed + paid + pickup slot within window
 *   - Upcoming: confirmed + paid + today + pickup slot AFTER window
 */
export async function getDashboardStats(): Promise<DashboardStatsResult> {
  try {
    const supabase = createAdminClient()
    const bounds = getPreparationWindowBounds()

    // Get today's date range in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istTime.getFullYear(), istTime.getMonth(), istTime.getDate())
    const todayStartUTC = new Date(todayStart.getTime() - istOffset)

    const [todayRes, acceptedRes, preparingRes, readyRes, completedRes, cancelledRes] =
      await Promise.all([
        // Today's orders (all non-draft statuses)
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .neq('order_status', 'draft')
          .gte('created_at', todayStartUTC.toISOString()),
        // Accepted
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('order_status', 'accepted'),
        // Preparing
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('order_status', 'preparing'),
        // Ready for pickup
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('order_status', 'ready_for_pickup'),
        // Completed (today)
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('order_status', 'completed')
          .gte('created_at', todayStartUTC.toISOString()),
        // Cancelled (today)
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('order_status', 'cancelled')
          .gte('created_at', todayStartUTC.toISOString()),
      ])

    // --- Pending (Current Queue): confirmed + paid + in preparation window + overdue ---
    // Includes: orders in window + overdue (slot passed) + past-date unaccepted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    const windowEndStr = `${String(Math.floor(bounds.windowEndMinutes / 60)).padStart(2, '0')}:${String(bounds.windowEndMinutes % 60).padStart(2, '0')}:00`

    // Pending today: in-window + overdue (slot <= windowEnd, no lower bound)
    const { count: pendingTodayCount } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'confirmed')
      .eq('payment_status', 'succeeded')
      .eq('pickup_date', bounds.todayDateStr)
      .lte('pickup_slot_start', windowEndStr)

    // Pending past: overdue from yesterday or earlier
    const { count: pendingPastCount } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'confirmed')
      .eq('payment_status', 'succeeded')
      .lt('pickup_date', bounds.todayDateStr)

    const pendingCount = (pendingTodayCount || 0) + (pendingPastCount || 0)

    // --- Upcoming: confirmed + paid + today + AFTER preparation window ---
    const { count: upcomingCount } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'confirmed')
      .eq('payment_status', 'succeeded')
      .eq('pickup_date', bounds.todayDateStr)
      .gt('pickup_slot_start', windowEndStr)

    return {
      success: true,
      stats: {
        todayOrders: todayRes.count || 0,
        pendingOrders: pendingCount || 0,
        acceptedOrders: acceptedRes.count || 0,
        preparingOrders: preparingRes.count || 0,
        readyOrders: readyRes.count || 0,
        completedOrders: completedRes.count || 0,
        cancelledOrders: cancelledRes.count || 0,
        upcomingOrders: upcomingCount || 0,
      },
    }
  } catch (err) {
    console.error('[ADMIN ORDER SERVICE] getDashboardStats error:', err)
    return { success: false, stats: emptyStats() }
  }
}

function emptyStats(): DashboardStats {
  return {
    todayOrders: 0,
    pendingOrders: 0,
    acceptedOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    upcomingOrders: 0,
  }
}

// ============================================================================
// RAW DATABASE ROW TYPES (snake_case from Supabase)
// ============================================================================

interface RawOrderRow {
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
  payment_method: string | null
  razorpay_order_id: string | null
  customer_notes: string | null
  created_at: string
  updated_at: string
  order_items?: RawOrderItemRow[]
  branchs?: { name: string; slug: string; city: string } | null
}

interface RawOrderItemRow {
  id: string
  order_id: string
  line_key: string
  item_id: string
  variant_id: string
  item_name: string
  item_emoji: string
  item_type: string
  variant_label: string
  weight_grams: number | null
  piece_count: number | null
  unit_price_paise: number
  quantity: number
  line_total_paise: number
  created_at: string
}

interface RawProfileRow {
  id: string
  full_name: string | null
  whatsapp_number: string | null
  mobile_number: string | null
}

// ============================================================================
// MAPPED (camelCase) TYPES — used by frontend
// ============================================================================

export interface AdminOrderItem {
  id: string
  orderNumber: string
  userId: string
  branchId: string
  pickupDate: string
  pickupSlotStart: string
  pickupSlotEnd: string
  subtotalPaise: number
  donationPlantationPaise: number
  donationHungerPaise: number
  rewardPointsRedeemed: number
  rewardDiscountPaise: number
  finalAmountPaise: number
  rewardPointsEarned: number
  paymentStatus: string
  paymentMethod: string | null
  orderStatus: string
  razorpayOrderId: string | null
  customerNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminOrderItemDetail {
  lineKey: string
  itemName: string
  itemEmoji: string
  variantLabel: string
  weightGrams: number | null
  pieceCount: number | null
  unitPricePaise: number
  quantity: number
  lineTotalPaise: number
}

export interface AdminOrderWithItems extends AdminOrderItem {
  items: AdminOrderItemDetail[]
  branch?: {
    name: string
    slug: string
    city: string
  } | null
  customer?: {
    name: string
    whatsappNumber: string | null
    mobileNumber: string | null
  } | null
  /**
   * True if the pickup slot has already passed but the order
   * was never accepted by admin. Computed server-side.
   */
  isOverdue?: boolean
}

export interface ListOrdersResult {
  success: boolean
  orders: AdminOrderWithItems[]
  totalCount: number
  error?: string
}

// ============================================================================
// MAPPING HELPERS
// ============================================================================

/** Map a raw DB order row (snake_case) to camelCase AdminOrderItem */
function mapOrderRow(raw: RawOrderRow): AdminOrderItem {
  return {
    id: raw.id,
    orderNumber: raw.order_number,
    userId: raw.user_id,
    branchId: raw.branch_id,
    pickupDate: raw.pickup_date,
    pickupSlotStart: raw.pickup_slot_start,
    pickupSlotEnd: raw.pickup_slot_end,
    subtotalPaise: raw.subtotal_paise,
    donationPlantationPaise: raw.donation_plantation_paise,
    donationHungerPaise: raw.donation_hunger_paise,
    rewardPointsRedeemed: raw.reward_points_redeemed,
    rewardDiscountPaise: raw.reward_discount_paise,
    finalAmountPaise: raw.final_amount_paise,
    rewardPointsEarned: raw.reward_points_earned,
    paymentStatus: raw.payment_status,
    paymentMethod: raw.payment_method,
    orderStatus: raw.order_status,
    razorpayOrderId: raw.razorpay_order_id,
    customerNotes: raw.customer_notes,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

/** Map a raw DB order_item row (snake_case) to camelCase AdminOrderItemDetail */
function mapOrderItemRow(raw: RawOrderItemRow): AdminOrderItemDetail {
  return {
    lineKey: raw.line_key,
    itemName: raw.item_name,
    itemEmoji: raw.item_emoji,
    variantLabel: raw.variant_label,
    weightGrams: raw.weight_grams,
    pieceCount: raw.piece_count,
    unitPricePaise: raw.unit_price_paise,
    quantity: raw.quantity,
    lineTotalPaise: raw.line_total_paise,
  }
}

// ============================================================================
// LIST ORDERS
// ============================================================================

/**
 * List orders with a given status, including items and customer info.
 * For 'confirmed' status:
 *   - Only shows PAID orders (payment_status='succeeded')
 *   - Shows orders in the preparation window (current queue)
 *   - Shows OVERDUE orders whose pickup slot has already passed (never accepted)
 *   - Shows past-date orders (yesterday or earlier, still confirmed + paid)
 *   - Orders with FUTURE pickup slots are HIDDEN until their window begins
 *   - Each order includes an `isOverdue` flag computed server-side
 */
export async function listOrdersByStatus(
  status: AdminOrderStatus,
  options?: {
    branchSlug?: string
    search?: string
    limit?: number
    offset?: number
  }
): Promise<ListOrdersResult> {
  try {
    const supabase = createAdminClient()
    const limit = options?.limit || 50
    const offset = options?.offset || 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    const selectFields = `
      *,
      order_items (*),
      branches (name, slug, city)
    `

    let orders: RawOrderRow[]
    let totalCount: number
    // Store window bounds for isOverdue computation (only for confirmed)
    let windowStartMinutes: number | null = null
    let todayDateStr: string | null = null

    if (status === 'confirmed') {
      // --- Confirmed orders: two-query approach ---
      // 1. Today's orders: in-window + overdue (no lower bound on slot)
      // 2. Past-date overdue: pickup_date < today
      // Future orders (slot after window end) are excluded.

      const bounds = getPreparationWindowBounds()
      windowStartMinutes = bounds.windowStartMinutes
      todayDateStr = bounds.todayDateStr

      const windowEndStr = `${String(Math.floor(bounds.windowEndMinutes / 60)).padStart(2, '0')}:${String(bounds.windowEndMinutes % 60).padStart(2, '0')}:00`

      // Query 1: Today — in-window + overdue (slot <= windowEnd, no .gte lower bound)
      let todayQ = sb
        .from('orders')
        .select(selectFields, { count: 'exact' })
        .eq('order_status', 'confirmed')
        .eq('payment_status', 'succeeded')
        .eq('pickup_date', bounds.todayDateStr)
        .lte('pickup_slot_start', windowEndStr)
        .order('pickup_slot_start', { ascending: true })

      // Query 2: Past-date overdue (yesterday or earlier, never accepted)
      let pastQ = sb
        .from('orders')
        .select(selectFields)
        .eq('order_status', 'confirmed')
        .eq('payment_status', 'succeeded')
        .lt('pickup_date', bounds.todayDateStr)
        .order('pickup_date', { ascending: false })
        .order('pickup_slot_start', { ascending: false })
        .limit(50) // Safety limit for very old overdue orders

      // Apply optional branch filter to both queries
      if (options?.branchSlug) {
        todayQ = todayQ.eq('branch_id', options.branchSlug)
        pastQ = pastQ.eq('branch_id', options.branchSlug)
      }

      const [todayRes, pastRes] = await Promise.all([todayQ, pastQ])

      if (todayRes.error) {
        console.error('[ADMIN ORDER SERVICE] listOrdersByStatus today query error:', todayRes.error)
        return { success: false, orders: [], totalCount: 0, error: 'Failed to fetch orders' }
      }

      const todayOrders = (todayRes.data || []) as RawOrderRow[]
      const pastOrders = (pastRes.data || []) as RawOrderRow[]

      // Merge: past overdue first (most recent past first), then today's
      orders = [...pastOrders, ...todayOrders]
      totalCount = (todayRes.count || 0) + pastOrders.length
    } else {
      // --- Non-confirmed: simple single query ---
      let query = sb
        .from('orders')
        .select(selectFields, { count: 'exact' })
        .eq('order_status', status)

      query = query
        .order('pickup_slot_start', { ascending: true })
        .range(offset, offset + limit - 1)

      if (options?.branchSlug) {
        query = query.eq('branch_id', options.branchSlug)
      }

      const { data, error, count } = await query

      if (error) {
        console.error('[ADMIN ORDER SERVICE] listOrdersByStatus error:', error)
        return { success: false, orders: [], totalCount: 0, error: 'Failed to fetch orders' }
      }

      orders = (data || []) as RawOrderRow[]
      totalCount = count || 0
    }

    // Apply pagination (for confirmed, we already have all orders merged)
    if (status === 'confirmed') {
      orders = orders.slice(offset, offset + limit)
    }

    if (!orders || orders.length === 0) {
      return { success: true, orders: [], totalCount: 0 }
    }

    // Fetch customer profiles for all orders
    const userIds = [...new Set(orders.map((o: RawOrderRow) => o.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, whatsapp_number, mobile_number')
      .in('id', userIds)

    const profileMap = new Map<string, { name: string; whatsappNumber: string | null; mobileNumber: string | null }>()
    for (const p of (profiles || []) as RawProfileRow[]) {
      profileMap.set(p.id, {
        name: p.full_name || 'Customer',
        whatsappNumber: p.whatsapp_number || null,
        mobileNumber: p.mobile_number || null,
      })
    }

    // Search filter (applied in-memory since Supabase free tier doesn't support full-text across joins)
    let filteredOrders = orders as RawOrderRow[]
    if (options?.search) {
      const q = options.search.toLowerCase()
      filteredOrders = filteredOrders.filter((o) => {
        const orderNum = (o.order_number || '').toLowerCase()
        const profile = profileMap.get(o.user_id)
        const customerName = (profile?.name || '').toLowerCase()
        return orderNum.includes(q) || customerName.includes(q)
      })
    }

    // Helper: compute isOverdue for a confirmed order (server-side, using window bounds)
    const computeIsOverdue = (raw: RawOrderRow): boolean => {
      if (windowStartMinutes === null || todayDateStr === null) return false
      // Past-date orders are always overdue
      if (raw.pickup_date < todayDateStr) return true
      // Today's orders: overdue if slot started before the window
      const [h, m] = raw.pickup_slot_start.split(':').map(Number)
      if (isNaN(h) || isNaN(m)) return false
      const slotMinutes = h * 60 + m
      return slotMinutes < windowStartMinutes
    }

    // Map to typed response with proper snake_case -> camelCase conversion
    const mapped: AdminOrderWithItems[] = filteredOrders.map((o) => {
      const profile = profileMap.get(o.user_id)
      // Supabase returns the joined table as singular 'branchs' (from 'branches')
      const branch = o.branchs as { name: string; slug: string; city: string } | null
      return {
        ...mapOrderRow(o),
        items: (o.order_items || []).map(mapOrderItemRow),
        branch: branch ? { name: branch.name, slug: branch.slug, city: branch.city } : null,
        customer: profile || { name: 'Customer', whatsappNumber: null, mobileNumber: null },
        isOverdue: status === 'confirmed' ? computeIsOverdue(o) : undefined,
      }
    })

    return {
      success: true,
      orders: mapped,
      totalCount,
    }
  } catch (err) {
    console.error('[ADMIN ORDER SERVICE] listOrdersByStatus error:', err)
    return { success: false, orders: [], totalCount: 0, error: 'Failed to fetch orders' }
  }
}

// ============================================================================
// ACCEPT ORDER
// ============================================================================

export interface AcceptOrderResult {
  success: boolean
  message: string
  order?: AdminOrderWithItems
  error?: string
}

/**
 * Accept an order: transition from 'confirmed' to 'accepted'.
 * - Validates order exists, is 'confirmed', and payment succeeded
 * - Prevents duplicate acceptance (idempotent by design)
 * - Records status change in order_status_history
 */
export async function acceptOrder(
  orderId: string,
  adminUserId: string
): Promise<AcceptOrderResult> {
  try {
    const supabase = createAdminClient()

    // 1. Validate input
    if (!orderId || typeof orderId !== 'string') {
      return { success: false, message: 'Invalid order ID' }
    }

    // 2. Fetch the order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error: fetchErr }: { data: RawOrderRow | null; error: any } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) {
      return { success: false, message: 'Order not found' }
    }

    // 3. Validate payment status — must be succeeded
    if (order.payment_status !== 'succeeded') {
      return { success: false, message: 'Cannot accept an unpaid order' }
    }

    // 4. Validate current status
    if (order.order_status !== 'confirmed') {
      if (order.order_status === 'accepted') {
        return { success: true, message: 'Order already accepted' }
      }
      return { success: false, message: `Cannot accept order in '${order.order_status}' status` }
    }

    // 5. Validate the transition is allowed
    const allowedTransitions = VALID_TRANSITIONS[order.order_status] || []
    if (!allowedTransitions.includes('accepted')) {
      return { success: false, message: 'Invalid status transition' }
    }

    // 6. Update order status (race condition guard: only update if still confirmed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { error: updateErr } = await sb
      .from('orders')
      .update({
        order_status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('order_status', 'confirmed')

    if (updateErr) {
      console.error('[ADMIN ORDER SERVICE] acceptOrder update error:', updateErr)
      return { success: false, message: 'Failed to update order. Please try again.' }
    }

    // 7. Log status change in history
    //    Table schema: (order_id, status, note, created_at)
    //    Unique constraint: (order_id, status) — one row per status per order
    try {
      const { error: histErr } = await sb.from('order_status_history').insert({
        order_id: orderId,
        status: 'accepted',
        note: 'Accepted by admin',
      })
      // Ignore duplicate key errors (order already has 'accepted' status row)
      if (histErr && !String(histErr.message || histErr).includes('duplicate')) {
        console.error('[ADMIN ORDER SERVICE] Failed to log status history:', histErr)
      }
    } catch (historyErr) {
      // Log but don't fail — the order status was already updated
      console.error('[ADMIN ORDER SERVICE] Failed to log status history:', historyErr)
    }

    return { success: true, message: 'Order accepted successfully' }
  } catch (err) {
    console.error('[ADMIN ORDER SERVICE] acceptOrder error:', err)
    return { success: false, message: 'Something went wrong. Please try again.' }
  }
}

// ============================================================================
// VALIDATE STATUS TRANSITION (reusable)
// ============================================================================

export function isValidTransition(
  currentStatus: string,
  targetStatus: string
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed) return false
  return allowed.includes(targetStatus as AdminOrderStatus)
}
