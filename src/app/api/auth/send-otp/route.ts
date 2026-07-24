import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { emailSchema } from '@/lib/validation/schemas'
import { getProfileByEmail } from '@/services/profile-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, resend } = body as { email: string; resend?: boolean }

    // 1. Validate email format
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    // 2. Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, email, 'otp_request', {
      maxAttempts: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
      return NextResponse.json(
        { success: false, message: `Too many attempts. Please try again in ${retrySeconds} seconds.` },
        { status: 429 }
      )
    }

    // 3. Check if user exists — skip this check for resend (user already verified)
    if (!resend) {
      const profile = await getProfileByEmail(email)
      if (!profile) {
        return NextResponse.json(
          { success: false, message: 'No account found with this email. Please create an account first.' },
          { status: 404 }
        )
      }

      // If user signed up via Google, they can't login with OTP
      if (profile.provider === 'google') {
        return NextResponse.json(
          { success: false, message: 'This email is registered with Google. Please click "Continue with Google" to login.' },
          { status: 403 }
        )
      }
    }

    // 4. Send OTP to existing user (never create a new user during login)
    const supabase = await createServerClient()
    const normalizedEmail = email.toLowerCase()

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()

      if (msg.includes('user not found') || msg.includes('not found')) {
        return NextResponse.json(
          { success: false, message: 'No account found with this email. Please create an account first.' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Unable to send OTP. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully! Check your email.',
    })
  } catch (err) {
    console.error('[SEND-OTP ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
