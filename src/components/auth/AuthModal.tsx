'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import OTPInput from '@/components/auth/OTPInput'
import { useAuth } from '@/hooks/use-auth'
import { emailSchema, registerSchema } from '@/lib/validation/schemas'
import type { AuthModalState } from '@/types/auth'

type FormData = {
  email: string
  full_name: string
  whatsapp_number: string
  mobile_number: string
  area: string
  city: string
  pincode: string
}

interface AuthModalProps {
  state: AuthModalState
  onClose: () => void
  onViewChange: (view: AuthModalState['view'], email?: string) => void
}

const COUNTDOWN_SECONDS = 60

export default function AuthModal({ state, onClose, onViewChange }: AuthModalProps) {
  const { signInWithGoogle } = useAuth()
  const [otpValue, setOtpValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [countdown, setCountdown] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // Reset state when view changes
  useEffect(() => {
    setOtpValue('')
    setMessage(null)
    setCountdown(0)
  }, [state.view])

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (state.isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [state.isOpen, onClose])

  // Click outside to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  // Login form
  const loginForm = useForm<{ email: string }>({
    resolver: zodResolver(
      registerSchema.pick({ email: true })
    ),
    defaultValues: { email: state.email || '' },
  })

  // Register form
  const registerForm = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      full_name: '',
      whatsapp_number: '',
      mobile_number: '',
      area: '',
      city: '',
      pincode: '',
    },
  })

  const handleSendOTP = useCallback(
    async (email: string) => {
      setLoading(true)
      setMessage(null)

      try {
        const response = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })

        const data = await response.json()

        if (data.success) {
          setMessage({ type: 'success', text: data.message })
          setCountdown(COUNTDOWN_SECONDS)
          onViewChange('otp', email)
        } else {
          setMessage({ type: 'error', text: data.message })
        }
      } catch {
        setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
      } finally {
        setLoading(false)
      }
    },
    [onViewChange]
  )

  const handleLoginSubmit = useCallback(
    loginForm.handleSubmit(async (values) => {
      await handleSendOTP(values.email)
    }),
    [loginForm, handleSendOTP]
  )

  const handleRegisterSubmit = useCallback(
    registerForm.handleSubmit(async (values) => {
      setLoading(true)
      setMessage(null)

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        const data = await response.json()

        if (data.success) {
          setMessage({ type: 'success', text: data.message })
          setCountdown(COUNTDOWN_SECONDS)
          onViewChange('otp', values.email)
        } else {
          setMessage({ type: 'error', text: data.message })
        }
      } catch {
        setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
      } finally {
        setLoading(false)
      }
    }),
    [registerForm, onViewChange]
  )

  const handleVerifyOTP = useCallback(async () => {
    if (otpValue.length !== 6 || !state.email) return

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.email, otp: otpValue }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        // Wait a moment then close and redirect
        setTimeout(() => {
          onClose()
          window.location.href = data.data?.redirectTo || '/'
        }, 800)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [otpValue, state.email, onClose])

  const handleResendOTP = useCallback(async () => {
    if (!state.email || countdown > 0) return
    await handleSendOTP(state.email)
  }, [state.email, countdown, handleSendOTP])

  const handleGoogleLogin = useCallback(() => {
    signInWithGoogle()
    onClose()
  }, [signInWithGoogle, onClose])

  if (!state.isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="auth-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
    >
      <div className="auth-modal">
        {/* Close button */}
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-times"></i>
        </button>

        {/* Header */}
        <div className="auth-modal-header">
          <div className="auth-modal-logo">
            <img src="/images/brand-logo.png" alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          </div>
          <h2 className="auth-modal-title">
            {state.view === 'login' && 'Welcome Back'}
            {state.view === 'register' && 'Create Account'}
            {state.view === 'otp' && 'Verify Email'}
          </h2>
          <p className="auth-modal-subtitle">
            {state.view === 'login' && 'Login with your email to continue'}
            {state.view === 'register' && 'Join us for the best handi experience'}
            {state.view === 'otp' && `Enter the OTP sent to ${state.email}`}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`auth-message auth-message-${message.type}`}>
            {message.text}
          </div>
        )}

        {/* LOGIN VIEW */}
        {state.view === 'login' && (
          <form onSubmit={handleLoginSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="auth-input"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                {...loginForm.register('email')}
              />
              {loginForm.formState.errors.email && (
                <p className="auth-error">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? <span className="auth-spinner"></span> : null}
              {loading ? 'Sending OTP...' : 'Continue'}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button type="button" className="auth-btn-google" onClick={handleGoogleLogin}>
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className="auth-switch-text">
              Don&apos;t have an account?{' '}
              <button type="button" className="auth-link" onClick={() => onViewChange('register')}>
                Create Account
              </button>
            </p>
          </form>
        )}

        {/* REGISTER VIEW */}
        {state.view === 'register' && (
          <form onSubmit={handleRegisterSubmit} noValidate className="auth-register-form">
            <div className="auth-field">
              <label htmlFor="reg-name" className="auth-label">Full Name *</label>
              <input
                id="reg-name"
                type="text"
                className="auth-input"
                placeholder="Your full name"
                autoComplete="name"
                autoFocus
                {...registerForm.register('full_name')}
              />
              {registerForm.formState.errors.full_name && (
                <p className="auth-error">{registerForm.formState.errors.full_name.message}</p>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="reg-email" className="auth-label">Email *</label>
              <input
                id="reg-email"
                type="email"
                className="auth-input"
                placeholder="your@email.com"
                autoComplete="email"
                {...registerForm.register('email')}
              />
              {registerForm.formState.errors.email && (
                <p className="auth-error">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="auth-field-row">
              <div className="auth-field">
                <label htmlFor="reg-whatsapp" className="auth-label">WhatsApp Number *</label>
                <input
                  id="reg-whatsapp"
                  type="tel"
                  className="auth-input"
                  placeholder="10-digit number"
                  autoComplete="tel"
                  {...registerForm.register('whatsapp_number')}
                />
                {registerForm.formState.errors.whatsapp_number && (
                  <p className="auth-error">{registerForm.formState.errors.whatsapp_number.message}</p>
                )}
              </div>
              <div className="auth-field">
                <label htmlFor="reg-mobile" className="auth-label">Mobile Number</label>
                <input
                  id="reg-mobile"
                  type="tel"
                  className="auth-input"
                  placeholder="Optional"
                  {...registerForm.register('mobile_number')}
                />
                {registerForm.formState.errors.mobile_number && (
                  <p className="auth-error">{registerForm.formState.errors.mobile_number.message}</p>
                )}
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-area" className="auth-label">Area *</label>
              <input
                id="reg-area"
                type="text"
                className="auth-input"
                placeholder="Your area / locality"
                {...registerForm.register('area')}
              />
              {registerForm.formState.errors.area && (
                <p className="auth-error">{registerForm.formState.errors.area.message}</p>
              )}
            </div>

            <div className="auth-field-row">
              <div className="auth-field">
                <label htmlFor="reg-city" className="auth-label">City *</label>
                <input
                  id="reg-city"
                  type="text"
                  className="auth-input"
                  placeholder="Your city"
                  {...registerForm.register('city')}
                />
                {registerForm.formState.errors.city && (
                  <p className="auth-error">{registerForm.formState.errors.city.message}</p>
                )}
              </div>
              <div className="auth-field">
                <label htmlFor="reg-pincode" className="auth-label">Pincode *</label>
                <input
                  id="reg-pincode"
                  type="text"
                  className="auth-input"
                  placeholder="6-digit pincode"
                  {...registerForm.register('pincode')}
                />
                {registerForm.formState.errors.pincode && (
                  <p className="auth-error">{registerForm.formState.errors.pincode.message}</p>
                )}
              </div>
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? <span className="auth-spinner"></span> : null}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <p className="auth-switch-text">
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => onViewChange('login')}>
                Login
              </button>
            </p>
          </form>
        )}

        {/* OTP VIEW */}
        {state.view === 'otp' && (
          <div className="auth-otp-section">
            <OTPInput
              length={6}
              value={otpValue}
              onChange={setOtpValue}
              error={message?.type === 'error'}
              disabled={loading}
              autoFocus
            />

            <button
              type="button"
              className="auth-btn-primary"
              onClick={handleVerifyOTP}
              disabled={otpValue.length !== 6 || loading}
              style={{ marginTop: 24 }}
            >
              {loading ? <span className="auth-spinner"></span> : null}
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="auth-resend-section">
              {countdown > 0 ? (
                <p className="auth-resend-text">
                  Resend OTP in <span className="auth-countdown">{countdown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  className="auth-link"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              )}

              <button
                type="button"
                className="auth-link"
                onClick={() => onViewChange('login', state.email)}
                style={{ marginTop: 8 }}
              >
                Use different email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
