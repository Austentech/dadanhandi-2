import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit } from '@/lib/security/rate-limiter'
import { registerSchema } from '@/lib/validation/schemas'
import { createProfile, getProfileByEmail } from '@/services/profile-service'
import { sanitizeString } from '@/lib/security/utils'

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

    // Clean email — DON'T use sanitizeString (it strips < > ' " which can corrupt emails)
    // Zod's email() already validates format, just normalize case
    const cleanEmail = email.toLowerCase().trim()

    // Sanitize string inputs (safe for names, areas, cities)
    const cleanName = sanitizeString(full_name).trim()
    const cleanArea = sanitizeString(area).trim()
    const cleanCity = sanitizeString(city).trim()

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

    // 3. Check if email is already registered (wrapped in try for safety)
    try {
      const existingProfile = await getProfileByEmail(cleanEmail)
      if (existingProfile) {
        return NextResponse.json(
          { success: false, message: 'This email is already registered. Please log in instead.' },
          { status: 409 }
        )
      }
    } catch (err) {
      console.error('[REGISTER] Profile check failed (may need migration 002):', err)
      // Continue — the RPC function might not exist yet
    }

    const supabase = await createServerClient()

    // 4. Sign up user with email + password
    // Supabase automatically hashes the password with bcrypt — never stored in plaintext
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
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

    if (error) {
      const msg = (error.message || '').toLowerCase()

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
        // User was created but needs email confirmation — treat as success
        return NextResponse.json({
          success: true,
          message: 'Registration successful! Please check your email to verify your account, then log in.',
          data: { email: cleanEmail },
        })
      }

      console.error('[REGISTER ERROR] Supabase signUp failed:', msg, error.message)
      return NextResponse.json(
        { success: false, message: 'Registration failed. Please try again.' },
        { status: 500 }
      )
    }

    // 5. Profile auto-created by database trigger (handle_new_user)
    // Safety net: also create via RPC (bypasses RLS)
    if (data.user) {
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
        // Trigger should have created the profile — non-fatal
        console.error('[REGISTER] Profile creation safety-net failed (trigger should have handled it):', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful! You can now log in with your email and password.',
      data: { email: cleanEmail },
    })
  } catch (err) {
    console.error('[REGISTER ERROR]', err)
    return NextResponse.json(
      { success: false, message: 'Something went wrong during registration. Please try again.' },
      { status: 500 }
    )
  }
}
