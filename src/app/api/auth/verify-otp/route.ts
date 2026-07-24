import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit, resetRateLimit } from '@/lib/security/rate-limiter'
import { emailSchema, otpSchema } from '@/lib/validation/schemas'
import { createProfile, getProfileByEmail } from '@/services/profile-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, otp } = body as { email: string; otp: string }

    // Validate email
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid email address.' },
        { status: 400 }
      )
    }

    // Validate OTP (must be exactly 6 digits)
    const otpResult = otpSchema.safeParse(otp)
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid 6-digit OTP.' },
        { status: 400 }
      )
    }

    // Rate limiting
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

    // Verify the OTP code
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token: otp,
      type: 'email',
    })

    if (error) {
      const errorMsg = error.message || ''

      // Provide specific guidance based on error type
      if (errorMsg.includes('OTP is expired') || errorMsg.includes('expired')) {
        return NextResponse.json(
          { success: false, message: 'OTP has expired. Please request a new one.' },
          { status: 401 }
        )
      }

      if (errorMsg.includes('Token has been used') || errorMsg.includes('already verified')) {
        return NextResponse.json(
          { success: false, message: 'This OTP has already been used. Please request a new one.' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { success: false, message: 'Invalid or expired OTP. Please check your email and try again.' },
        { status: 401 }
      )
    }

    // Reset rate limits on successful verification
    resetRateLimit(ip, 'otp_request')
    resetRateLimit(email, 'otp_request')
    resetRateLimit(ip, 'auth_attempt')
    resetRateLimit(email, 'auth_attempt')

    // Ensure profile exists (trigger should handle this, but use RPC as safety net)
    if (data.user) {
      try {
        const existingProfile = await getProfileByEmail(email)
        if (!existingProfile) {
          // Profile doesn't exist yet — create it via RPC (bypasses RLS)
          await createProfile({
            auth_user_id: data.user.id,
            email: email.toLowerCase(),
            full_name: data.user.user_metadata?.full_name || '',
            provider: 'email',
            profile_completed: true,
          })
        }
      } catch {
        // Profile creation failed — non-fatal, trigger should handle it
        console.error('[VERIFY-OTP] Profile creation safety net failed, trigger should have created it')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      data: { redirectTo: '/' },
    })
  } catch (err) {
    console.error('[VERIFY-OTP ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
