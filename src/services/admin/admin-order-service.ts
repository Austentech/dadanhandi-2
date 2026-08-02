/**
 * Admin Order Service
 * Handles admin-side order operations: listing, status transitions, stats.
 * All database access uses the service_role client to bypass RLS.
 */

import { createAdminClient } from '@/lib/supabase/client-admin'
import type { DashboardStats } from '@/store/admin-store'

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

/** Valid status transitions (from → allowed to[]) */
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
 */
export async function getDashboardStats(): Promise<DashboardStatsResult> {
  try {
    const supabase = createAdminClient()

    // Get today's date range in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)
    const todayStart = new Date(istTime.getFullYear(), istTime.getMonth(), istTime.getDate())
    // Convert back to UTC for the query
    const todayStartUTC = new Date(todayStart.getTime() - istOffset)

    const [todayRes, confirmedRes, acceptedRes, preparingRes, readyRes, completedRes, cancelledRes] =
      await Promise.all([
        // Today's orders (all statuses)
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .gte('created_at', todayStartUTC.toISOString()),
        // Pending (confirmed = paid but not yet accepted by admin)
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('order_status', 'confirmed'),
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

    // Upcoming = orders with future pickup date (for the next 2 hours window)
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
    const { count: upcomingCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'confirmed')
      .gte('pickup_slot_start', now.toISOString())
      .lte('pickup_slot_start', twoHoursFromNow)

    return {
      success: true,
      stats: {
        todayOrders: todayRes.count || 0,
        pendingOrders: confirmedRes.count || 0,
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
// LIST ORDERS
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
}

export interface ListOrdersResult {
  success: boolean
  orders: AdminOrderWithItems[]
  totalCount: number
  error?: string
}

/**
 * List orders with a given status, including items and customer info.
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

    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        branches (name, slug, city)
      `, { count: 'exact' })
      .eq('order_status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Optional: filter by branch
    if (options?.branchSlug) {
      // Join through branches table slug
      query = query.eq('branch_id', options.branchSlug)
    }

    const { data: orders, error, count } = await query

    if (error) {
      console.error('[ADMIN ORDER SERVICE] listOrdersByStatus error:', error)
      return { success: false, orders: [], totalCount: 0, error: 'Failed to fetch orders' }
    }

    if (!orders || orders.length === 0) {
      return { success: true, orders: [], totalCount: 0 }
    }

    // Fetch customer profiles for all orders
    const userIds = [...new Set(orders.map((o: Record<string, unknown>) => o.user_id as string))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, whatsapp_number, mobile_number')
      .in('id', userIds)

    const profileMap = new Map<string, { name: string; whatsappNumber: string | null; mobileNumber: string | null }>()
    for (const p of (profiles || [])) {
      profileMap.set(p.id, {
        name: p.full_name || 'Customer',
        whatsappNumber: p.whatsapp_number || null,
        mobileNumber: p.mobile_number || null,
      })
    }

    // Search filter (applied in-memory since Supabase free tier doesn't support full-text across joins)
    let filteredOrders = orders
    if (options?.search) {
      const q = options.search.toLowerCase()
      filteredOrders = orders.filter((o: Record<string, unknown>) => {
        const orderNum = (o.order_number as string || '').toLowerCase()
        const profile = profileMap.get(o.user_id as string)
        const customerName = (profile?.name || '').toLowerCase()
        return orderNum.includes(q) || customerName.includes(q)
      })
    }

    // Map to typed response
    const mapped: AdminOrderWithItems[] = filteredOrders.map((o: Record<string, unknown>) => {
        const raw = o as unknown as AdminOrderItem & { order_items: unknown; branches: unknown }
        const profile = profileMap.get(raw.userId)
        const branch = raw.branchs as { name: string; slug: string; city: string } | null
        return {
          ...raw,
          items: (raw.order_items || []) as AdminOrderItemDetail[],
          branch: branch ? { name: branch.name, slug: branch.slug, city: branch.city } : null,
          customer: profile || { name: 'Customer', whatsappNumber: null, mobileNumber: null },
        }
      })

    return {
      success: true,
      orders: mapped,
      totalCount: count || 0,
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
 * - Validates order exists and is still 'confirmed'
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

    // 2. Fetch the order with a row-level lock (SELECT FOR UPDATE equivalent via status check)
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) {
      return { success: false, message: 'Order not found' }
    }

    // 3. Validate current status
    if (order.order_status !== 'confirmed') {
      if (order.order_status === 'accepted') {
        // Already accepted — idempotent success
        return { success: true, message: 'Order already accepted' }
      }
      return { success: false, message: `Cannot accept order in '${order.order_status}' status` }
    }

    // 4. Validate the transition is allowed
    const allowedTransitions = VALID_TRANSITIONS[order.order_status] || []
    if (!allowedTransitions.includes('accepted')) {
      return { success: false, message: 'Invalid status transition' }
    }

    // 5. Update order status
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        order_status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('order_status', 'confirmed') // Race condition guard: only update if still confirmed

    if (updateErr) {
      console.error('[ADMIN ORDER SERVICE] acceptOrder update error:', updateErr)
      return { success: false, message: 'Failed to update order. Please try again.' }
    }

    // 6. Log status change in history
    try {
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        from_status: 'confirmed',
        to_status: 'accepted',
        changed_by: adminUserId,
        changed_by_role: 'admin',
        reason: 'Accepted by admin',
      })
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
