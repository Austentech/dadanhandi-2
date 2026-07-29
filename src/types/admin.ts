// ============================================================================
// Admin Panel TypeScript Types — Dadan Handi
// ============================================================================
// Types for the admin authentication system, session management, login
// audit logs, and dashboard API responses. These mirror the schema defined
// in Supabase migration 007_admin_panel_tables.sql.
// ============================================================================

// ---------------------------------------------------------------------------
// Database-mapped types (1:1 with Supabase tables)
// ---------------------------------------------------------------------------

/** Admin user record stored in admin_users */
export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'viewer'
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

/** Active session record stored in admin_sessions */
export interface AdminSession {
  id: string
  user_id: string
  token_hash: string
  ip_address: string | null
  user_agent: string | null
  device_info: string | null
  expires_at: string
  is_valid: boolean
  created_at: string
  last_active_at: string
}

/**
 * OTP record stored in admin_otps.
 * ⚠️  INTERNAL ONLY — this type must never be serialized to the client.
 */
export interface AdminOtpRecord {
  id: string
  email: string
  otp_hash: string
  expires_at: string
  attempts_used: number
  max_attempts: number
  verified_at: string | null
  created_at: string
}

/** Audit log entry for every login attempt stored in admin_login_logs */
export interface AdminLoginLog {
  id: string
  user_id: string | null
  email: string
  login_at: string
  logout_at: string | null
  session_duration_seconds: number | null
  status: LoginLogStatus
  failure_reason: string | null
  ip_address: string | null
  user_agent: string | null
  device_info: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

/** All possible login log statuses */
export type LoginLogStatus =
  | 'success'
  | 'failure'
  | 'expired_otp'
  | 'rate_limited'
  | 'invalid_otp'

/** All possible admin roles */
export type AdminRole = 'super_admin' | 'admin' | 'viewer'

// ---------------------------------------------------------------------------
// Safe / Client-facing types (stripped of sensitive fields)
// ---------------------------------------------------------------------------

/**
 * Sanitized admin user shape returned to the client.
 * The raw email is masked to prevent exposure.
 */
export interface SafeAdminUser {
  id: string
  name: string
  email_masked: string // e.g. "a***@dadanhandi.com"
  role: AdminRole
  last_login_at: string | null
}

/** Session info returned to the client after login */
export interface AdminSessionInfo {
  user: SafeAdminUser
  session_id: string
  expires_at: string
}

// ---------------------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------------------

/** Generic admin API response wrapper */
export interface AdminApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
}

/** Request body for requesting an OTP */
export interface AdminOtpRequest {
  email: string
}

/** Request body for verifying an OTP */
export interface AdminOtpVerifyRequest {
  email: string
  otp: string
}

/** Request body for logging out (invalidates session) */
export interface AdminLogoutRequest {
  session_id: string
}

/** Dashboard statistics returned by the admin overview endpoint */
export interface AdminDashboardStats {
  todayOrders: number
  pendingOrders: number
  ongoingOrders: number
  completedOrders: number
}

// ---------------------------------------------------------------------------
// Login log query filters
// ---------------------------------------------------------------------------

/** Optional filters for querying admin login logs */
export interface AdminLoginLogFilters {
  email?: string
  status?: LoginLogStatus
  from_date?: string
  to_date?: string
  page?: number
  per_page?: number
}

/** Paginated response for login logs */
export interface AdminLoginLogResponse extends AdminApiResponse<AdminLoginLog[]> {
  total: number
  page: number
  per_page: number
  total_pages: number
}
