import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit, resetRateLimit } from '@/lib/security/rate-limiter'
import { emailSchema, otpSchema } from '@/lib/validation/schemas'
import { createProfile, getProfileByEmail } from '@/services/profile-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, otp } = body as { email: string; otp: string }

    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid email address.' },
        { status: 400 }
      )
    }

    const otpResult = otpSchema.safeParse(otp)
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 6-digit OTP.' },
        { status: 400 }
      )
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, email, 'auth_attempt', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 120 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 120000) / 1000)
      return NextResponse.json(
        { success: false, message: `Too many attempts. Please try again in ${retrySeconds} seconds.` },
        { status: 429 }
      )
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token: otp,
      type: 'email',
    })

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired OTP. Please try again.' },
        { status: 401 }
      )
    }

    // Reset rate limits on success
    resetRateLimit(ip, 'otp_request')
    resetRateLimit(email, 'otp_request')
    resetRateLimit(ip, 'auth_attempt')
    resetRateLimit(email, 'auth_attempt')

    // Ensure profile exists
    if (data.user) {
      const existingProfile = await getProfileByEmail(email)
      if (!existingProfile) {
        await createProfile({
          auth_user_id: data.user.id,
          email: email.toLowerCase(),
          full_name: data.user.user_metadata?.full_name || '',
          provider: 'email',
          profile_completed: true,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      data: { redirectTo: '/' },
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
