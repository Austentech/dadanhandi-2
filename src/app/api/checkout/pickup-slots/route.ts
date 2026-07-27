/**
 * GET /api/checkout/pickup-slots
 * -----------------------------
 * Returns today's available pickup time slots. Slots are generated
 * dynamically based on the current IST time. Past slots are marked
 * disabled but still returned (so the UI can show them greyed out).
 *
 * Pickup is available ONLY for today (no future dates).
 * Operating hours: 10:00 AM to 10:00 PM IST.
 * Slot interval: 1 hour (configurable via PICKUP_CONFIG).
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/services/cart-service'
import { getClientIp } from '@/lib/security/utils'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { generateTodaySlots, getISTTodayDate, isRestaurantOpen } from '@/services/pickup-slot-service'

export async function GET() {
  try {
    const { user, error } = await getAuthenticatedUser()
    if (error || !user) {
      return NextResponse.json(error?.body, { status: error?.status || 401 })
    }

    const ip = await getClientIp()
    const ipCheck = checkRateLimit(ip, 'pickup_slots', {
      maxAttempts: 30,
      windowMs: 60 * 1000,
      blockDurationMs: 30 * 1000,
    })
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { success: false, message: 'Too many requests.' },
        { status: 429 },
      )
    }

    const slots = generateTodaySlots()
    const today = getISTTodayDate()
    const open = isRestaurantOpen()

    return NextResponse.json({
      success: true,
      message: 'Pickup slots loaded.',
      data: {
        date: today,
        slots,
        isRestaurantOpen: open,
      },
    })
  } catch (err) {
    console.error('[PICKUP SLOTS UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 },
    )
  }
}
