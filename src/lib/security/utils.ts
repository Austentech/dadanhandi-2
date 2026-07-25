import { headers } from 'next/headers'

/**
 * Extract client IP address from request headers.
 * Checks common proxy headers used by CDNs and load balancers.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers()

  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = headersList.get('x-real-ip')
  if (realIp) return realIp

  const cfIp = headersList.get('cf-connecting-ip')
  if (cfIp) return cfIp

  return 'unknown'
}

/**
 * Sanitize a string by removing potentially dangerous characters.
 * Preserves single quotes (apostrophes in names like O'Brien, D'Souza).
 * Only strips angle brackets and double quotes which can cause HTML injection.
 */
export function sanitizeString(input: string): string {
  if (!input) return ''
  return input
    .replace(/[<>"]/g, '')
    .trim()
}

/**
 * Sanitize an email address — only lowercase and trim.
 * DO NOT use sanitizeString on emails — it can corrupt valid addresses.
 */
export function sanitizeEmail(input: string): string {
  if (!input) return ''
  return input.toLowerCase().trim()
}

/**
 * Format a phone number to Indian format.
 */
export function formatIndianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `+91${cleaned}`
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`
  }
  return cleaned
}
