import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit, resetRateLimit } from '@/lib/security/rate-limiter'
import { loginSchema } from '@/lib/validation/schemas'
import { sanitizeString } from '@/lib/security/utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body as { email: string; password: string }

    // 1. Validate inputs
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Validation failed.' },
        { status: 400 }
      )
    }

    // Sanitize inputs
    const cleanEmail = sanitizeString(result.data.email).toLowerCase().trim()

    // 2. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, cleanEmail, 'auth_attempt', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 120 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 120000) / 1000)
      return NextResponse.json(
        { success: false, message: `Too many login attempts. Please try again in ${retrySeconds} seconds.` },
        { status: 429 }
      )
    }

    // 3. Sign in with email + password
    const supabase = await createServerClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      // Provide user-friendly error messages without exposing system details
      if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
        return NextResponse.json(
          { success: false, message: 'Invalid email or password. Please check your credentials.' },
          { status: 401 }
        )
      }

      if (msg.includes('email not confirmed')) {
        return NextResponse.json(
          { success: false, message: 'Your email has not been verified. Please check your inbox for a confirmation email.' },
          { status: 403 }
        )
      }

      if (msg.includes('too many requests')) {
        return NextResponse.json(
          { success: false, message: 'Too many attempts. Please wait a moment and try again.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Login failed. Please check your email and password.' },
        { status: 401 }
      )
    }

    // 4. Reset rate limits on successful login
    resetRateLimit(ip, 'auth_attempt')
    resetRateLimit(cleanEmail, 'auth_attempt')

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      data: { redirectTo: '/' },
    })
  } catch (err) {
    console.error('[LOGIN ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
