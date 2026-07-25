import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { forgotPasswordSchema } from '@/lib/validation/schemas'
import { getProfileByEmail } from '@/services/profile-service'
import { sanitizeString } from '@/lib/security/utils'

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

    const cleanEmail = sanitizeString(result.data.email).toLowerCase().trim()

    // 2. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, cleanEmail, 'otp_request', {
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

    // 3. Check if user exists — don't reveal if email doesn't exist (security)
    // But we do check so we can give a more helpful message
    const profile = await getProfileByEmail(cleanEmail)

    if (!profile) {
      // Don't reveal that the email doesn't exist — generic message
      // This prevents email enumeration attacks
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      })
    }

    // Google users can't reset password via email (they use Google login)
    if (profile.provider === 'google') {
      return NextResponse.json({
        success: true,
        message: 'This account uses Google login. Please use "Continue with Google" to sign in.',
      })
    }

    // 4. Send password reset email via Supabase
    const supabase = await createServerClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dadanhandihotel.com'

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/api/auth/callback?next=/reset-password`,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      if (msg.includes('email not confirmed')) {
        return NextResponse.json(
          { success: false, message: 'Your email has not been verified yet. Please check your inbox.' },
          { status: 403 }
        )
      }

      // Generic error — don't expose details
      return NextResponse.json(
        { success: true,
          message: 'If an account exists with this email, you will receive a password reset link.',
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent to your email! Click the link to set a new password.',
    })
  } catch (err) {
    console.error('[FORGOT-PASSWORD ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
