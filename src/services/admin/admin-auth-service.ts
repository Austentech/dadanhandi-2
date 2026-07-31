/**
 * Admin Auth Service
 * Orchestrates the complete admin authentication flow:
 * 1. Send OTP → 2. Verify OTP → 3. Create Session → 4. Logout
 *
 * Security: Only registered admin emails are accepted.
 * Input is sanitized server-side. Email shows only the OTP code.
 */

import { createServerClient } from '@/lib/supabase/client-server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { ADMIN_CONFIG } from '@/lib/admin/config'
import { generateOtp, storeOtp, verifyOtp } from './admin-otp-service'
import { createSession, invalidateSession } from './admin-session-service'
import { sendEmail } from '@/lib/email'
import type { AdminUser, LoginLogStatus } from '@/types/admin'

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sanitize email: trim, lowercase, strip dangerous characters.
 * Returns null if input is suspicious (SQL injection patterns, etc.).
 */
function sanitizeEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email.trim()) return null
  const cleaned = email.trim().toLowerCase()
  // Block obviously malicious inputs
  if (/[;\'"\\<>]/.test(cleaned)) return null
  // Must match standard email format
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(cleaned)) return null
  // Max length sanity check
  if (cleaned.length > 254) return null
  return cleaned
}

/**
 * Create a login log entry.
 */
async function createLoginLog(params: {
  userId?: string | null
  email: string
  status: LoginLogStatus
  ipAddress?: string | null
  userAgent?: string | null
  failureReason?: string | null
}): Promise<void> {
  try {
    const supabase = await createServerClient()
    await supabase.from('admin_login_logs').insert({
      user_id: params.userId || null,
      email: params.email,
      status: params.status,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      failure_reason: params.failureReason || null,
    })
  } catch (err) {
    console.error('[ADMIN AUTH] Failed to create login log:', err)
  }
}

/**
 * Find an active admin user by email.
 * Returns null if not found or inactive.
 */
async function findAdminUser(email: string): Promise<AdminUser | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single()
  if (!data) return null
  return data as unknown as AdminUser
}

// ============================================================================
// SEND OTP
// ============================================================================

export async function handleSendOtp(
  email: unknown,
  ip: string
): Promise<{ success: boolean; message: string }> {
  // Sanitize — reject bad input immediately
  const sanitizedEmail = sanitizeEmail(email)
  if (!sanitizedEmail) {
    return { success: false, message: 'Please enter a valid email address.' }
  }

  // Rate limit: per IP
  const ipCheck = checkRateLimit(ip, 'admin_send_otp_ip', ADMIN_CONFIG.RATE_LIMITS.SEND_OTP)
  if (!ipCheck.allowed) {
    return {
      success: false,
      message: 'Too many requests. Please wait before trying again.',
    }
  }

  // Rate limit: per email
  const emailCheck = checkRateLimit(sanitizedEmail, 'admin_send_otp_email', ADMIN_CONFIG.RATE_LIMITS.SEND_OTP)
  if (!emailCheck.allowed) {
    return {
      success: false,
      message: 'Too many requests. Please wait before trying again.',
    }
  }

  // Check if this is a registered admin email — reject if not
  const adminUser = await findAdminUser(sanitizedEmail)
  if (!adminUser) {
    await createLoginLog({
      email: sanitizedEmail,
      status: 'failure',
      ipAddress: ip,
      failureReason: 'Unregistered admin email',
    })
    return {
      success: false,
      message: 'This email is not authorized for admin access.',
    }
  }

  // Generate and store OTP
  const otp = generateOtp()
  try {
    await storeOtp(sanitizedEmail, otp)

    // Send real email with ONLY the OTP code
    const emailResult = await sendEmail({
      to: sanitizedEmail,
      subject: 'Admin Login Code',
      text: otp,
    })

    if (!emailResult.success) {
      console.error('[ADMIN AUTH] Email send failed:', emailResult.error)
      return {
        success: false,
        message: 'Failed to send verification code. Please try again.',
      }
    }
  } catch (err) {
    console.error('[ADMIN AUTH] Failed to send OTP:', err)
    return {
      success: false,
      message: 'Something went wrong. Please try again.',
    }
  }

  return {
    success: true,
    message: 'Verification code sent to your email.',
  }
}

