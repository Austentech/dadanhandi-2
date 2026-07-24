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

    // Check if profile already exists (means user already registered)
    const existingProfile = await getProfileByEmail(body.email)
    if (existingProfile) {
      return NextResponse.json(
        { success: false, message: 'This email is already registered. Please log in instead.' },
        { status: 409 }
      )
    }

    const supabase = await createServerClient()
    const normalizedEmail = body.email.toLowerCase()

    // Random password (user authenticates via OTP, not password)
    const randomPassword = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

    // Try to sign up — if user already exists in auth.users (from signInWithOtp),
    // signUp will return an error. We handle that gracefully.
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: randomPassword,
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

    // Handle "user already exists" error gracefully
    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already registered') || msg.includes('already been registered') ||
          msg.includes('already in use') || msg.includes('user already exists') ||
          msg.includes('identity already exists')) {
        return NextResponse.json(
          { success: false, message: 'This email is already registered. Please log in instead.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, message: 'Registration failed. Please try again.' },
        { status: 500 }
      )
    }

    // Profile is auto-created by the database trigger (handle_new_user)
    // which reads all fields from user_metadata (whatsapp, area, city, pincode)
    // As a safety net, also upsert via RPC
    if (data.user) {
      try {
        await createProfile({
          auth_user_id: data.user.id,
          email: normalizedEmail,
          full_name: body.full_name,
          whatsapp_number: body.whatsapp_number,
          mobile_number: body.mobile_number || null,
          area: body.area,
          city: body.city,
          pincode: body.pincode,
          provider: 'email',
          profile_completed: true,
        })
      } catch {
        // Trigger should have created the profile — this is just a safety net
      }

      // Send OTP email for the user to verify
      await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please check your email for the OTP code.',
      data: { email: normalizedEmail },
    })
  } catch (err) {
    console.error('[REGISTER ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong during registration. Please try again.' },
      { status: 500 }
    )
  }
}
