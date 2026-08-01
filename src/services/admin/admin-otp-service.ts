/**
 * Admin OTP Service
 * Generates, hashes, stores, and verifies 6-character alphanumeric OTP codes.
 * OTPs are SHA-256 hashed before storage — never stored in plain text.
 */

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/client-admin'
import { ADMIN_CONFIG } from '@/lib/admin/config'

// ============================================================================
// GENERATE OTP
// ============================================================================

/**
 * Generate a cryptographically secure 6-character alphanumeric OTP.
 * Uses crypto.randomBytes for CSPRNG.
 */
export function generateOtp(): string {
  const { OTP_LENGTH, OTP_ALPHABET } = ADMIN_CONFIG
  let otp = ''
  const randomBytes = crypto.randomBytes(OTP_LENGTH)
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += OTP_ALPHABET[randomBytes[i] % OTP_ALPHABET.length]
  }
  return otp
}

// ============================================================================
// HASH / VERIFY
// ============================================================================

/**
 * Hash an OTP string using SHA-256.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

/**
 * Constant-time comparison of two hex strings.
 * Prevents timing attacks on OTP verification.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  return crypto.timingSafeEqual(bufA, bufB)
}

// ============================================================================
// STORE OTP
// ============================================================================

/**
 * Store a hashed OTP in the database.
 * Deletes any previous unused OTPs for this email first.
 */
export async function storeOtp(email: string, otp: string): Promise<void> {
  const supabase = createAdminClient()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + ADMIN_CONFIG.OTP_EXPIRY_SECONDS * 1000).toISOString()

  // Delete any existing unused OTPs for this email
  await supabase
    .from('admin_otps')
    .delete()
    .eq('email', email)
    .is('verified_at', null)

  // Insert new OTP
  const { error } = await supabase.from('admin_otps').insert({
    email,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempts_used: 0,
    max_attempts: ADMIN_CONFIG.OTP_MAX_ATTEMPTS,
  })

  if (error) {
    throw new Error('Failed to store OTP')
  }
}

// ============================================================================
// VERIFY OTP
// ============================================================================

export interface OtpVerifyResult {
  valid: boolean
  reason?: 'expired' | 'invalid' | 'max_attempts'
}

/**
 * Verify an OTP against the stored hash.
 * Marks as verified on success, increments attempts on failure.
 */
export async function verifyOtp(email: string, otp: string): Promise<OtpVerifyResult> {
  const supabase = createAdminClient()

  // Fetch the latest unverified OTP for this email
  const { data: record, error } = await supabase
    .from('admin_otps')
    .select('*')
    .eq('email', email)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !record) {
    return { valid: false, reason: 'invalid' }
  }

  // Check expiry
  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' }
  }

  // Check max attempts
  if (record.attempts_used >= record.max_attempts) {
    return { valid: false, reason: 'max_attempts' }
  }

  // Hash and compare (constant-time)
  const inputHash = hashOtp(otp)
  if (!timingSafeEqualHex(inputHash, record.otp_hash)) {
    // Increment attempt counter
    await supabase
      .from('admin_otps')
      .update({ attempts_used: record.attempts_used + 1 })
      .eq('id', record.id)
    return { valid: false, reason: 'invalid' }
  }

  // Mark as verified
  await supabase
    .from('admin_otps')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', record.id)

  return { valid: true }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Delete expired OTPs older than 24 hours.
 */
export async function cleanupExpiredOtps(): Promise<void> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('admin_otps').delete().lt('created_at', cutoff)
}
