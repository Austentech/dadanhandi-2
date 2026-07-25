'use client'

import { useEffect } from 'react'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client-browser'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  // Handle Supabase recovery hash fragments from password reset email links.
  //
  // ROOT CAUSE: Supabase's default email template uses {{ .ConfirmationURL }}
  // which generates hash fragment URLs like:
  //   https://site.com/#access_token=xxx&expires_in=3600&refresh_token=yyy&type=recovery
  //
  // Hash fragments (#xxx) are NEVER sent to the server. So the /api/auth/callback
  // route is never hit. The user just lands on the home page.
  //
  // FIX: Detect the hash fragment on the client side, let the Supabase browser
  // client process the tokens (which sets session cookies), then redirect to
  // /reset-password using window.location.replace (full page navigation).
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const hash = window.location.hash
    if (!hash || !hash.includes('type=recovery')) return

    // Already on reset-password page? Don't redirect again
    if (window.location.pathname === '/reset-password') {
      // Just clean the hash — the page will handle the rest
      window.location.hash = ''
      return
    }

    // Create Supabase client — this triggers automatic hash fragment processing.
    // The browser client reads #access_token and #refresh_token from the URL,
    // stores them in cookies via document.cookie, and establishes the session.
    const supabase = createClient()
    if (!supabase) return

    // Wait for token processing to complete, then do a full page redirect.
    // Using window.location.replace (not router.push) ensures:
    // - Full page reload (cookies are sent with the request)
    // - The /reset-password API route can read session cookies
    // - No client-side routing issues
    setTimeout(() => {
      window.location.replace('/reset-password')
    }, 800)
  }, [])

  return <AuthProvider>{children}</AuthProvider>
}
