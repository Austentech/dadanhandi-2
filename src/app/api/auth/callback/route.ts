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

      // Get user info for deciding where to redirect
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if this was an email verification (not Google OAuth)
        // Google OAuth users have 'provider' in their app_metadata or identities
        const isGoogleUser = user.app_metadata?.provider === 'google' ||
          (user.app_metadata?.providers && user.app_metadata.providers.includes('google'))

        if (isGoogleUser) {
          // Google OAuth — check profile completion
          try {
            const profile = await getProfileByAuthUserId(user.id)
            if (profile && !profile.profile_completed) {
              return NextResponse.redirect(`${origin}/auth/complete-profile`)
            }
          } catch {
            // Profile check failed — continue with normal redirect
          }
        } else {
          // Email/password user — this callback is likely from email verification
          // Check if email was just confirmed
          const emailConfirmed = user.email_confirmed_at !== null &&
            user.confirmed_at !== null

          if (emailConfirmed) {
            // Email just verified — redirect to home with success flag
            const redirectTo = next === '/' ? '/?email_verified=true' : `${next}?email_verified=true`
            return NextResponse.redirect(`${origin}${redirectTo}`)
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('[AUTH CALLBACK] exchangeCodeForSession error:', error.message)
    }
  }

  // Error — redirect to reset-password with error flag
  return NextResponse.redirect(`${origin}/reset-password?auth=error`)
}
