'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client-browser'

function EmailVerifiedBanner() {
  const searchParams = useSearchParams()
  const showVerified = searchParams.get('email_verified') === 'true'

  useEffect(() => {
    if (!showVerified) return

    // Show a styled success notification that auto-dismisses
    const banner = document.createElement('div')
    banner.id = 'email-verified-toast'
    banner.innerHTML = `
      <div style="position:fixed; top:80px; left:50%; transform:translateX(-50%); z-index:11000;
        background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:14px 24px;
        box-shadow:0 8px 32px rgba(0,0,0,0.15); display:flex; align-items:center; gap:10px;
        max-width:90vw; animation:toast-slide-down 0.4s ease; font-family:var(--font-nunito),sans-serif;">
        <i class="fas fa-check-circle" style="color:#059669; font-size:1.2rem; flex-shrink:0;"></i>
        <div>
          <div style="color:#065f46; font-weight:700; font-size:0.92rem;">Email Verified Successfully!</div>
          <div style="color:#047857; font-size:0.8rem; margin-top:2px;">You can now log in with your email and password.</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#065f46; cursor:pointer; font-size:1rem; padding:4px; margin-left:8px; flex-shrink:0;">&times;</button>
      </div>
      <style>
        @keyframes toast-slide-down {
          from { opacity:0; transform:translateX(-50%) translateY(-20px); }
          to { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      </style>
    `
    document.body.appendChild(banner)

    // Auto-dismiss after 6 seconds
    const timer = setTimeout(() => {
      const el = document.getElementById('email-verified-toast')
      if (el) el.remove()
    }, 6000)

    // Clean up URL params without page reload
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('email_verified')
    window.history.replaceState({}, '', cleanUrl.toString())

    return () => {
      clearTimeout(timer)
      const el = document.getElementById('email-verified-toast')
      if (el) el.remove()
    }
  }, [showVerified])

  return null
}

function HashFragmentHandler({ children }: { children: React.ReactNode }) {
  // Handle Supabase hash fragments from email links (recovery & signup).
  //
  // Supabase email templates may generate hash fragment URLs like:
  //   Password reset: #access_token=xxx&...&type=recovery
  //   Email verification: #access_token=xxx&...&type=signup
  //
  // Hash fragments (#xxx) are NEVER sent to the server, so the /api/auth/callback
  // route is never hit for these. The Supabase browser client processes the tokens
  // automatically, establishing the session via cookies.
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) return

    const hashType = new URLSearchParams(hash.substring(1)).get('type')

    // Already on the target page? Don't redirect.
    if (hashType === 'recovery' && window.location.pathname === '/reset-password') {
      window.location.hash = ''
      return
    }

    // Create Supabase client — this triggers automatic hash fragment processing.
    // The browser client reads #access_token and #refresh_token from the URL,
    // stores them in cookies via document.cookie, and establishes the session.
    const supabase = createClient()
    if (!supabase) return

    if (hashType === 'recovery') {
      // Password recovery: redirect to reset-password page after token processing
      setTimeout(() => {
        window.location.replace('/reset-password')
      }, 800)
    } else if (hashType === 'signup') {
      // Email verification via hash fragment:
      // After Supabase processes the token, the user's email is confirmed.
      // Redirect to home with success flag.
      setTimeout(() => {
        window.location.replace('/?email_verified=true')
      }, 800)
    }
  }, [])

  return <>{children}</>
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HashFragmentHandler>
        <Suspense fallback={null}>
          <EmailVerifiedBanner />
        </Suspense>
        {children}
      </HashFragmentHandler>
    </AuthProvider>
  )
}
