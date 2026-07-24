import { createServerClient } from '@/lib/supabase/client-server'
import type { Profile, ProfileInsert, ProfileUpdate } from '@/types/auth'

/**
 * Get profile by auth_user_id.
 * Uses SECURITY DEFINER RPC to bypass RLS (works in API routes without user session).
 */
export async function getProfileByAuthUserId(authUserId: string): Promise<Profile | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('get_profile_by_auth_id', {
    p_auth_user_id: authUserId,
  })

  if (error || !data) return null
  return data as Profile
}

/**
 * Get profile by email.
 * Uses SECURITY DEFINER RPC to bypass RLS (works in API routes without user session).
 */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('get_profile_by_email_fn', {
    p_email: email.toLowerCase(),
  })

  if (error || !data) return null
  return data as Profile
}

/**
 * Create or update a profile.
 * Uses SECURITY DEFINER RPC to bypass RLS (works in API routes without user session).
 * If a profile already exists for the auth_user_id, it updates instead of failing.
 */
export async function createProfile(profileData: ProfileInsert): Promise<Profile> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('upsert_profile', {
    p_auth_user_id: profileData.auth_user_id,
    p_email: profileData.email || '',
    p_full_name: profileData.full_name || '',
    p_whatsapp_number: profileData.whatsapp_number || null,
    p_mobile_number: profileData.mobile_number || null,
    p_area: profileData.area || null,
    p_city: profileData.city || null,
    p_pincode: profileData.pincode || null,
    p_avatar_url: profileData.avatar_url || null,
    p_provider: profileData.provider || 'email',
    p_profile_completed: profileData.profile_completed ?? false,
  })

  if (error) throw new Error('Failed to create profile: ' + error.message)
  return data as Profile
}

/**
 * Update a profile.
 * Uses SECURITY DEFINER RPC to bypass RLS (works in API routes without user session).
 */
export async function updateProfile(
  authUserId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  // First get existing profile to merge values
  const existing = await getProfileByAuthUserId(authUserId)
  if (!existing) throw new Error('Profile not found')

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('upsert_profile', {
    p_auth_user_id: authUserId,
    p_email: existing.email,
    p_full_name: updates.full_name ?? existing.full_name,
    p_whatsapp_number: updates.whatsapp_number !== undefined ? updates.whatsapp_number : existing.whatsapp_number,
    p_mobile_number: updates.mobile_number !== undefined ? updates.mobile_number : existing.mobile_number,
    p_area: updates.area !== undefined ? updates.area : existing.area,
    p_city: updates.city !== undefined ? updates.city : existing.city,
    p_pincode: updates.pincode !== undefined ? updates.pincode : existing.pincode,
    p_avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : existing.avatar_url,
    p_provider: existing.provider,
    p_profile_completed: updates.profile_completed ?? existing.profile_completed,
  })

  if (error) throw new Error('Failed to update profile: ' + error.message)
  return data as Profile
}

export async function isProfileComplete(authUserId: string): Promise<boolean> {
  const profile = await getProfileByAuthUserId(authUserId)
  if (!profile) return false
  return profile.profile_completed
}
