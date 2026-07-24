import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { registerSchema } from '@/lib/validation/schemas'
import { createProfile, getProfileByEmail } from '@/services/profile-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validationResult = registerSchema.safeParse(body)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Validation failed.' },
        { status: 400 }
      )
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'

    const rateCheck = checkDualRateLimit(ip, body.email, 'otp_request', {
      maxAttempts: 3,
      windowMs: 60 * 1000,
      blockDurationMs: 300 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 300000) / 1000)
      return NextResponse.json(
        { success: false, message: `Too many registration attempts. Please try again in ${retrySeconds} seconds.` },
        { status: 429 }
      )
    }

    const supabase = await createServerClient()

    const existingProfile = await getProfileByEmail(body.email)
    if (existingProfile) {
      return NextResponse.json(
        { success: false, message: 'This email is already registered. Please log in.' },
        { status: 409 }
      )
    }

    // Sign up user with a random password (they use OTP, not password)
    const { data, error } = await supabase.auth.signUp({
      email: body.email.toLowerCase(),
      password: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
      options: {
        data: {
          full_name: body.full_name,
          whatsapp_number: body.whatsapp_number,
          mobile_number: body.mobile_number || null,
          area: body.area,
          city: body.city,
          pincode: body.pincode,
          provider: 'email',
        },
      },
    })

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Registration failed. Please try again.' },
        { status: 500 }
      )
    }

    // Create profile record
    if (data.user) {
      await createProfile({
        auth_user_id: data.user.id,
        email: body.email.toLowerCase(),
        full_name: body.full_name,
        whatsapp_number: body.whatsapp_number,
        mobile_number: body.mobile_number || null,
        area: body.area,
        city: body.city,
        pincode: body.pincode,
        provider: 'email',
        profile_completed: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please verify your email with the OTP sent.',
      data: { email: body.email },
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Something went wrong during registration.' },
      { status: 500 }
    )
  }
}
