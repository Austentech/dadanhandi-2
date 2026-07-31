/**
 * POST /api/admin/auth/send-otp
 * Send a 6-character alphanumeric OTP to the admin's email.
 * Only registered admin emails are accepted.
 * Rate limited. Input sanitized.
 */

import { NextResponse } from 'next/server'
import { handleSendOtp } from '@/services/admin/admin-auth-service'
import { getClientIp } from '@/lib/security/utils'

// Max email length to prevent abuse
const MAX_EMAIL_LENGTH = 254

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawEmail = body?.email

    // Validate input type
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      )
    }

    // Basic server-side sanitization before passing to service
    const email = rawEmail.trim()
    if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    // Reject dangerous characters
    if (/[;\'\"\\<>]/.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid input.' },
        { status: 400 }
      )
    }

    const ip = await getClientIp()
    const result = await handleSendOtp(email, ip)

    return NextResponse.json(result, { status: result.success ? 200 : 403 })
  } catch (err) {
    console.error('[ADMIN API] send-otp error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
