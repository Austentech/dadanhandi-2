/**
 * Branch Catalog
 * --------------
 * Application-side declaration of the four pickup branches.
 *
 * This is a SECONDARY source of truth — the database (public.branches table)
 * is the canonical source. This file is used for:
 *  - Display in UI components without a round-trip to the server
 *  - Server-side validation that a slug is one we recognize
 *
 * If branches are added/removed in the database, this file MUST be updated
 * to match. The /api/branches endpoint reads from the DB, so new branches
 * appear automatically in the UI without code changes — but slug validation
 * on the server requires this list.
 *
 * Slug MUST match the `slug` column in public.branches (migration 004).
 */

import type { Branch } from '@/types/checkout'

export const BRANCHES: readonly Branch[] = [
  {
    id: 'danapur',  // Note: DB generates UUID; this is the slug used as a stable key for client display.
    slug: 'danapur',
    name: 'Danapur Branch',
    addressLine1: 'Saguna Khagaul Road, Kaliket Nagar, Danapur',
    addressLine2: 'Patna, Bihar',
    city: 'Patna',
    state: 'Bihar',
    pincode: '801105',
    latitude: null,
    longitude: null,
    openingTime: '10:00:00',
    closingTime: '22:00:00',
    status: 'active',
    sortOrder: 1,
  },
  {
    id: 'rajeev-nagar',
    slug: 'rajeev-nagar',
    name: 'Rajeev Nagar Branch',
    addressLine1: 'Nepali Nagar More, Rajeev Nagar, Ashiana More, Bailey Road',
    addressLine2: 'Patna, Bihar',
    city: 'Patna',
    state: 'Bihar',
    pincode: '801503',
    latitude: null,
    longitude: null,
    openingTime: '10:00:00',
    closingTime: '22:00:00',
    status: 'active',
    sortOrder: 2,
  },
  {
    id: 'arraah',
    slug: 'arraah',
    name: 'Arrah Branch',
    addressLine1: 'S Bhelai Road, Sarvodaya Nagar, Jagdev Nagar',
    addressLine2: 'Arrah, Bihar',
    city: 'Arrah',
    state: 'Bihar',
    pincode: '802301',
    latitude: null,
    longitude: null,
    openingTime: '10:00:00',
    closingTime: '22:00:00',
    status: 'active',
    sortOrder: 3,
  },
  {
    id: 'ranchi',
    slug: 'ranchi',
    name: 'Ranchi Branch',
    addressLine1: 'H.B Road, Opposite Electricity Board, Kokar',
    addressLine2: 'Ranchi, Jharkhand',
    city: 'Ranchi',
    state: 'Jharkhand',
    pincode: '834001',
    latitude: null,
    longitude: null,
    openingTime: '10:00:00',
    closingTime: '22:00:00',
    status: 'active',
    sortOrder: 4,
  },
] as const

/**
 * Get a branch by slug. Returns null if not found.
 * Used for fast server-side slug validation without a DB round-trip.
 */
export function getBranchBySlug(slug: string): Branch | null {
  return BRANCHES.find((b) => b.slug === slug && b.status === 'active') ?? null
}

/**
 * Get all active branches. Sorted by sortOrder.
 */
export function getActiveBranches(): Branch[] {
  return [...BRANCHES].filter((b) => b.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Check if a slug refers to a known active branch.
 */
export function isValidBranchSlug(slug: string): boolean {
  return getBranchBySlug(slug) !== null
}
