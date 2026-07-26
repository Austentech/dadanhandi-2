/**
 * useSessionManager
 * -----------------
 * Enforces session lifetime rules:
 *
 * 1. PER-BROWSER-SESSION ISOLATION (fixes "logged in after deploy/reopen"):
 *    When the user closes ALL browser tabs/windows, the OS clears sessionStorage.
 *    On next visit, we detect the missing marker and FORCE SIGN OUT the Supabase
 *    session. This ensures a fresh deploy or browser restart always starts logged-out.
 *
 *    Why this works:
 *      - Supabase stores auth tokens in cookies that persist across browser restarts
 *        (intentional — for "remember me" behavior).
 *      - We DON'T want that behavior for this app. So we use sessionStorage as a
 *        "live session" marker. If the marker is missing on app load, we sign out.
 *
 * 2. IDLE TIMEOUT (fixes "session destroyed after 30 min inactivity"):
 *    Tracks last-activity timestamp in sessionStorage. Every user interaction
 *    (mouse, keyboard, scroll, touch, click) updates it. A 60-second interval
 *    checks: if (now - lastActivity) > IDLE_TIMEOUT_MS, force sign-out and
 *    show a toast notification.
 *
 * 3. TAB VISIBILITY:
 *    When the tab is hidden (user switched away), we keep the timer running.
 *    When the tab is closed entirely, sessionStorage is cleared by the browser,
 *    which triggers Rule #1 on next visit.
 *
 * Configuration:
 *   - IDLE_TIMEOUT_MS: 30 minutes (30 * 60 * 1000)
 *   - CHECK_INTERVAL_MS: 60 seconds
 *   - ACTIVITY_EVENTS: mousemove, mousedown, keydown, scroll, touchstart, click
 *
 * Usage:
 *   Called ONCE from inside AuthProvider (so it has access to auth state).
 */

'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useToastStore } from '@/store/toast-store'

// ----------------------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------------------
const IDLE_TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000     // check every 1 minute
const CHECK_INTERVAL_BG_MS = 30 * 1000  // check every 30s when tab hidden (more aggressive)

// sessionStorage keys
const KEY_SESSION_MARKER = 'dadan_session_active'    // '1' if session is "live" in this tab cycle
const KEY_LAST_ACTIVITY = 'dadan_last_activity'      // epoch ms of last user interaction

// Events that count as "user activity"
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
]

