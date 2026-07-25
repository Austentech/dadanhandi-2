'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client-browser'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/auth'

interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
}

const unauthenticatedState: AuthState = {
  user: null,
  profile: null,
  isLoading: false,
  isAuthenticated: false,
}

export function useAuth() {
  const configured = isSupabaseConfigured()
  const [state, setState] = useState<AuthState>(
    configured
      ? { user: null, profile: null, isLoading: true, isAuthenticated: false }
      : unauthenticatedState
  )

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    if (!configured) return

    supabaseRef.current = createClient()
    const supabase = supabaseRef.current

    if (!supabase) return

    const fetchProfile = async (userId: string): Promise<Profile | null> => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', userId)
          .single()
        return data as Profile | null
      } catch {
        return null
      }
    }

    let mounted = true

    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!mounted) return

        if (user) {
          const profile = await fetchProfile(user.id)
          if (!mounted) return
          setState({
            user,
            profile,
            isLoading: false,
            isAuthenticated: true,
          })
        } else {
          setState(unauthenticatedState)
        }
      } catch {
        if (mounted) setState(unauthenticatedState)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (!mounted) return

          setState({
            user: session.user,
            profile,
            isLoading: false,
            isAuthenticated: true,
          })
        } else if (event === 'SIGNED_OUT') {
          setState(unauthenticatedState)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current
    if (supabase) {
      await supabase.auth.signOut()
    }
    setState(unauthenticatedState)
  }, [])

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    const supabase = supabaseRef.current
    if (!supabase) return

    const origin = window.location.origin
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(redirectTo || '/')}`,
      },
    })
  }, [])

  return {
    ...state,
    signOut,
    signInWithGoogle,
  }
}
