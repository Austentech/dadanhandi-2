/**
 * Admin Auth Helpers
 * Reusable server-side utilities for admin API route protection.
 * All admin API routes should use `validateAdminRequest()` at the top.
 */

import { NextResponse } from 'next/server'
import { validateSession } from '@/services/admin/admin-session-service'
import { ADMIN_CONFIG } from '@/lib/admin/config'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { headers } from 'next/headers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminAuthResult {
  valid: boolean
  userId?: string
  userRole?: string
  error?: string
  errorStatus?: number
}

// ---------------------------------------------------------------------------
// Get client IP
// ---------------------------------------------------------------------------

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
    const real = h.get('x-real-ip')
    if (real) return real
    const cf = h.get('cf-connecting-ip')
    if (cf) return cf
  } catch { /* headers() may fail */ }
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Validate admin request (auth + optional rate limit)
// ---------------------------------------------------------------------------

/**
 * Validates that the incoming request has a valid admin session.
 * Optionally applies rate limiting.
 *
 * Usage in API routes:
 * ```ts
 * const auth = await validateAdminRequest(request, { rateLimitType: 'admin_orders' })
 * if (!auth.valid) return auth.errorResponse
 * // auth.userId, auth.userRole are available
 * ```
 */
export async function validateAdminRequest(
  request: Request,
  options?: {
    rateLimitType?: string
    rateLimitConfig?: { maxAttempts: number; windowMs: number; blockDurationMs: number }
  }
): Promise<AdminAuthResult & { errorResponse?: NextResponse }> {
  // 1. Rate limiting (if configured)
  if (options?.rateLimitType) {
    const ip = await getClientIp()
    const rl = checkRateLimit(ip, options.rateLimitType, options.rateLimitConfig)
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil((rl.retryAfterMs || 60000) / 1000)
      return {
        valid: false,
        error: 'Too many requests. Please try again later.',
        errorStatus: 429,
        errorResponse: NextResponse.json(
          { success: false, message: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfterSec) },
          }
        ),
      }
    }
  }

  // 2. Extract session token
  const token = request.cookies.get(ADMIN_CONFIG.SESSION_COOKIE_NAME)?.value
  if (!token) {
    return {
      valid: false,
      error: 'Authentication required',
      errorStatus: 401,
      errorResponse: NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  // 3. Validate session against DB
  try {
    const result = await validateSession(token)
    if (!result.valid || !result.user) {
      // Clear the invalid cookie
      const response = NextResponse.json(
        { success: false, message: 'Session expired. Please log in again.' },
        { status: 401 }
      )
      response.cookies.set(ADMIN_CONFIG.SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
      return {
        valid: false,
        error: 'Session expired',
        errorStatus: 401,
        errorResponse: response,
      }
    }

    return {
      valid: true,
      userId: result.user.id,
      userRole: result.user.role,
    }
  } catch (err) {
    console.error('[ADMIN AUTH] Session validation error:', err)
    return {
      valid: false,
      error: 'Internal error',
      errorStatus: 500,
      errorResponse: NextResponse.json(
        { success: false, message: 'Something went wrong. Please try again.' },
        { status: 500 }
      ),
    }
  }
}