// ============================================================================
// VERIFY OTP
// ============================================================================

export async function handleVerifyOtp(
  email: unknown,
  otp: unknown,
  ip: string,
  userAgent: string | null
): Promise<{
  success: boolean
  message: string
  token?: string
  sessionId?: string
}> {
  // Sanitize email
  const sanitizedEmail = sanitizeEmail(email)
  if (!sanitizedEmail) {
    return { success: false, message: 'Invalid request.' }
  }

  // Sanitize OTP — must be string of correct length and valid characters
  if (typeof otp !== 'string') {
    return { success: false, message: 'Please enter a valid code.' }
  }
  const cleanOtp = otp.toUpperCase().trim()
  if (cleanOtp.length !== ADMIN_CONFIG.OTP_LENGTH || !/^[A-Z2-9]+$/.test(cleanOtp)) {
    return { success: false, message: 'Please enter a valid 6-character code.' }
  }

  // Rate limits
  const ipCheck = checkRateLimit(ip, 'admin_verify_otp_ip', ADMIN_CONFIG.RATE_LIMITS.VERIFY_OTP)
  if (!ipCheck.allowed) {
    await createLoginLog({ email: sanitizedEmail, status: 'rate_limited', ipAddress: ip, userAgent })
    return { success: false, message: 'Too many attempts. Please wait before trying again.' }
  }

  // Find admin user
  const adminResult = await findAdminUser(sanitizedEmail)
  if (!adminResult) {
    await createLoginLog({ email: sanitizedEmail, status: 'failure', ipAddress: ip, userAgent, failureReason: 'Unknown email' })
    return { success: false, message: 'Invalid code. Please try again.' }
  }

  // Verify OTP
  const result = await verifyOtp(sanitizedEmail, cleanOtp)
  if (!result.valid) {
    const reason = result.reason || 'invalid'
    const statusMap: Record<string, LoginLogStatus> = {
      expired: 'expired_otp',
      invalid: 'invalid_otp',
      max_attempts: 'rate_limited',
    }
    await createLoginLog({
      userId: adminResult.id,
      email: sanitizedEmail,
      status: statusMap[reason] || 'failure',
      ipAddress: ip,
      userAgent,
      failureReason: reason,
    })
    const messages: Record<string, string> = {
      expired: 'This code has expired. Please request a new one.',
      invalid: 'Invalid code. Please try again.',
      max_attempts: 'Too many failed attempts. Please request a new code.',
    }
    return { success: false, message: messages[reason] || 'Invalid code. Please try again.' }
  }

  // Create session
  const sessionResult = await createSession(adminResult.id)
  if (!sessionResult.token) {
    console.error('[ADMIN AUTH] Failed to create session after successful OTP verification')
    return { success: false, message: 'Something went wrong. Please try again.' }
  }

  // Update last login
  const supabase = await createServerClient()
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', adminResult.id)

  // Log success
  await createLoginLog({
    userId: adminResult.id,
    email: sanitizedEmail,
    status: 'success',
    ipAddress: ip,
    userAgent,
  })

  return {
    success: true,
    message: 'Login successful.',
    token: sessionResult.token,
    sessionId: sessionResult.sessionId,
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

export async function handleLogout(token: string, sessionId?: string): Promise<void> {
  await invalidateSession(token)
}

// ============================================================================
// GET ADMIN FROM TOKEN
// ============================================================================

export async function getAdminFromToken(token: string) {
  const { validateSession } = await import('./admin-session-service')
  return validateSession(token)
}

/**
 * Mask an email for display: admin@dadanhandi.com → ad***@dadanhandi.com
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}
