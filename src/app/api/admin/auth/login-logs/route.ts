/**
 * GET /api/admin/auth/login-logs
 * Get login activity logs for the admin.
 */

import { NextResponse } from 'next/server'
import { validateSession } from '@/services/admin/admin-session-service'
import { createAdminClient } from '@/lib/supabase/client-admin'
import { ADMIN_CONFIG } from '@/lib/admin/config'

export async function GET(request: Request) {
  try {
    const token = request.cookies.get(ADMIN_CONFIG.SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const sessionResult = await validateSession(token)
    if (!sessionResult.valid || !sessionResult.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    const supabase = createAdminClient()
    const offset = (page - 1) * limit

    const { data: logs, error, count } = await supabase
      .from('admin_login_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', sessionResult.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN API] login-logs error:', error.message)
      return NextResponse.json({ success: false, message: 'Failed to load logs.' }, { status: 500 })
    }

    const total = count || 0
    return NextResponse.json({
      success: true,
      logs: logs || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('[ADMIN API] login-logs error:', err)
    return NextResponse.json({ success: false, message: 'Something went wrong.' }, { status: 500 })
  }
}
