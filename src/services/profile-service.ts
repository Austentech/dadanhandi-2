import { createServerClient } from '@/lib/supabase/client-server'
import type { Profile, ProfileInsert, ProfileUpdate } from '@/types/auth'

export async function getProfileByAuthUserId(authUserId: string): Promise<Profile | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) return null
  return data as Profile
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error) return null
  return data as Profile
}

export async function createProfile(profileData: ProfileInsert): Promise<Profile> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      ...profileData,
      email: profileData.email?.toLowerCase(),
    })
    .select()
    .single()

  if (error) throw new Error('Failed to create profile')
  return data as Profile
}

export async function updateProfile(
  authUserId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('auth_user_id', authUserId)
    .select()
    .single()

  if (error) throw new Error('Failed to update profile')
  return data as Profile
}

export async function isProfileComplete(authUserId: string): Promise<boolean> {
  const profile = await getProfileByAuthUserId(authUserId)
  if (!profile) return false
  return profile.profile_completed
}
