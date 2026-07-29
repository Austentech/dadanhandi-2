/**
 * POST /api/admin/auth/verify-otp
 * Verify OTP and create admin session.
 */

import { NextResponse } from 'next/server'
import { handleVerifyOtp } from '@/services/admin/admin-auth-service'
import { getClientIp } from '@/lib/security/utils'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body?.email
    const otp = body?.otp

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      )
    }
    if (!otp || typeof otp !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Verification code is required.' },
        { status: 400 }
      )
    }

    const ip = await getClientIp()
    const userAgent = request.headers.get('user-agent')
    const result = await handleVerifyOtp(email, otp, ip, userAgent)

    if (result.success && result.token) {
      // Create response and set session cookie
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
