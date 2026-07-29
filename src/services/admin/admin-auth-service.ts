/**
 * Admin Auth Service
 * Orchestrates the complete admin authentication flow:
 * 1. Send OTP → 2. Verify OTP → 3. Create Session → 4. Logout
 * Also handles login logging and account enumeration prevention.
 */

import { createServerClient } from '@/lib/supabase/client-server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { ADMIN_CONFIG } from '@/lib/admin/config'
import { generateOtp, storeOtp, verifyOtp } from './admin-otp-service'
import { createSession, invalidateSession } from './admin-session-service'
import type { AdminUser, AdminLoginLog, LoginLogStatus } from '@/types/admin'

// ============================================================================
// HELPERS
// ============================================================================

function sanitizeEmail(email: string): string {
  return (email || '').toLowerCase().trim()
}

/**
 * Send OTP email. In production, integrate Resend/SMTP.
 * For now, logs to console in development.
 */
async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const subject = ADMIN_CONFIG.EMAIL_SUBJECT
  const body = `Your admin login verification code is: ${otp}\n\nThis code expires in ${ADMIN_CONFIG.OTP_EXPIRY_SECONDS / 60} minutes.\n\nIf you did not request this code, please ignore this email.`

  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate Resend or SMTP for production email delivery
    // This is a placeholder that logs the email content.
    // Replace with actual email service integration.
    console.log(`[ADMIN AUTH] Email to: ${email}`)
    console.log(`[ADMIN AUTH] Subject: ${subject}`)
    console.log(`[ADMIN AUTH] OTP: ${otp}`)
    console.log('[ADMIN AUTH] WARNING: Production email not configured. OTP logged to console.')
  } else {
    console.log(`\n[ADMIN DEV] ===== OTP EMAIL =====`)
    console.log(`[ADMIN DEV] To: ${email}`)
    console.log(`[ADMIN DEV] OTP: ${otp}`)
    console.log(`[ADMIN DEV] Expires in: ${ADMIN_CONFIG.OTP_EXPIRY_SECONDS / 60} minutes`)
    console.log(`[ADMIN DEV] ========================\n`)
  }
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
    // Never expose log errors to the client
    console.error('[ADMIN AUTH] Failed to create login log:', err)
  }
}

/**
 * Find an admin user by email.
 * Returns null if not found or inactive — callers should NOT distinguish.
 */
async function findAdminUser(email: string): Promise<{ user: AdminUser } | null> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single()
  if (!data) return null
  return { user: data as unknown as AdminUser }
}

// ============================================================================
// SEND OTP
// ============================================================================

export async function handleSendOtp(
  email: string,
  ip: string
): Promise<{ success: boolean; message: string }> {
  const sanitizedEmail = sanitizeEmail(email)

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
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

  // Check if admin exists (but never reveal this to the caller)
  const adminResult = await findAdminUser(sanitizedEmail)

  if (adminResult) {
    // Generate and store OTP
    const otp = generateOtp()
    try {
      await storeOtp(sanitizedEmail, otp)
      await sendOtpEmail(sanitizedEmail, otp)
    } catch (err) {
      console.error('[ADMIN AUTH] Failed to send OTP:', err)
      return {
        success: false,
        message: 'Something went wrong. Please try again.',
      }
    }
  }

  // Always return the same generic message
  return {
    success: true,
    message: 'If this email is registered, a verification code has been sent.',
  }
}

// ============================================================================
// VERIFY OTP
// ============================================================================

export async function handleVerifyOtp(
  email: string,
  otp: string,
  ip: string,
  userAgent: string | null
): Promise<{
  success: boolean
  message: string
  token?: string
  sessionId?: string
}> {
  const sanitizedEmail = sanitizeEmail(email)

  // Validate OTP format
  if (!otp || otp.length !== ADMIN_CONFIG.OTP_LENGTH || !/^[A-Z2-9]+$/.test(otp.toUpperCase())) {
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
    // Don't reveal whether email exists
    await createLoginLog({ email: sanitizedEmail, status: 'failure', ipAddress: ip, userAgent, failureReason: 'Unknown email' })
    return { success: false, message: 'Invalid code. Please try again.' }
  }

  // Verify OTP
  const result = await verifyOtp(sanitizedEmail, otp.toUpperCase())
  if (!result.valid) {
    const reason = result.reason || 'invalid'
    const statusMap: Record<string, LoginLogStatus> = {
      expired: 'expired_otp',
      invalid: 'invalid_otp',
      max_attempts: 'rate_limited',
    }
    await createLoginLog({
      userId: adminResult.user.id,
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
  const sessionResult = await createSession(adminResult.user.id)
  if (!sessionResult.token) {
    console.error('[ADMIN AUTH] Failed to create session after successful OTP verification')
    return { success: false, message: 'Something went wrong. Please try again.' }
  }

  // Update last login
  const supabase = await createServerClient()
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', adminResult.user.id)

  // Log success
  await createLoginLog({
    userId: adminResult.user.id,
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
  // Session duration is calculated by DB trigger or on read
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
