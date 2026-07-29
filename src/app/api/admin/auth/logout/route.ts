/**
 * POST /api/admin/auth/logout
 * Invalidate admin session and clear cookie.
 */

import { NextResponse } from 'next/server'
import { handleLogout } from '@/services/admin/admin-auth-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function POST(request: Request) {
  try {
    const token = request.cookies.get(ADMIN_CONFIG.SESSION_COOKIE_NAME)?.value

    if (token) {
      await handleLogout(token)
    }

    const response = NextResponse.json({ success: true, message: 'Logged out.' })
    response.cookies.set(ADMIN_CONFIG.SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[ADMIN API] logout error:', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
