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
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>'"]/g, '')
    .trim()
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
