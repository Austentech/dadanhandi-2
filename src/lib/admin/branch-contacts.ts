/**
 * Branch Contact Configuration
 * ---------------------------
 * Centralized, single-source-of-truth for branch manager contact information.
 * Used by admin order cards to display branch name, manager contact,
 * and click-to-call functionality.
 *
 * MAINTENANCE: To update any branch's manager contact,
 * modify ONLY this file. All admin components read from here.
 */

export interface BranchContact {
  /** Branch slug matching public.branches.slug */
  slug: string
  /** Display name */
  name: string
  /** Manager contact number in E.164 format */
  managerPhone: string
  /** Manager name (placeholder until maintained in DB) */
  managerName: string
}

/**
 * Branch contact directory.
 * Keyed by slug for O(1) lookup.
 * Add or modify entries here to update all admin views.
 */
export const BRANCH_CONTACTS: Readonly<Record<string, BranchContact>> = {
  'danapur': {
    slug: 'danapur',
    name: 'Danapur Branch',
    managerPhone: '+911122334455',
    managerName: 'Branch Manager',
  },
  'rajeev-nagar': {
    slug: 'rajeev-nagar',
    name: 'Rajeev Nagar Branch',
    managerPhone: '+912233445566',
    managerName: 'Branch Manager',
  },
  'arraah': {
    slug: 'arraah',
    name: 'Arrah Branch',
    managerPhone: '+913344556677',
    managerName: 'Branch Manager',
  },
  'ranchi': {
    slug: 'ranchi',
    name: 'Ranchi Branch',
    managerPhone: '+914455667788',
    managerName: 'Branch Manager',
  },
} as const

/**
 * Get branch contact info by slug.
 * Returns null if slug is not found.
 */
export function getBranchContact(slug: string): BranchContact | null {
  return BRANCH_CONTACTS[slug] ?? null
}

/**
 * Format a phone number for display.
 * Converts "+911122334455" to "+91 11223 34455".
 */
export function formatPhoneDisplay(phone: string): string {
  // E.164 format: +<country><number>
  if (phone.startsWith('+') && phone.length >= 13) {
    const cc = phone.slice(0, 3)   // +91
    const mid = phone.slice(3, 8)  // 11223
    const end = phone.slice(8)     // 34455
    return `${cc} ${mid} ${end}`
  }
  return phone
}
