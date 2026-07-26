/**
 * Branch Utilities (pure functions, client-safe)
 * ----------------------------------------------
 * Pure helper functions for branch data. No server-only imports.
 *
 * This file is safe to import from Client Components. The server-only
 * branch-service.ts imports FROM this file (not the other way around).
 */

import type { Branch } from '@/types/checkout'

/**
 * Convert "HH:MM:SS" or "HH:MM" 24h format to "H:MM AM/PM" 12h format.
 * Example: "10:00:00" → "10:00 AM", "22:00" → "10:00 PM"
 */
export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * Check if a branch is currently open for pickup (within operating hours).
 * Uses IST (Asia/Kolkata) for time comparison.
 *
 * Pure function — takes a Date (default: now) and returns open/closing-soon state.
 */
export function isBranchOpen(branch: Branch, now: Date = new Date()): {
  isOpen: boolean
  closingSoon: boolean
  openingTime: string
  closingTime: string
} {
  const istFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = istFormatter.formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const currentMinutes = hour * 60 + minute

  const [openH, openM] = branch.openingTime.split(':').map(Number)
  const [closeH, closeM] = branch.closingTime.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  const closingSoon = isOpen && (closeMinutes - currentMinutes) < 60

  return {
    isOpen,
    closingSoon,
    openingTime: branch.openingTime,
    closingTime: branch.closingTime,
  }
}

/**
 * Convert a Branch to a denormalized BranchSnapshot (for display).
 */
export function toBranchSnapshot(branch: Branch) {
  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2,
    city: branch.city,
    state: branch.state,
  }
}
