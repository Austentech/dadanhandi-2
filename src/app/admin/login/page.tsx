'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminStore } from '@/store/admin-store'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

// ---------------------------------------------------------------------------
// Email validation helper
// ---------------------------------------------------------------------------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
    if (!isValidEmail(otpEmail)) {
      useAdminStore.setState({ otpError: 'Please enter a valid email address.' })
      return
    }
    const success = await sendOtp()
    if (success) {
      setResendCooldown(30)
    }
  }, [otpEmail, sendOtp])

  // ---- Step 2: Verify OTP ----
  const handleVerify = useCallback(async () => {
    const success = await verifyOtp()
    if (success) {
      router.push('/admin/dashboard')
    }
  }, [verifyOtp, router])

  // ---- OTP Input Handlers ----
  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1)
      const newDigits = [...otpDigits]
      newDigits[index] = digit
      setOtpDigits(newDigits)

      // Auto-advance to next input
      if (digit && index < 5) {
        const nextInput = document.getElementById(`admin-otp-${index + 1}`)
        nextInput?.focus()
      }
    },
    [otpDigits, setOtpDigits],
  )

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
        // Move focus back
        const prevInput = document.getElementById(`admin-otp-${index - 1}`)
        prevInput?.focus()
      }
    },
    [otpDigits],
  )

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      if (pasted.length === 0) return
      const newDigits = [...otpDigits]
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || ''
      }
      setOtpDigits(newDigits)
      // Focus last filled or next empty
      const focusIdx = Math.min(pasted.length, 5)
      const el = document.getElementById(`admin-otp-${focusIdx}`)
      el?.focus()
    },
    [otpDigits, setOtpDigits],
  )

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return
    const success = await sendOtp()
    if (success) {
      setResendCooldown(30)
    }
  }, [resendCooldown, sendOtp])

  const handleBackToEmail = useCallback(() => {
    useAdminStore.setState({
      otpSent: false,
      otpError: null,
      otpMessage: null,
      otpDigits: ['', '', '', '', '', ''],
    })
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

            <div className="admin-login-heading">Verify OTP</div>
            <div className="admin-login-desc">
              Enter the 6-digit code sent to <strong>{otpEmail}</strong>
            </div>

            {/* OTP Inputs */}
            <div className="admin-otp-container" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`admin-otp-${idx}`}
                  ref={idx === 0 ? inputRef0 : undefined}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  className={`admin-otp-input ${otpError ? 'error' : ''}`}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    handleOtpKeyDown(idx, e)
                    handleOtpInputKeyDown(e)
                  }}
                  aria-label={`Digit ${idx + 1}`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {otpError && <div className="admin-login-error">{otpError}</div>}
            {!otpError && otpMessage && <div className="admin-login-message">{otpMessage}</div>}
            {!otpError && !otpMessage && <div style={{ minHeight: 20 }} />}

            <button
              className="admin-login-btn"
              onClick={handleVerify}
              disabled={isVerifyingOtp || otpDigits.join('').length < 6}
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
              Enter your admin email to receive a one-time login code.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="admin-email" className="admin-login-label">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                className={`admin-login-input ${otpError ? 'error' : ''}`}
                placeholder="admin@dadanhandi.com"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                autoFocus
                autoComplete="email"
              />
            </div>

            {otpError && <div className="admin-login-error">{otpError}</div>}
            {!otpError && otpMessage && <div className="admin-login-message">{otpMessage}</div>}
            {!otpError && !otpMessage && <div style={{ minHeight: 20 }} />}

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
