interface RateLimitEntry {
  count: number;
  lastAttempt: number;
  blockedUntil: number;
  backoffMultiplier: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
  maxBlockMs: number;
  backoffFactor: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  // Max requests within the window before blocking
  maxAttempts: 5,
  // Time window for counting attempts (1 minute)
  windowMs: 60 * 1000,
  // Initial block duration (1 minute)
  blockDurationMs: 60 * 1000,
  // Maximum block duration cap (24 hours)
  maxBlockMs: 24 * 60 * 60 * 1000,
  // Exponential backoff multiplier (each block doubles)
  backoffFactor: 2,
}

// In-memory store (works per process, resets on restart)
// For production with multiple instances, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.blockedUntil < now && now - entry.lastAttempt > DEFAULT_CONFIG.windowMs) {
      rateLimitStore.delete(key)
    }
  }
  lastCleanup = now
}

function getKey(identifier: string, type: string): string {
  return `${type}:${identifier}`
}

export interface RateLimitResult {
  allowed: boolean
  remainingAttempts: number
  retryAfterMs: number | null
}

/**
 * Check rate limit for a given identifier (IP or email).
 * Implements exponential backoff blocking.
 */
export function checkRateLimit(
  identifier: string,
  type: string,
  config?: Partial<RateLimitConfig>
): RateLimitResult {
  cleanup()

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const key = getKey(identifier, type)
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  if (!entry) {
    entry = {
      count: 0,
      lastAttempt: 0,
      blockedUntil: 0,
      backoffMultiplier: 1,
    }
    rateLimitStore.set(key, entry)
  }

  // Check if currently blocked
  if (entry.blockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: entry.blockedUntil - now,
    }
  }

  // Reset count if window has passed since last attempt
  if (now - entry.lastAttempt > mergedConfig.windowMs) {
    entry.count = 0
    entry.backoffMultiplier = 1
  }

  // Increment count
  entry.count += 1
  entry.lastAttempt = now

  // Check if limit exceeded
  if (entry.count > mergedConfig.maxAttempts) {
    const blockDuration = Math.min(
      mergedConfig.blockDurationMs * entry.backoffMultiplier,
      mergedConfig.maxBlockMs
    )
    entry.blockedUntil = now + blockDuration
    entry.backoffMultiplier *= mergedConfig.backoffFactor

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: blockDuration,
    }
  }

  return {
    allowed: true,
    remainingAttempts: mergedConfig.maxAttempts - entry.count,
    retryAfterMs: null,
  }
}

/**
 * Reset rate limit for a specific identifier (e.g., after successful auth).
 */
export function resetRateLimit(identifier: string, type: string): void {
  const key = getKey(identifier, type)
  rateLimitStore.delete(key)
}

/**
 * Check rate limit for both IP and email (AND logic).
 * Used for OTP requests where both should be limited.
 */
export function checkDualRateLimit(
  ip: string,
  email: string,
  type: string,
  config?: Partial<RateLimitConfig>
): RateLimitResult {
  const ipResult = checkRateLimit(ip, type, config)
  const emailResult = checkRateLimit(email, type, config)

  if (!ipResult.allowed) {
    return ipResult
  }

  if (!emailResult.allowed) {
    return emailResult
  }

  return {
    allowed: true,
    remainingAttempts: Math.min(ipResult.remainingAttempts, emailResult.remainingAttempts),
    retryAfterMs: null,
  }
}
