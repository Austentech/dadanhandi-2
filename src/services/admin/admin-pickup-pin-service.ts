/**
 * Admin Pickup PIN Service
 * ------------------------
 * Handles secure 4-digit PIN generation for order pickup.
 *
 * Security measures:
 * - Cryptographically secure random generation (crypto.getRandomValues)
 * - Uniqueness among all active (non-terminal) orders
 * - Single-generation guarantee (race condition protected)
 * - Atomic status transition: preparing → ready_for_pickup
 * - Complete audit trail in pickup_pin_audit_log
 *
 * All database access uses the service_role client to bypass RLS.
 */

import { createAdminClient } from '@/lib/supabase/client-admin'

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratePickupPinResult {
  success: boolean
  message: string
  pickupPin?: string
  generatedAt?: string
  error?: string
}

// ============================================================================
// PIN GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure 4-digit numeric PIN.
 * Uses crypto.getRandomValues() — NOT Math.random().
 */
function generateSecurePin(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  // Map to 0-9999 range with minimal bias (modulo bias is negligible for 10000)
  const pin = array[0] % 10000
  return String(pin).padStart(4, '0')
}

/**
 * Check if a PIN is already in use by any active (non-terminal) order.
 * Active = not completed, cancelled, or failed.
 */
async function isPinActive(
  supabase: ReturnType<typeof createAdminClient>,
  pin: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { count } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('pickup_pin', pin)
    .not('order_status', 'in', '(completed,cancelled,failed)')

  return (count || 0) > 0
}

/**
 * Generate a unique PIN that is not in use by any active order.
 * Retries with new PINs up to maxAttempts times.
 * With 10,000 possible PINs and typically < 100 active orders,
 * the probability of needing > 1 attempt is < 1%.
 */
async function generateUniquePin(
  supabase: ReturnType<typeof createAdminClient>,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pin = generateSecurePin()
    const active = await isPinActive(supabase, pin)
    if (!active) return pin
  }
  // This should never happen with 10,000 possible PINs and < 100 active orders
  throw new Error('Failed to generate a unique PIN after maximum attempts')
}

// ============================================================================
// MAIN: GENERATE PICKUP PIN
// ============================================================================

/**
 * Generate a Pickup PIN for an order.
 *
 * Full workflow:
 * 1. Validate admin authentication (caller must verify before calling)
 * 2. Validate order exists and is in 'preparing' status
 * 3. Verify order does not already have a PIN (prevent regeneration)
 * 4. Generate a cryptographically secure unique 4-digit PIN
 * 5. Atomically update: set PIN + status = 'ready_for_pickup' + audit columns
 *    using optimistic locking (WHERE order_status = 'preparing' AND pickup_pin IS NULL)
 * 6. If the optimistic lock fails (0 rows updated), re-fetch and report why
 * 7. Insert audit log entry
 * 8. Return success with PIN and timestamp
 *
 * Concurrency safety:
 * - Multiple concurrent requests for the same order: only one succeeds.
 *   The optimistic lock (WHERE order_status = 'preparing' AND pickup_pin IS NULL)
 *   guarantees that at most one UPDATE affects the row.
 * - The partial unique index (idx_orders_active_pin_unique) provides a
 *   database-level backstop against duplicate active PINs.
 *
 * @param orderId - UUID of the order
 * @param adminUserId - UUID of the admin generating the PIN
 */
