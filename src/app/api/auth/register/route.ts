import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { registerSchema } from '@/lib/validation/schemas'
import { createProfile, getProfileByEmail } from '@/services/profile-service'
import { sanitizeString, sanitizeEmail } from '@/lib/security/utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 1. Validate all fields including password
    const validationResult = registerSchema.safeParse(body)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { success: false, message: firstError?.message || 'Validation failed.' },
        { status: 400 }
      )
    }

    const { full_name, email, password, whatsapp_number, mobile_number, area, city, pincode } = validationResult.data

    // Use sanitizeEmail — DO NOT use sanitizeString on emails (it can corrupt them)
    const cleanEmail = sanitizeEmail(email)

    // sanitizeString only strips < > " (preserves apostrophes like O'Brien)
    const cleanName = sanitizeString(full_name)
    const cleanArea = sanitizeString(area)
    const cleanCity = sanitizeString(city)

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
        { success: false, message: `Too many registration attempts. Please try again in ${retrySeconds} seconds.` },
        { status: 429 }
      )
    }

    // 3. Check if email is already registered (safe wrapper in case RPC doesn't exist)
    try {
      const existingProfile = await getProfileByEmail(cleanEmail)
      if (existingProfile) {
        return NextResponse.json(
          { success: false, message: 'This email is already registered. Please log in instead.' },
          { status: 409 }
        )
      }
    } catch (err) {
      console.error('[REGISTER] Profile check RPC failed (migration 002 may not be run):', err)
      // Continue anyway — the trigger will handle profile creation
    }

    // 4. Create Supabase server client
    let supabase
    try {
      supabase = await createServerClient()
    } catch (err) {
      console.error('[REGISTER] Supabase client creation failed:', err)
      return NextResponse.json(
        { success: false, message: 'Server configuration error. Please contact support.' },
        { status: 500 }
      )
    }

    // 5. Sign up user with email + password
    // Supabase automatically hashes the password with bcrypt
    let signUpResult
    try {
      signUpResult = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://dadanhandihotel.com'}`,
          data: {
            full_name: cleanName,
            whatsapp_number: whatsapp_number,
            mobile_number: mobile_number || null,
            area: cleanArea,
            city: cleanCity,
            pincode: pincode,
            provider: 'email',
          },
        },
      })
    } catch (err) {
      console.error('[REGISTER] signUp network/unknown error:', err)
      return NextResponse.json(
        { success: false, message: 'Registration failed due to a network error. Please try again.' },
        { status: 500 }
      )
    }

    const { data, error } = signUpResult

    // Handle Supabase signUp errors with detailed messages
    if (error) {
      const msg = (error.message || '').toLowerCase()
      const status = error.status || 500

      console.error('[REGISTER ERROR] Supabase signUp error:', {
        message: error.message,
        status: error.status,
        name: error.name,
      })

      if (msg.includes('already registered') || msg.includes('already been registered') ||
          msg.includes('already in use') || msg.includes('identity already exists')) {
        return NextResponse.json(
          { success: false, message: 'This email is already registered. Please log in instead.' },
          { status: 409 }
        )
      }

      if (msg.includes('password')) {
        return NextResponse.json(
          { success: false, message: 'Password does not meet requirements. Use 8+ chars with uppercase, lowercase, number, and special character.' },
          { status: 400 }
        )
      }

      if (msg.includes('email not confirmed') || msg.includes('confirmation')) {
        // User was created but email not confirmed — still success for us
        if (data?.user) {
          return NextResponse.json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account, then log in.',
            data: { email: cleanEmail },
          })
        }
      }

      if (msg.includes('rate limit') || msg.includes('too many')) {
        return NextResponse.json(
          { success: false, message: 'Too many registration attempts. Please wait a few minutes and try again.' },
          { status: 429 }
        )
      }

      if (msg.includes('signup') && msg.includes('disabled')) {
        return NextResponse.json(
          { success: false, message: 'Email registration is currently disabled. Please use Google login or contact support.' },
          { status: 403 }
        )
      }

      if (msg.includes('invalid email') || msg.includes('unable to validate')) {
        return NextResponse.json(
          { success: false, message: 'Invalid email address. Please check and try again.' },
          { status: 400 }
        )
      }

      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        return NextResponse.json(
          { success: false, message: 'Network error. Please check your connection and try again.' },
          { status: 503 }
        )
      }

      // Unknown error — return with Supabase error details for debugging
      return NextResponse.json(
        { success: false, message: `Registration failed: ${error.message || 'Unknown error. Please try again.'}` },
        { status: status >= 400 && status < 500 ? status : 500 }
      )
    }

    // 6. signUp succeeded — create profile
    // If email confirmation is ON: data.user exists but data.session is null — still create profile
    // If email confirmation is OFF: data.user and data.session both exist

    if (data?.user) {
      try {
        await createProfile({
          auth_user_id: data.user.id,
          email: cleanEmail,
          full_name: cleanName,
          whatsapp_number: whatsapp_number,
          mobile_number: mobile_number || null,
          area: cleanArea,
          city: cleanCity,
          pincode: pincode,
          provider: 'email',
          profile_completed: true,
        })
      } catch (err) {
        // Profile creation failed — but the auth user was created
        // The database trigger should have handled it, so this is a safety net
        console.error('[REGISTER] Profile creation RPC failed:', err)
      }
    }

    // If no session = email confirmation required
    const needsConfirmation = !data?.session

    return NextResponse.json({
      success: true,
      message: needsConfirmation
        ? 'Registration successful! Please check your email to verify your account, then log in.'
        : 'Registration successful! You can now log in with your email and password.',
      data: { email: cleanEmail },
    })
  } catch (err) {
    console.error('[REGISTER UNEXPECTED ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong during registration. Please try again.' },
      { status: 500 }
    )
  }
}
