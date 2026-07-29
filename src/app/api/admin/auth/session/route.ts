/**
 * GET /api/admin/auth/session
 * Validate current admin session and return user info.
 */

import { NextResponse } from 'next/server'
import { validateSession } from '@/services/admin/admin-session-service'
import { maskEmail } from '@/services/admin/admin-auth-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function GET(request: Request) {
  try {
    const token = request.cookies.get(ADMIN_CONFIG.SESSION_COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json(
        { success: false, authenticated: false },
        { status: 401 }
      )
    }

    const result = await validateSession(token)

    if (!result.valid || !result.user) {
      // Clear invalid cookie
      const response = NextResponse.json(
        { success: false, authenticated: false },
        { status: 401 }
      )
      response.cookies.set(ADMIN_CONFIG.SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
      return response
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: result.user.id,
        name: result.user.name,
        email_masked: maskEmail(result.user.email),
        role: result.user.role,
        last_login_at: result.user.last_login_at,
      },
      session_id: result.session?.id,
      expires_at: result.session?.expires_at,
    })
  } catch (err) {
    console.error('[ADMIN API] session error:', err)
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 500 }
    )
  }
}
