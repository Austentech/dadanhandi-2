/**
 * Admin Session Service
 * Creates, validates, and invalidates admin sessions.
 * Session tokens are SHA-256 hashed before storage.
 */

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/client-admin'
import { ADMIN_CONFIG } from '@/lib/admin/config'
import type { AdminUser, AdminSession } from '@/types/admin'
import { headers } from 'next/headers'

// ============================================================================
// HELPERS
// ============================================================================

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function getIp(): Promise<string> {
  try {
    const h = await headers()
    const forwarded = h.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
    const real = h.get('x-real-ip')
    if (real) return real
    const cf = h.get('cf-connecting-ip')
    if (cf) return cf
  } catch { /* headers() may fail in non-request context */ }
  return 'unknown'
}

function extractDeviceInfo(userAgent: string | null): string {
  if (!userAgent) return 'Unknown'
  // Simple device info extraction
  if (/Mobile/i.test(userAgent)) return 'Mobile'
  if (/Tablet/i.test(userAgent)) return 'Tablet'
  if (/iPad/i.test(userAgent)) return 'Tablet'
  return 'Desktop'
}

// ============================================================================
// CREATE SESSION
// ============================================================================

export interface CreateSessionResult {
  token: string
  sessionId: string
  expiresAt: Date
}

/**
 * Create a new admin session.
 * Returns the raw token (to be set in cookie) and metadata.
 */
export async function createSession(
  userId: string,
  request?: Request
): Promise<CreateSessionResult> {
  const supabase = createAdminClient()
  const tokenBytes = crypto.randomBytes(ADMIN_CONFIG.TOKEN_LENGTH)
  const token = tokenBytes.toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + ADMIN_CONFIG.SESSION_DURATION_HOURS * 60 * 60 * 1000)

  let ipAddress = 'unknown'
  let userAgent = null
  if (request) {
    const h = request.headers
    const forwarded = h.get('x-forwarded-for')
    if (forwarded) ipAddress = forwarded.split(',')[0]?.trim() || 'unknown'
    else {
      const real = h.get('x-real-ip')
      if (real) ipAddress = real
    }
    userAgent = h.get('user-agent') || null
  }

  const { data, error } = await supabase.from('admin_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    ip_address: ipAddress,
    user_agent: userAgent,
    device_info: extractDeviceInfo(userAgent),
    expires_at: expiresAt.toISOString(),
    is_valid: true,
  }).select('id').single()

  if (error || !data) {
    throw new Error('Failed to create session')
  }

  return {
    token,
    sessionId: data.id,
    expiresAt,
  }
}

// ============================================================================
// VALIDATE SESSION
// ============================================================================

export interface ValidateSessionResult {
  valid: boolean
  session?: AdminSession
  user?: AdminUser
}

/**
 * Validate a session token.
 * Updates last_active_at on successful validation.
 */
export async function validateSession(token: string): Promise<ValidateSessionResult> {
  const supabase = createAdminClient()
  const tokenHash = hashToken(token)
  const now = new Date().toISOString()

  // Find valid, non-expired session
  const { data: session, error: sessionErr } = await supabase
    .from('admin_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('is_valid', true)
    .gt('expires_at', now)
    .single()

  if (sessionErr || !session) {
    return { valid: false }
  }

  // Update last active
  await supabase
    .from('admin_sessions')
    .update({ last_active_at: now })
    .eq('id', session.id)

  // Fetch user
  const { data: user, error: userErr } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', session.user_id)
    .eq('is_active', true)
    .single()

  if (userErr || !user) {
    // User no longer active — invalidate session
    await supabase.from('admin_sessions').update({ is_valid: false }).eq('id', session.id)
    return { valid: false }
  }

  return {
    valid: true,
    session: session as unknown as AdminSession,
    user: user as unknown as AdminUser,
  }
}

// ============================================================================
// INVALIDATE SESSION
// ============================================================================

/**
 * Invalidate a single session.
 */
export async function invalidateSession(token: string): Promise<void> {
  const supabase = createAdminClient()
  const tokenHash = hashToken(token)
  await supabase.from('admin_sessions').update({ is_valid: false }).eq('token_hash', tokenHash)
}

/**
 * Invalidate all sessions for a user.
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('admin_sessions').update({ is_valid: false }).eq('user_id', userId)
}

// ============================================================================
// GET ACTIVE SESSIONS
// ============================================================================

/**
 * Get all valid, non-expired sessions for a user.
 */
export async function getActiveSessions(userId: string): Promise<AdminSession[]> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('admin_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .gt('expires_at', now)
    .order('last_active_at', { ascending: false })
  return (data || []) as unknown as AdminSession[]
}

/**
 * Get IP address from request context.
 */
export { getIp }
