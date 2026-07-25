import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit, resetRateLimit } from '@/lib/security/rate-limiter'
import { loginSchema } from '@/lib/validation/schemas'
import { getProfileByEmail } from '@/services/profile-service'
import { sanitizeEmail } from '@/lib/security/utils'

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

    const cleanEmail = sanitizeEmail(result.data.email)

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

    // 3. Check if this email belongs to a Google auth user BEFORE attempting password login
    try {
      const existingProfile = await getProfileByEmail(cleanEmail)
      if (existingProfile && existingProfile.provider === 'google') {
        return NextResponse.json(
          { success: false, message: 'This account uses Google authentication. Please click "Continue with Google" to sign in.' },
          { status: 403 }
        )
      }
    } catch {
      // Profile check failed — continue with password login attempt
    }

    // 4. Create Supabase client
    const supabase = await createServerClient()

    // 5. Sign in with email + password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      console.error('[LOGIN ERROR]', { message: error.message, status: error.status })

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

      if (msg.includes('too many requests') || msg.includes('rate limit')) {
        return NextResponse.json(
          { success: false, message: 'Too many attempts. Please wait a moment and try again.' },
          { status: 429 }
        )
      }

      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        return NextResponse.json(
          { success: false, message: 'Network error. Please check your connection and try again.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Login failed. Please check your email and password.' },
        { status: 401 }
      )
    }

    // 6. Reset rate limits on successful login
    resetRateLimit(ip, 'auth_attempt')
    resetRateLimit(cleanEmail, 'auth_attempt')

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      data: { redirectTo: '/' },
    })
  } catch (err) {
    console.error('[LOGIN UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