export async function generatePickupPin(
  orderId: string,
  adminUserId: string
): Promise<GeneratePickupPinResult> {
  try {
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // 1. Validate inputs
    if (!orderId || typeof orderId !== 'string') {
      return { success: false, message: 'Invalid order ID' }
    }
    if (!adminUserId || typeof adminUserId !== 'string') {
      return { success: false, message: 'Invalid admin ID' }
    }

    // 2. Fetch the order
    const { data: order, error: fetchErr }: { data: any; error: any } = await sb
      .from('orders')
      .select('id, order_status, pickup_pin, pickup_date, pickup_slot_start')
      .eq('id', orderId)
      .single()

    if (fetchErr || !order) {
      return { success: false, message: 'Order not found' }
    }

    // 3. Validate current status — must be 'preparing'
    if (order.order_status !== 'preparing') {
      const statusLabels: Record<string, string> = {
        confirmed: 'Pending',
        accepted: 'Accepted',
        preparing: 'Preparing',
        ready_for_pickup: 'Ready for Pickup',
        completed: 'Completed',
        cancelled: 'Cancelled',
        failed: 'Failed',
      }
      const label = statusLabels[order.order_status] || order.order_status

      // If already has a PIN and is ready_for_pickup, it was already generated
      if (order.pickup_pin && order.order_status === 'ready_for_pickup') {
        return {
          success: false,
          message: 'Pickup PIN has already been generated for this order',
        }
      }

      return {
        success: false,
        message: `Cannot generate PIN for order in "${label}" status. Order must be in "Preparing" status.`,
      }
    }

    // 4. Prevent duplicate generation (defense in depth — the WHERE clause also checks)
    if (order.pickup_pin) {
      return {
        success: false,
        message: 'Pickup PIN has already been generated for this order',
      }
    }

    // 5. Generate a unique PIN
    const pin = await generateUniquePin(supabase)
    const generatedAt = new Date().toISOString()

    // 6. Atomic update: set PIN, status, and audit columns
    //    Optimistic lock: only update if still 'preparing' AND no PIN set
    const { error: updateErr, count: updateCount } = await sb
      .from('orders')
      .update({
        pickup_pin: pin,
        order_status: 'ready_for_pickup',
        pin_generated_at: generatedAt,
        pin_generated_by: adminUserId,
        updated_at: generatedAt,
      })
      .eq('id', orderId)
      .eq('order_status', 'preparing')
      .is('pickup_pin', null)

    if (updateErr) {
      console.error('[PICKUP PIN] Update error:', updateErr)
      return { success: false, message: 'Failed to generate PIN. Please try again.' }
    }

    // 7. Check if the update actually happened (0 rows = race condition)
    if (updateCount === 0) {
      // Re-fetch to determine what happened
      const { data: freshOrder }: { data: any } = await sb
        .from('orders')
        .select('order_status, pickup_pin')
        .eq('id', orderId)
        .single()

      if (freshOrder?.pickup_pin) {
        return {
          success: false,
          message: 'Pickup PIN was already generated by another action',
        }
      }
      if (freshOrder?.order_status !== 'preparing') {
        const statusLabels: Record<string, string> = {
          accepted: 'Accepted', preparing: 'Preparing',
          ready_for_pickup: 'Ready for Pickup', completed: 'Completed',
          cancelled: 'Cancelled', confirmed: 'Pending',
        }
        const current = statusLabels[freshOrder?.order_status] || freshOrder?.order_status || 'Unknown'
        return { success: false, message: `Order status was already changed to "${current}"` }
      }

      return { success: false, message: 'Failed to generate PIN due to a concurrent update. Please try again.' }
    }

    // 8. Insert audit log entry
    try {
      const { error: auditErr } = await sb.from('pickup_pin_audit_log').insert({
        order_id: orderId,
        pickup_pin: pin,
        generated_by: adminUserId,
        previous_status: 'preparing',
        new_status: 'ready_for_pickup',
      })
      if (auditErr) {
        // Log but don't fail — the PIN was already set
        console.error('[PICKUP PIN] Failed to write audit log:', auditErr)
      }
    } catch (auditErr) {
      console.error('[PICKUP PIN] Failed to write audit log:', auditErr)
    }

    // 9. Log status change in order_status_history (consistent with other transitions)
    try {
      const { error: histErr } = await sb.from('order_status_history').insert({
        order_id: orderId,
        status: 'ready_for_pickup',
        note: `Pickup PIN generated (${pin}) | admin: ${adminUserId}`,
      })
      if (histErr && !String(histErr.message || histErr).includes('duplicate')) {
        console.error('[PICKUP PIN] Failed to log status history:', histErr)
      }
    } catch (histErr) {
      console.error('[PICKUP PIN] Failed to log status history:', histErr)
    }

    return {
      success: true,
      message: 'Pickup PIN generated successfully',
      pickupPin: pin,
      generatedAt,
    }
  } catch (err) {
    console.error('[PICKUP PIN] Unexpected error:', err)
    return { success: false, message: 'Something went wrong. Please try again.' }
  }
}
