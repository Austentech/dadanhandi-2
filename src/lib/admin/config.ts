/**
 * Admin Panel Configuration
 * Central configuration for admin authentication, sessions, OTP, and security.
 * All thresholds are configurable and environment-aware.
 */

export const ADMIN_CONFIG = {
  /** Cookie name for admin session token */
  SESSION_COOKIE_NAME: 'admin_session',

  /** Max age of session cookie in seconds (7 days) */
  SESSION_COOKIE_MAX_AGE: 60 * 60 * 24 * 7,

  /** OTP: 6-character alphanumeric code */
  OTP_LENGTH: 6,

  /** OTP: expiry time in seconds (5 minutes) */
  OTP_EXPIRY_SECONDS: 5 * 60,

  /** OTP: max verification attempts before invalidation */
  OTP_MAX_ATTEMPTS: 5,

  /** OTP: character set (excludes confusing chars I, O, 0, 1) */
  OTP_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',

  /** Rate limiting: per-endpoint thresholds */
  RATE_LIMITS: {
    /** Send OTP: 5 requests per minute, block 5 minutes */
    SEND_OTP: { maxAttempts: 5, windowMs: 60 * 1000, blockDurationMs: 5 * 60 * 1000 },
    /** Verify OTP: 10 requests per minute, block 15 minutes */
    VERIFY_OTP: { maxAttempts: 10, windowMs: 60 * 1000, blockDurationMs: 15 * 60 * 1000 },
    /** General login attempts: 20 per hour, block 30 minutes */
    LOGIN_ATTEMPTS: { maxAttempts: 20, windowMs: 60 * 60 * 1000, blockDurationMs: 30 * 60 * 1000 },
  },

  /** Session: duration in hours (7 days) */
  SESSION_DURATION_HOURS: 24 * 7,

  /** Session: extend expiry on activity */
  SESSION_EXTEND_ON_ACTIVITY: true,

  /** Session: idle timeout in hours */
  SESSION_IDLE_TIMEOUT_HOURS: 8,

  /** Allowed origins for CORS / origin validation */
  ALLOWED_ORIGINS: [
    'http://localhost:3000',
    'https://admin.dadanhandi.com',
  ],

  /** Email: sender address */
  EMAIL_FROM: 'noreply@dadanhandi.com',

  /** Email: subject line for OTP */
  EMAIL_SUBJECT: 'Admin Portal - Your Verification Code',

  /** Session token length in bytes */
  TOKEN_LENGTH: 64,
} as const

export type AdminConfig = typeof ADMIN_CONFIG
