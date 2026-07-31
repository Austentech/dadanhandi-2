/**
 * POST /api/admin/auth/verify-otp
 * Verify OTP and create admin session.
 * Input sanitized server-side.
 */

import { NextResponse } from 'next/server'
import { handleVerifyOtp } from '@/services/admin/admin-auth-service'
import { getClientIp } from '@/lib/security/utils'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawEmail = body?.email
    const rawOtp = body?.otp

    // Validate email input
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      )
    }
    if (rawEmail.trim().length > 254) {
      return NextResponse.json(
        { success: false, message: 'Invalid email.' },
        { status: 400 }
      )
    }

    // Validate OTP input
    if (!rawOtp || typeof rawOtp !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Verification code is required.' },
        { status: 400 }
      )
    }
    const cleanOtp = rawOtp.toUpperCase().trim()
    if (cleanOtp.length !== ADMIN_CONFIG.OTP_LENGTH || !/^[A-Z2-9]+$/.test(cleanOtp)) {
      return NextResponse.json(
        { success: false, message: `Please enter a valid ${ADMIN_CONFIG.OTP_LENGTH}-character code.` },
        { status: 400 }
      )
    }

    const ip = await getClientIp()
    const userAgent = request.headers.get('user-agent')
    const result = await handleVerifyOtp(rawEmail.trim(), cleanOtp, ip, userAgent)

    if (result.success && result.token) {
      const response = NextResponse.json({
        success: true,
        message: 'Login successful.',
      })

      response.cookies.set(ADMIN_CONFIG.SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ADMIN_CONFIG.SESSION_COOKIE_MAX_AGE,
        path: '/',
      })

      return response
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 401 }
    )
  } catch (err) {
    console.error('[ADMIN API] verify-otp error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
