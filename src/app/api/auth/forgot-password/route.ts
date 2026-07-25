import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { forgotPasswordSchema } from '@/lib/validation/schemas'
import { getProfileByEmail } from '@/services/profile-service'
import { sanitizeEmail } from '@/lib/security/utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body as { email: string }

    // 1. Validate email
    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const cleanEmail = sanitizeEmail(result.data.email)

    // 2. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, cleanEmail, 'forgot_password', {
      maxAttempts: 3,
      windowMs: 60 * 1000,
      blockDurationMs: 300 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 300000) / 1000)
      return NextResponse.json(
        { success: false, message: `Too many attempts. Please try again in ${retrySeconds} seconds.` },
        { status: 429 }
      )
    }

    // 3. Validate: Check if this email is actually registered
    let profile = null
    try {
      profile = await getProfileByEmail(cleanEmail)
    } catch (err) {
      console.error('[FORGOT-PASSWORD] Profile lookup failed:', err)
    }

    if (!profile) {
      // Email NOT found — return clear error (user requested this)
      return NextResponse.json(
        { success: false, message: 'No account found with this email address. Please check your email or register a new account.' },
        { status: 404 }
      )
    }

    // Google users can't reset password — they use Google login
    if (profile.provider === 'google') {
      return NextResponse.json(
        { success: false, message: 'This account uses Google authentication. Please click "Continue with Google" to sign in.' },
        { status: 403 }
      )
    }

    // 4. Create Supabase client
    let supabase
    try {
      supabase = await createServerClient()
    } catch (err) {
      console.error('[FORGOT-PASSWORD] Supabase client creation failed:', err)
      return NextResponse.json(
        { success: false, message: 'Server error. Please try again later.' },
        { status: 500 }
      )
    }

    // 5. Send password reset email via Supabase
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dadanhandihotel.com'

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/api/auth/callback?next=/reset-password`,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      console.error('[FORGOT-PASSWORD] resetPasswordForEmail error:', {
        message: error.message,
        status: error.status,
      })

      if (msg.includes('email not confirmed')) {
        return NextResponse.json(
          { success: false, message: 'Your email has not been verified yet. Please check your inbox for a verification email.' },
          { status: 403 }
        )
      }

      if (msg.includes('rate limit') || msg.includes('too many')) {
        return NextResponse.json(
          { success: false, message: 'Too many reset attempts. Please wait a few minutes and try again.' },
          { status: 429 }
        )
      }

      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        return NextResponse.json(
          { success: false, message: 'Network error. Please check your connection and try again.' },
          { status: 503 }
        )
      }

      // For any other error — tell the user there was an issue sending the email
      return NextResponse.json(
        { success: false, message: `Failed to send reset email: ${error.message || 'Please try again.'}` },
        { status: 500 }
      )
    }

    // 6. Success
    return NextResponse.json({
      success: true,
      message: 'Password reset link sent to your email! Click the link to set a new password.',
    })
  } catch (err) {
    console.error('[FORGOT-PASSWORD UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
