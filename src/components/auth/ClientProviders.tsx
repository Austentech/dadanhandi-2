'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client-browser'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  // Handle Supabase recovery hash fragments (from password reset email links)
  // When Supabase's email template uses {{ .ConfirmationURL }}, the reset link
  // lands on the SITE_URL with hash fragment tokens (#access_token=xxx&type=recovery).
  // Hash fragments are NOT sent to the server, so the callback route is never hit.
  // This effect detects the recovery token and redirects to the reset-password page.
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      // Supabase browser client automatically processes hash fragment tokens
      // and sets the session. We just need to redirect to the reset-password page.
      const supabase = createClient()
      if (supabase) {
        // Clean up the hash so it doesn't linger in the URL
        window.location.hash = ''
        // Give Supabase a moment to process the token, then redirect
        router.push('/reset-password')
      }
    }
  }, [router])

  return <AuthProvider>{children}</AuthProvider>
}
