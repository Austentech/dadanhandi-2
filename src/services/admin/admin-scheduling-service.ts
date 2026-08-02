/**
 * Admin Scheduling Service
 * --------------------------
 * Reusable, server-side order visibility engine.
 * Determines whether an order should appear in the active admin queue
 * based on its pickup time slot and the configurable preparation window.
 *
 * All time calculations use SERVER TIME (not client device clock).
 * Timezone: Asia/Kolkata (IST, UTC+5:30).
 *
 * USAGE: Import `isOrderInPreparationWindow` and `getPreparationWindowBounds`
 * from any service or API route. Never duplicate time-window logic.
 */

import { ADMIN_CONFIG } from '@/lib/admin/config'

// ============================================================================
// TIMEZONE CONSTANTS
// ============================================================================

/** IST offset in milliseconds (UTC+5:30) */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Convenience: preparation window in milliseconds (read from config) */
function getWindowMs(): number {
  return ADMIN_CONFIG.PREPARATION_WINDOW_HOURS * 60 * 60 * 1000
}

// ============================================================================
// CORE: Get current IST time components (server-side)
// ============================================================================

/**
 * Returns the current date and time in IST as separate components.
 * Uses the server clock — never trusts client-provided timestamps.
 */
function getNowIST(): { date: Date; year: number; month: number; day: number; hours: number; minutes: number } {
  const now = new Date()
  const istTime = new Date(now.getTime() + IST_OFFSET_MS)
  return {
    date: istTime,
    year: istTime.getFullYear(),
    month: istTime.getMonth(),
    day: istTime.getDate(),
    hours: istTime.getHours(),
    minutes: istTime.getMinutes(),
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface PreparationWindowBounds {
  /** ISO date string for today in IST (YYYY-MM-DD), used for pickup_date filter */
  todayDateStr: string
  /** Start of window: current IST time as minutes since midnight */
  windowStartMinutes: number
  /** End of window: (now + PREPARATION_WINDOW_HOURS) as minutes since midnight */
  windowEndMinutes: number
  /** If window crosses midnight, this is the date string for the next day */
  nextDateStr: string | null
  /** If window crosses midnight, how far into the next day (minutes since midnight) */
  nextDayEndMinutes?: number
}

/**
 * Compute the preparation window bounds in IST.
 * Returns values suitable for database queries:
 *   - todayDateStr: filter pickup_date = this (and optionally nextDateStr)
 *   - windowStartMinutes: pickup_slot_start >= this (as minutes from midnight)
 *   - windowEndMinutes: pickup_slot_start <= this (as minutes from midnight)
 *
 * If the window crosses midnight, nextDateStr is set and the query should
 * also include pickup_date = nextDateStr with slot_start <= windowEndMinutes.
 */
export function getPreparationWindowBounds(): PreparationWindowBounds {
  const ist = getNowIST()
  const windowMs = getWindowMs()

  // Current time as minutes since midnight IST
  const nowMinutes = ist.hours * 60 + ist.minutes

  // Window end as minutes since midnight IST (may exceed 1440 = cross midnight)
  const rawEndMinutes = nowMinutes + (windowMs / 60000)

  // Today's date string in YYYY-MM-DD
  const todayDateStr = `${ist.year}-${String(ist.month + 1).padStart(2, '0')}-${String(ist.day).padStart(2, '0')}`

  // Check if window crosses midnight
  if (rawEndMinutes > 1440) {
    // Window wraps to next day
    const nextMinutes = rawEndMinutes - 1440
    // Compute next day date string
    const nextDate = new Date(ist.year, ist.month, ist.day + 1)
    const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`

    return {
      todayDateStr,
      windowStartMinutes: nowMinutes,
      windowEndMinutes: 1440, // end of today
      nextDateStr,
      nextDayEndMinutes: nextMinutes, // how far into next day
    }
  }

  return {
    todayDateStr,
    windowStartMinutes: nowMinutes,
    windowEndMinutes: rawEndMinutes,
    nextDateStr: null,
  }
}

/**
 * Check if a raw order row's pickup slot falls within the current preparation window.
 * Pure function — can be used for both server-side filtering and testing.
 *
 * @param pickupDate - Postgres DATE as string "YYYY-MM-DD"
 * @param pickupSlotStart - Postgres TIME as string "HH:MM:SS"
 * @returns true if the order should be visible in the active queue
 */
export function isOrderInPreparationWindow(
  pickupDate: string,
  pickupSlotStart: string
): boolean {
  const bounds = getPreparationWindowBounds()

  // Parse the time string "14:30:00" -> minutes since midnight
  const [h, m] = pickupSlotStart.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return false
  const slotMinutes = h * 60 + m

  // Check if order is for today and within window
  if (pickupDate === bounds.todayDateStr) {
    return slotMinutes >= bounds.windowStartMinutes && slotMinutes <= bounds.windowEndMinutes
  }

  // Check if order is for next day (when window crosses midnight)
  if (bounds.nextDateStr && pickupDate === bounds.nextDateStr) {
    const nextEnd = bounds.nextDayEndMinutes
    if (nextEnd !== undefined) {
      return slotMinutes <= nextEnd
    }
  }

  return false
}

/**
 * Check if a raw order row's pickup slot falls OUTSIDE the preparation window
 * (i.e., it's a future upcoming order not yet visible in the queue).
 */
export function isUpcomingOrder(
  pickupDate: string,
  pickupSlotStart: string
): boolean {
  // An order is "upcoming" if:
  // 1. Its pickup date is today
  // 2. Its slot start is AFTER the preparation window end
  const bounds = getPreparationWindowBounds()

  if (pickupDate !== bounds.todayDateStr) return false

  const [h, m] = pickupSlotStart.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return false
  const slotMinutes = h * 60 + m

  return slotMinutes > bounds.windowEndMinutes
}
