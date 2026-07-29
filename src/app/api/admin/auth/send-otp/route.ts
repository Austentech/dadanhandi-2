/**
 * POST /api/admin/auth/send-otp
 * Send a 6-character alphanumeric OTP to the admin's email.
 * Rate limited. Generic messages to prevent account enumeration.
 */

import { NextResponse } from 'next/server'
import { handleSendOtp } from '@/services/admin/admin-auth-service'
import { getClientIp } from '@/lib/security/utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body?.email

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      )
    }

    const ip = await getClientIp()
    const result = await handleSendOtp(email, ip)

    return NextResponse.json(result, { status: result.success ? 200 : 429 })
  } catch (err) {
    console.error('[ADMIN API] send-otp error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
