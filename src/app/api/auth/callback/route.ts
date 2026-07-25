import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'
import { getProfileByAuthUserId } from '@/services/profile-service'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // For password recovery, always redirect to reset-password page
      if (next === '/reset-password') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      // For Google OAuth, check profile completion using RPC (bypasses RLS)
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        try {
          const profile = await getProfileByAuthUserId(user.id)
          if (profile && !profile.profile_completed) {
            return NextResponse.redirect(`${origin}/auth/complete-profile`)
          }
        } catch {
          // Profile check failed — continue with normal redirect
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Error — redirect with error flag
  return NextResponse.redirect(`${origin}/reset-password?auth=error`)
}
