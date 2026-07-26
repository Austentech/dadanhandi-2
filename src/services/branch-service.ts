/**
 * Branch Service (server-side)
 * ----------------------------
 * Reads branches from the database (single source of truth).
 * Validates branch slug + operating hours.
 *
 * All branches are public — anyone (including anon) can read them.
 * Mutations (add/edit) are reserved for the future admin module.
 */

import { createServerClient } from '@/lib/supabase/client-server'
import { getBranchBySlug as getBranchFromCatalog, getActiveBranches as getCatalogBranches } from '@/constants/branches'
import { isBranchOpen, toBranchSnapshot } from '@/lib/branch-utils'
import type { Branch, BranchSnapshot } from '@/types/checkout'

// Re-export pure helpers for backward compatibility with existing imports
export { isBranchOpen, toBranchSnapshot }

// ============================================================================
// TYPES
// ============================================================================
interface DbBranchRow {
  id: string
  slug: string
  name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  pincode: string | null
  latitude: number | null
  longitude: number | null
  opening_time: string
  closing_time: string
  status: string
  sort_order: number
}

function rowToBranch(row: DbBranchRow): Branch {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    latitude: row.latitude,
    longitude: row.longitude,
    openingTime: typeof row.opening_time === 'string' ? row.opening_time.slice(0, 8) : row.opening_time,
    closingTime: typeof row.closing_time === 'string' ? row.closing_time.slice(0, 8) : row.closing_time,
    status: row.status as Branch['status'],
    sortOrder: row.sort_order,
  }
}

// ============================================================================
// GET ALL BRANCHES
// ============================================================================
/**
 * List all active branches. Tries DB first; falls back to constants catalog
 * if DB is unavailable (e.g. migration not yet applied).
 */
export async function listBranches(): Promise<Branch[]> {
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('get_branches')

    if (error) {
      console.error('[BRANCH SERVICE] listBranches RPC error:', error.message)
      return getCatalogBranches()
    }

    if (!data || (data as DbBranchRow[]).length === 0) {
      // DB returned empty — fall back to catalog
      return getCatalogBranches()
    }

    return (data as DbBranchRow[]).map(rowToBranch)
  } catch (err) {
    console.error('[BRANCH SERVICE] listBranches unexpected error:', err)
    return getCatalogBranches()
  }
}

// ============================================================================
// GET BRANCH BY SLUG
// ============================================================================
/**
 * Fetch a single branch by slug. Returns null if not found or inactive.
 * Falls back to catalog if DB unavailable.
 */
export async function getBranchBySlug(slug: string): Promise<Branch | null> {
  // Quick catalog check first (fast fail for invalid slugs)
  const catalogBranch = getBranchFromCatalog(slug)
  if (!catalogBranch) return null

  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('get_branch_by_slug', { p_slug: slug })

    if (error) {
      console.error('[BRANCH SERVICE] getBranchBySlug RPC error:', error.message)
      return catalogBranch
    }

    if (!data || (data as DbBranchRow[]).length === 0) {
      return catalogBranch
    }

    return rowToBranch((data as DbBranchRow[])[0])
  } catch (err) {
    console.error('[BRANCH SERVICE] getBranchBySlug unexpected error:', err)
    return catalogBranch
  }
}

// ============================================================================
// PURE HELPERS — re-exported from @/lib/branch-utils
// ============================================================================
// isBranchOpen() and toBranchSnapshot() are pure functions and live in
// @/lib/branch-utils so they can be imported by Client Components without
// pulling in server-only modules (next/headers).
//
// They are re-exported above for backward compatibility with server code
// that imports them from this service.
