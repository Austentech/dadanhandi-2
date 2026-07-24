'use server'

import { createServerClient } from '@/lib/supabase/client-server'
import { checkDualRateLimit, resetRateLimit } from '@/lib/security/rate-limiter'
import { getClientIp } from '@/lib/security/utils'
import { emailSchema, otpSchema, registerSchema, completeProfileSchema } from '@/lib/validation/schemas'
import { createProfile, getProfileByEmail, updateProfile } from '@/services/profile-service'

type ActionResult<T = void> = {
  success: boolean
  message: string
  data?: T
}

/**
 * Send OTP to email address.
 * Uses Supabase's native passwordless/email OTP flow.
 */
export async function sendOTP(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const email = formData.get('email') as string

    // Validate email
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      return { success: false, message: 'Please enter a valid email address.' }
    }

    const ip = await getClientIp()

    // Rate limit check (both IP and email)
    const rateCheck = checkDualRateLimit(ip, email, 'otp_request', {
      maxAttempts: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
      return {
        success: false,
        message: `Too many attempts. Please try again in ${retrySeconds} seconds.`,
      }
    }

    const supabase = await createServerClient()

    // Check if user exists — send OTP for login or signup
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      filters: `email.eq.${email}`,
    })

    // Use Supabase native magic link/OTP
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (error) {
      // Always return generic message to not leak information
      return {
        success: false,
        message: 'Unable to send OTP. Please try again later.',
      }
    }

    return { success: true, message: 'OTP sent successfully.', data: { email } }
  } catch {
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    }
  }
}

/**
 * Verify OTP code.
 */
export async function verifyOTP(_prevState: ActionResult, formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const email = formData.get('email') as string
    const otp = formData.get('otp') as string

    // Validate inputs
    const emailResult = emailSchema.safeParse(email)
    if (!emailResult.success) {
      return { success: false, message: 'Invalid email address.' }
    }

    const otpResult = otpSchema.safeParse(otp)
    if (!otpResult.success) {
      return { success: false, message: 'Please enter a valid 6-digit OTP.' }
    }

    const ip = await getClientIp()

    // Rate limit
    const rateCheck = checkDualRateLimit(ip, email, 'auth_attempt', {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 120 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 120000) / 1000)
      return {
        success: false,
        message: `Too many attempts. Please try again in ${retrySeconds} seconds.`,
      }
    }

    const supabase = await createServerClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token: otp,
      type: 'email',
    })

    if (error) {
      // Generic error message — never expose specific failure reason
      return { success: false, message: 'Invalid or expired OTP. Please try again.' }
    }

    // Reset rate limit on successful verification
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

    return {
      success: true,
      message: 'Login successful!',
      data: { redirectTo: '/' },
    }
  } catch {
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    }
  }
}

/**
 * Register a new user and send OTP for email verification.
 */
export async function registerUser(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const rawData = {
      full_name: formData.get('full_name') as string,
      email: formData.get('email') as string,
      whatsapp_number: formData.get('whatsapp_number') as string,
      mobile_number: formData.get('mobile_number') as string || undefined,
      area: formData.get('area') as string,
      city: formData.get('city') as string,
      pincode: formData.get('pincode') as string,
    }

    // Validate all fields
    const validationResult = registerSchema.safeParse(rawData)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return { success: false, message: firstError?.message || 'Validation failed.' }
    }

    const ip = await getClientIp()

    // Rate limit registration
    const rateCheck = checkDualRateLimit(ip, rawData.email, 'otp_request', {
      maxAttempts: 3,
      windowMs: 60 * 1000,
      blockDurationMs: 300 * 1000,
    })

    if (!rateCheck.allowed) {
      const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 300000) / 1000)
      return {
        success: false,
        message: `Too many registration attempts. Please try again in ${retrySeconds} seconds.`,
      }
    }

    const supabase = await createServerClient()

    // Check if email is already taken
    const existingProfile = await getProfileByEmail(rawData.email)
    if (existingProfile) {
      return { success: false, message: 'This email is already registered. Please log in.' }
    }

    // Sign up user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: rawData.email.toLowerCase(),
      password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      options: {
        data: {
          full_name: rawData.full_name,
          whatsapp_number: rawData.whatsapp_number,
          mobile_number: rawData.mobile_number || null,
          area: rawData.area,
          city: rawData.city,
          pincode: rawData.pincode,
          provider: 'email',
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    })

    if (error) {
      return { success: false, message: 'Registration failed. Please try again.' }
    }

    // Create profile record
    if (data.user) {
      await createProfile({
        auth_user_id: data.user.id,
        email: rawData.email.toLowerCase(),
        full_name: rawData.full_name,
        whatsapp_number: rawData.whatsapp_number,
        mobile_number: rawData.mobile_number || null,
        area: rawData.area,
        city: rawData.city,
        pincode: rawData.pincode,
        provider: 'email',
        profile_completed: true,
      })
    }

    // Send OTP for email verification
    await supabase.auth.signInWithOtp({
      email: rawData.email.toLowerCase(),
      options: {
        shouldCreateUser: false,
      },
    })

    return {
      success: true,
      message: 'Registration successful! Please verify your email with the OTP sent.',
      data: { email: rawData.email },
    }
  } catch {
    return {
      success: false,
      message: 'Something went wrong during registration. Please try again.',
    }
  }
}

/**
 * Complete profile for Google OAuth users who are missing required fields.
 */
export async function completeProfile(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const rawData = {
      whatsapp_number: formData.get('whatsapp_number') as string,
      area: formData.get('area') as string,
      city: formData.get('city') as string,
      pincode: formData.get('pincode') as string,
    }

    const validationResult = completeProfileSchema.safeParse(rawData)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return { success: false, message: firstError?.message || 'Validation failed.' }
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, message: 'Please log in to continue.' }
    }

    await updateProfile(user.id, {
      whatsapp_number: rawData.whatsapp_number,
      area: rawData.area,
      city: rawData.city,
      pincode: rawData.pincode,
      profile_completed: true,
    })

    return { success: true, message: 'Profile completed successfully!' }
  } catch {
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    }
  }
}

/**
 * Resend OTP.
 */
export async function resendOTP(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string
  if (!email) return { success: false, message: 'Email is required.' }

  const ip = await getClientIp()

  const rateCheck = checkDualRateLimit(ip, email, 'otp_request', {
    maxAttempts: 5,
    windowMs: 60 * 1000,
    blockDurationMs: 60 * 1000,
  })

  if (!rateCheck.allowed) {
    const retrySeconds = Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)
    return {
      success: false,
      message: `Please wait ${retrySeconds} seconds before requesting another OTP.`,
    }
  }

  const supabase = await createServerClient()

  const { error } = await supabase.auth.resend({
    type: 'email',
    email: email.toLowerCase(),
  })

  if (error) {
    return { success: false, message: 'Unable to resend OTP. Please try again.' }
  }

  return { success: true, message: 'OTP resent successfully!' }
}