export function useSessionManager(): void {
  const { isAuthenticated, signOut } = useAuth()
  const pushToast = useToastStore((s) => s.pushToast)
  const signedOutDueToIdleRef = useRef(false)

  // --------------------------------------------------------------------------
  // RULE 1: Per-browser-session isolation
  // On first mount, check if sessionStorage has our "live session" marker.
  // If not, this is a fresh browser session (or first visit after deploy) —
  // force sign-out any lingering Supabase cookie-based session.
  //
  // IMPORTANT: We can't check isAuthenticated here because on first mount,
  // useAuth() is still loading (isAuthenticated=false initially). Instead,
  // we set the marker NOW, and use a separate effect (Rule 1b) to sign out
  // when isAuthenticated becomes true (i.e., Supabase loaded a session).
  // --------------------------------------------------------------------------
  const initialCheckDoneRef = useRef(false)

  useEffect(() => {
    if (initialCheckDoneRef.current) return
    initialCheckDoneRef.current = true

    try {
      const marker = window.sessionStorage.getItem(KEY_SESSION_MARKER)
      if (!marker) {
        // Fresh browser session — mark it as live AND set the "just started"
        // flag so Rule 1b knows to force sign-out any lingering Supabase session.
        window.sessionStorage.setItem(KEY_SESSION_MARKER, '1')
        window.sessionStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()))
        window.sessionStorage.setItem('dadan_session_just_started', '1')
      } else {
        // Marker exists — make sure last-activity is initialized
        const last = window.sessionStorage.getItem(KEY_LAST_ACTIVITY)
        if (!last) {
          window.sessionStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()))
        }
      }
    } catch {
      // sessionStorage might be disabled (private browsing) — skip rule
    }
  }, [])

  // --------------------------------------------------------------------------
  // RULE 1b: If we just set the session marker (fresh browser session) AND
  // Supabase loaded an authenticated user, force sign-out. This runs whenever
  // isAuthenticated changes — but only acts ONCE per fresh-session check.
  // --------------------------------------------------------------------------
  const forcedSignOutRef = useRef(false)

  useEffect(() => {
    if (forcedSignOutRef.current) return
    if (!isAuthenticated) return

    try {
      const marker = window.sessionStorage.getItem(KEY_SESSION_MARKER)
      // If marker exists, session was already "live" — don't force sign out.
      // If marker is missing... wait, Rule 1 already set it. So we use a
      // DIFFERENT key to track "did we just start a fresh session?"
      // Approach: when Rule 1 sets the marker, it also sets a "fresh" flag.
      // This effect checks that flag and signs out if set, then clears the flag.
      const freshFlag = window.sessionStorage.getItem('dadan_session_just_started')
      if (freshFlag === '1') {
        window.sessionStorage.removeItem('dadan_session_just_started')
        forcedSignOutRef.current = true
        signOut().catch(() => {})
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated, signOut])

  // --------------------------------------------------------------------------
  // RULE 2: Activity tracking — update last-activity timestamp on user events
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) return

    let lastWrite = 0
    const updateActivity = () => {
      const now = Date.now()
      // Throttle writes to sessionStorage (max once per 5s) to avoid perf hit
      if (now - lastWrite < 5000) return
      lastWrite = now
      try {
        window.sessionStorage.setItem(KEY_LAST_ACTIVITY, String(now))
      } catch {
        // ignore
      }
    }

    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, updateActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, updateActivity)
      })
    }
  }, [isAuthenticated])

  // --------------------------------------------------------------------------
  // RULE 3: Idle timeout — check periodically, sign out if exceeded
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) {
      signedOutDueToIdleRef.current = false
      return
    }

    const checkIdle = () => {
      try {
        const lastStr = window.sessionStorage.getItem(KEY_LAST_ACTIVITY)
        if (!lastStr) {
          // No activity recorded — initialize to now (user just authenticated)
          window.sessionStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()))
          return
        }
        const last = parseInt(lastStr, 10)
        const now = Date.now()
        const idleFor = now - last

        if (idleFor >= IDLE_TIMEOUT_MS && !signedOutDueToIdleRef.current) {
          signedOutDueToIdleRef.current = true
          // Show a toast BEFORE signing out (signOut clears state which
          // might unmount toast — but ToastCenter is global so it survives)
          pushToast({
            type: 'info',
            title: 'Session expired',
            message: 'You have been logged out after 30 minutes of inactivity. Please log in again.',
            durationMs: 7000,
          })
          // Small delay so the toast appears before any UI changes
          setTimeout(() => {
            signOut().catch(() => {})
          }, 300)
        }
      } catch {
        // ignore
      }
    }

    // Use setInterval + visibilitychange to handle both visible and hidden tabs
    let intervalId: ReturnType<typeof setInterval>

    const startInterval = () => {
      const delay = document.hidden ? CHECK_INTERVAL_BG_MS : CHECK_INTERVAL_MS
      clearInterval(intervalId)
      intervalId = setInterval(checkIdle, delay)
    }

    startInterval()

    const handleVisibilityChange = () => {
      // When tab becomes visible again, immediately check idle
      if (!document.hidden) {
        checkIdle()
      }
      startInterval()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, signOut, pushToast])

  // --------------------------------------------------------------------------
  // RULE 4: Cross-tab sync — if user signs out in another tab, sign out here too
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY_SESSION_MARKER && e.newValue === null) {
        // Session was cleared in another tab (browser closing) — sign out here
        if (isAuthenticated) {
          signOut().catch(() => {})
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [isAuthenticated, signOut])
}
