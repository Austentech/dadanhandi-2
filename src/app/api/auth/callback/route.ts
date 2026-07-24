import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/client-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_completed')
          .eq('auth_user_id', user.id)
          .single()

        if (profile && !profile.profile_completed) {
          return NextResponse.redirect(`${origin}/auth/complete-profile`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?auth=error`)
}
