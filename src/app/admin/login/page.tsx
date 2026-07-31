'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminStore } from '@/store/admin-store'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { ADMIN_CONFIG } from '@/lib/admin/config'

// ---------------------------------------------------------------------------
// Strict email validation — must match real email format
// ---------------------------------------------------------------------------
function isValidEmail(email: string): boolean {
  const cleaned = email.trim().toLowerCase()
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(cleaned) && cleaned.length <= 254
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
export default function AdminLoginPage() {
  const router = useRouter()
  const inputRef0 = useRef<HTMLInputElement>(null)

  const {
    otpEmail,
    otpSent,
    isSendingOtp,
    otpError,
    otpMessage,
    isVerifyingOtp,
    otpDigits,
    isAuthenticated,
    isLoadingAuth,
    setOtpEmail,
    sendOtp,
    setOtpDigits,
    verifyOtp,
    checkSession,
  } = useAdminStore()

  // Track resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0)

  // Local email error for client-side validation
  const [emailClientError, setEmailClientError] = useState<string | null>(null)

  // Check session on mount — redirect if already authed
  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.replace('/admin/dashboard')
    }
  }, [isLoadingAuth, isAuthenticated, router])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Auto-focus first OTP input on step 2
  useEffect(() => {
    if (otpSent && inputRef0.current) {
      inputRef0.current.focus()
    }
  }, [otpSent])

  // ---- Step 1: Send OTP ----
  const handleSendOtp = useCallback(async () => {
    const trimmed = otpEmail.trim()

    if (!trimmed) {
      setEmailClientError('Please enter your email address.')
      return
    }

    // Reject dangerous characters immediately
    if (/[;\'"\\<>]/.test(trimmed)) {
      setEmailClientError('Invalid characters in email.')
      return
    }

    if (!isValidEmail(trimmed)) {
      setEmailClientError('Please enter a valid email address.')
      return
    }

    setEmailClientError(null)
    setOtpEmail(trimmed.toLowerCase())

    // Small delay to let store update
    const emailToSend = trimmed.toLowerCase()
    const success = await sendOtpWithEmail(emailToSend)
    if (success) {
      setResendCooldown(30)
    }
  }, [otpEmail, setOtpEmail])

  // Helper to send OTP with the sanitized email
  const sendOtpWithEmail = useCallback(async (email: string) => {
    useAdminStore.setState({ isSendingOtp: true, otpError: null, otpMessage: null })
    try {
      const res = await fetch('/api/admin/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await res.json()
      if (result.success) {
        useAdminStore.setState({ isSendingOtp: false, otpSent: true, otpMessage: result.message, otpEmail: email })
        return true
      }
      useAdminStore.setState({ isSendingOtp: false, otpError: result.message })
      return false
    } catch {
      useAdminStore.setState({ isSendingOtp: false, otpError: 'Network error. Please try again.' })
      return false
    }
  }, [])

  // ---- Step 2: Verify OTP ----
  const handleVerify = useCallback(async () => {
    const success = await verifyOtp()
    if (success) {
      router.push('/admin/dashboard')
    }
  }, [verifyOtp, router])

  // ---- OTP Input Handlers (ALPHANUMERIC — A-Z and 2-9) ----
  const VALID_OTP_CHARS = new Set(ADMIN_CONFIG.OTP_ALPHABET.split(''))

  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      const raw = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(-1)
      const char = raw && VALID_OTP_CHARS.has(raw) ? raw : ''
      const newDigits = [...otpDigits]
      newDigits[index] = char
      setOtpDigits(newDigits)

      // Auto-advance to next input
      if (char && index < ADMIN_CONFIG.OTP_LENGTH - 1) {
        const nextInput = document.getElementById(`admin-otp-${index + 1}`)
        nextInput?.focus()
      }
    },
    [otpDigits, setOtpDigits],
  )

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
        const prevInput = document.getElementById(`admin-otp-${index - 1}`)
        prevInput?.focus()
      }
    },
    [otpDigits],
  )

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pasted = e.clipboardData
        .getData('text')
        .toUpperCase()
        .replace(/[^A-Z2-9]/g, '')
        .slice(0, ADMIN_CONFIG.OTP_LENGTH)
      if (pasted.length === 0) return
      const newDigits = [...otpDigits]
      for (let i = 0; i < ADMIN_CONFIG.OTP_LENGTH; i++) {
        newDigits[i] = VALID_OTP_CHARS.has(pasted[i]) ? pasted[i] : ''
      }
      setOtpDigits(newDigits)
      const focusIdx = Math.min(pasted.length, ADMIN_CONFIG.OTP_LENGTH - 1)
      const el = document.getElementById(`admin-otp-${focusIdx}`)
      el?.focus()
    },
    [otpDigits, setOtpDigits],
  )

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return
    const success = await sendOtpWithEmail(useAdminStore.getState().otpEmail)
    if (success) {
      setResendCooldown(30)
    }
  }, [resendCooldown, sendOtpWithEmail])

  const handleBackToEmail = useCallback(() => {
    useAdminStore.setState({
      otpSent: false,
      otpError: null,
      otpMessage: null,
      otpDigits: ['', '', '', '', '', ''],
    })
    setEmailClientError(null)
  }, [])

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSendOtp()
      }
    },
    [handleSendOtp],
  )

  const handleOtpInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleVerify()
      }
    },
    [handleVerify],
  )

  // Don't render login form if already authenticated
  if (isLoadingAuth) {
    return (
      <div className="admin-auth-loading">
        <div className="admin-auth-spinner" />
        <span className="admin-auth-loading-text">Loading...</span>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="admin-auth-loading">
        <div className="admin-auth-spinner" />
        <span className="admin-auth-loading-text">Redirecting...</span>
      </div>
    )
  }

  const displayError = emailClientError || otpError

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Logo */}
        <div className="admin-login-logo">
          <ShieldCheck size={32} color="#3b82f6" style={{ marginBottom: 8 }} />
          <div className="admin-login-logo-title">DH Admin</div>
          <div className="admin-login-logo-sub">Dadan Handi Management Portal</div>
        </div>

        {/* ===== Step 2: OTP Verification ===== */}
        {otpSent ? (
          <>
            <button className="admin-login-back" onClick={handleBackToEmail}>
              <ArrowLeft size={16} /> Back
            </button>

            <div className="admin-login-heading">Verify Code</div>
            <div className="admin-login-desc">
              Enter the {ADMIN_CONFIG.OTP_LENGTH}-character code sent to{' '}
              <strong>{otpEmail}</strong>
            </div>

            {/* OTP Inputs — ALPHANUMERIC */}
            <div className="admin-otp-container" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`admin-otp-${idx}`}
                  ref={idx === 0 ? inputRef0 : undefined}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  className={`admin-otp-input ${otpError ? 'error' : ''}`}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    handleOtpKeyDown(idx, e)
                    handleOtpInputKeyDown(e)
                  }}
                  aria-label={`Character ${idx + 1}`}
                />
              ))}
            </div>

            {otpError && <div className="admin-login-error">{otpError}</div>}
            {!otpError && otpMessage && <div className="admin-login-message">{otpMessage}</div>}
            {!otpError && !otpMessage && <div style={{ minHeight: 20 }} />}

            <button
              className="admin-login-btn"
              onClick={handleVerify}
              disabled={isVerifyingOtp || otpDigits.join('').length < ADMIN_CONFIG.OTP_LENGTH}
            >
              {isVerifyingOtp && <span className="admin-login-spinner" />}
              {isVerifyingOtp ? 'Verifying...' : 'Verify Code'}
            </button>

            <div className="admin-login-resend">
              {resendCooldown > 0 ? (
                <>Resend code in {resendCooldown}s</>
              ) : (
                <>
                  Didn&apos;t receive the code?{' '}
                  <button onClick={handleResend}>Resend</button>
                </>
              )}
            </div>
          </>
        ) : (
          /* ===== Step 1: Email Input ===== */
          <>
            <div className="admin-login-heading">Welcome back</div>
            <div className="admin-login-desc">
              Enter your admin email to receive a login code.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="admin-email" className="admin-login-label">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                className={`admin-login-input ${displayError ? 'error' : ''}`}
                placeholder="admin@dadanhandi.com"
                value={otpEmail}
                onChange={(e) => {
                  setEmailClientError(null)
                  setOtpEmail(e.target.value)
                }}
                onKeyDown={(e) => {
                  handleEmailKeyDown(e)
                }}
                autoFocus
                autoComplete="email"
              />
            </div>

            {displayError && <div className="admin-login-error">{displayError}</div>}
            {!displayError && otpMessage && <div className="admin-login-message">{otpMessage}</div>}
            {!displayError && !otpMessage && <div style={{ minHeight: 20 }} />}

            <button
              className="admin-login-btn"
              onClick={handleSendOtp}
              disabled={isSendingOtp || !otpEmail.trim()}
            >
              {isSendingOtp && <span className="admin-login-spinner" />}
              {isSendingOtp ? 'Sending...' : 'Send Code'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
