'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminStore } from '@/store/admin-store'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { ADMIN_CONFIG } from '@/lib/admin/config'

const OTP_LENGTH = ADMIN_CONFIG.OTP_LENGTH
const VALID_OTP_RE = /^[A-Z2-9]+$/

// ---------------------------------------------------------------------------
// Strict email validation
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
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  const {
    otpEmail,
    otpSent,
    isSendingOtp,
    otpError,
    otpMessage,
    isVerifyingOtp,
    isAuthenticated,
    isLoadingAuth,
    setOtpEmail,
    verifyOtp: storeVerifyOtp,
    checkSession,
  } = useAdminStore()

  // Local OTP value — single string, one real input
  const [otpValue, setOtpValue] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [emailClientError, setEmailClientError] = useState<string | null>(null)

  // Check session on mount
  useEffect(() => { checkSession() }, [checkSession])

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) router.replace('/admin/dashboard')
  }, [isLoadingAuth, isAuthenticated, router])

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // Auto-focus hidden input when OTP step appears
  useEffect(() => {
    if (otpSent) {
      setOtpValue('')
      setTimeout(() => hiddenInputRef.current?.focus(), 100)
    }
  }, [otpSent])

  // ---- Send OTP ----
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

  const handleSendOtp = useCallback(async () => {
    const trimmed = otpEmail.trim()
    if (!trimmed) { setEmailClientError('Please enter your email address.'); return }
    if (/[;\'"\\<>]/.test(trimmed)) { setEmailClientError('Invalid characters in email.'); return }
    if (!isValidEmail(trimmed)) { setEmailClientError('Please enter a valid email address.'); return }
    setEmailClientError(null)
    const email = trimmed.toLowerCase()
    setOtpEmail(email)
    if (await sendOtpWithEmail(email)) setResendCooldown(30)
  }, [otpEmail, setOtpEmail, sendOtpWithEmail])

  // ---- Verify OTP ----
  const handleVerify = useCallback(async () => {
    if (otpValue.length !== OTP_LENGTH) {
      useAdminStore.setState({ otpError: `Please enter all ${OTP_LENGTH} characters.` })
      return
    }
    if (!VALID_OTP_RE.test(otpValue)) {
      useAdminStore.setState({ otpError: 'Code contains invalid characters.' })
      return
    }
    useAdminStore.setState({ isVerifyingOtp: true, otpError: null })
    try {
      const res = await fetch('/api/admin/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, otp: otpValue }),
      })
      const result = await res.json()
      if (result.success) {
        useAdminStore.setState({ isVerifyingOtp: false, isAuthenticated: true })
        router.push('/admin/dashboard')
      } else {
        useAdminStore.setState({ isVerifyingOtp: false, otpError: result.message })
      }
    } catch {
      useAdminStore.setState({ isVerifyingOtp: false, otpError: 'Network error. Please try again.' })
    }
  }, [otpValue, otpEmail, router])

  // ---- Hidden input change handler ----
  const handleHiddenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, OTP_LENGTH)
    setOtpValue(cleaned)
    useAdminStore.setState({ otpError: null })
  }, [])

  const handleHiddenKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && otpValue.length === OTP_LENGTH) {
      handleVerify()
    }
  }, [otpValue, handleVerify])

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return
    if (await sendOtpWithEmail(useAdminStore.getState().otpEmail)) setResendCooldown(30)
  }, [resendCooldown, sendOtpWithEmail])

  const handleBackToEmail = useCallback(() => {
    useAdminStore.setState({ otpSent: false, otpError: null, otpMessage: null })
    setOtpValue('')
    setEmailClientError(null)
  }, [])

  // ---- Loading / Auth states ----
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
        <div className="admin-login-logo">
          <ShieldCheck size={32} color="#3b82f6" style={{ marginBottom: 8 }} />
          <div className="admin-login-logo-title">DH Admin</div>
          <div className="admin-login-logo-sub">Dadan Handi Management Portal</div>
        </div>

        {otpSent ? (
          /* ===== OTP Step ===== */
          <>
            <button className="admin-login-back" onClick={handleBackToEmail}>
              <ArrowLeft size={16} /> Back
            </button>

            <div className="admin-login-heading">Verify Code</div>
            <div className="admin-login-desc">
              Enter the {OTP_LENGTH}-character code sent to <strong>{otpEmail}</strong>
            </div>

            {/* Visual OTP boxes — clicking focuses the hidden input */}
            <div
              className="admin-otp-container"
              onClick={() => hiddenInputRef.current?.focus()}
            >
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={`admin-otp-box ${otpValue[i] ? 'filled' : ''} ${otpError ? 'error' : ''}`}
                >
                  {otpValue[i] || ''}
                </div>
              ))}

              {/* Single real input — hidden but focusable */}
              <input
                ref={hiddenInputRef}
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="one-time-code"
                value={otpValue}
                onChange={handleHiddenChange}
                onKeyDown={handleHiddenKeyDown}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: 1,
                  height: 1,
                  padding: 0,
                  border: 0,
                  pointerEvents: 'none',
                }}
                aria-label="Enter verification code"
              />
            </div>

            {otpError && <div className="admin-login-error">{otpError}</div>}
            {!otpError && otpMessage && <div className="admin-login-message">{otpMessage}</div>}
            {!otpError && !otpMessage && <div style={{ minHeight: 20 }} />}

            <button
              className="admin-login-btn"
              onClick={handleVerify}
              disabled={isVerifyingOtp || otpValue.length < OTP_LENGTH}
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
          /* ===== Email Step ===== */
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp() }}
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
