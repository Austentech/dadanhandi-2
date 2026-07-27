/**
 * Pickup Slot Service
 * -------------------
 * Generates and validates pickup time slots dynamically.
 *
 * RULES (per Phase 2 Module 3 spec):
 *  - Pickup is available ONLY for today (no future dates, no past dates)
 *  - Operating hours: 10:00 AM to 10:00 PM (Asia/Kolkata / IST)
 *  - Slot interval: 1 hour (configurable via PICKUP_CONFIG)
 *  - Slots that have already started are DISABLED (cannot be selected)
 *  - If the restaurant is closed (current time past closing), no slots available
 *
 * All time calculations use Asia/Kolkata (IST) regardless of server timezone.
 * The server's system clock is assumed to be UTC (Supabase default), and we
 * convert to IST for "today" and slot-generation decisions.
 */

import { PICKUP_CONFIG } from '@/types/checkout'
import type { PickupSlot } from '@/types/checkout'

// ============================================================================
// IST TIME HELPERS
// ============================================================================

/**
 * Get the current Date in IST. The returned Date object has its UTC
 * components shifted so that local-timezone methods (getHours, getMinutes,
 * etc.) return IST values. This is a workaround for the fact that JS Date
 * is always UTC under the hood.
 *
 * Example: if real UTC time is 2026-07-27T04:30:00Z (which is 10:00 AM IST),
 * this returns a Date object whose getHours() returns 10.
 */
function getISTNow(): Date {
  const now = new Date()
  // Convert UTC to IST by adding 5h30m
  // We get the IST wall-clock components via Intl, then construct a new Date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PICKUP_CONFIG.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  // Construct ISO string in IST (treating the wall-clock as if it were UTC
  // for the Date constructor — but that's intentional, since we want
  // getHours() etc. to return IST values)
  const isoStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  return new Date(isoStr)
}

/**
 * Get today's date in IST as "YYYY-MM-DD".
 */
export function getISTTodayDate(): string {
  const istNow = getISTNow()
  const y = istNow.getUTCFullYear()
  const m = String(istNow.getUTCMonth() + 1).padStart(2, '0')
  const d = String(istNow.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get the current IST hour and minute as { hour, minute }.
 */
function getISTCurrentHourMinute(): { hour: number; minute: number } {
  const istNow = getISTNow()
  return {
    hour: istNow.getUTCHours(),
    minute: istNow.getUTCMinutes(),
  }
}

// ============================================================================
// TIME FORMATTERS
// ============================================================================

/**
 * Convert "H:MM" 24h to "H:MM AM/PM" 12h format.
 * Example: 10:00 → "10:00 AM", 13:30 → "1:30 PM", 22:00 → "10:00 PM"
 */
export function format12h(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  let h12 = hour % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`
}

/**
 * Pad hour:minute to "HH:MM" 24h format.
 */
function format24h(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// ============================================================================
// SLOT GENERATION
// ============================================================================

/**
 * Generate all pickup slots for today (in IST).
 *
 * Slots run from `openingHour` to `closingHour`, every `slotIntervalMinutes`.
 * A slot whose start time has already passed (current IST time >= slot start)
 * is marked `disabled: true`.
 *
 * If the current IST time is past closing time, all slots will be disabled
 * (or more accurately, no future slots exist — we still return the list
 * for display purposes).
 *
 * @returns Array of PickupSlot objects.
 */
export function generateTodaySlots(): PickupSlot[] {
  const slots: PickupSlot[] = []
  const { hour: currentHour, minute: currentMinute } = getISTCurrentHourMinute()
  const currentTotalMinutes = currentHour * 60 + currentMinute

  const openMinutes = PICKUP_CONFIG.openingHour * 60
  const closeMinutes = PICKUP_CONFIG.closingHour * 60
  const interval = PICKUP_CONFIG.slotIntervalMinutes

  for (let start = openMinutes; start < closeMinutes; start += interval) {
    const end = start + interval
    // Slot is disabled if its START time has already passed
    const disabled = start <= currentTotalMinutes
    const startHour = Math.floor(start / 60)
    const startMin = start % 60
    const endHour = Math.floor(end / 60)
    const endMin = end % 60

    const startTime24 = format24h(startHour, startMin)
    const endTime24 = format24h(endHour, endMin)
    const key = `${startTime24}-${endTime24}`
    const startLabel = format12h(startHour, startMin)
    const endLabel = format12h(endHour, endMin)

    slots.push({
      key,
      startTime: startTime24,
      endTime: endTime24,
      label: `${startLabel} – ${endLabel}`,
      shortLabel: startLabel,
      disabled,
      disabledReason: disabled ? 'This slot has already passed' : undefined,
    })
  }

  return slots
}

/**
 * Get only selectable (non-disabled) slots.
 */
export function getSelectableSlots(): PickupSlot[] {
  return generateTodaySlots().filter((s) => !s.disabled)
}

/**
 * Check if the restaurant is currently open (any selectable slot exists).
 */
export function isRestaurantOpen(): boolean {
  return getSelectableSlots().length > 0
}

// ============================================================================
// SLOT VALIDATION
// ============================================================================

/**
 * Validate a pickup slot key against today's generated slots.
 *
 * Returns:
 *  - { valid: true, slot } if the slot exists and is selectable
 *  - { valid: false, reason, slot? } if invalid or disabled
 *
 * @param slotKey Format "HH:MM-HH:MM" (24h)
 */
export function validatePickupSlot(slotKey: string): {
  valid: boolean
  reason?: string
  slot?: PickupSlot
} {
  if (!slotKey || typeof slotKey !== 'string') {
    return { valid: false, reason: 'Pickup slot is required.' }
  }

  const slots = generateTodaySlots()
  const slot = slots.find((s) => s.key === slotKey)

  if (!slot) {
    return { valid: false, reason: 'Invalid pickup slot. Please choose a valid time.' }
  }

  if (slot.disabled) {
    return {
      valid: false,
      reason: 'This time slot has already passed. Please choose a later time.',
      slot,
    }
  }

  return { valid: true, slot }
}

/**
 * Get the slot for a given key, regardless of disabled state.
 * Returns null if not found.
 */
export function getSlotByKey(slotKey: string): PickupSlot | null {
  return generateTodaySlots().find((s) => s.key === slotKey) ?? null
}

// ============================================================================
// PICKUP DATE VALIDATION
// ============================================================================

/**
 * Validate that a given date string (YYYY-MM-DD) is today's IST date.
 * Pickup is only allowed for today — no past or future dates.
 */
export function validatePickupDate(dateStr: string): {
  valid: boolean
  reason?: string
} {
  const today = getISTTodayDate()
  if (dateStr !== today) {
    return {
      valid: false,
      reason: 'Pickup is only available for today. Please select today\'s date.',
    }
  }
  return { valid: true }
}
