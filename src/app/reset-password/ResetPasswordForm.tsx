'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validation/schemas'

export default function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const authError = searchParams.get('auth')

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm_password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setTimeout(() => router.push(data.data?.redirectTo || '/'), 2000)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  })

  return (
    <>
      {authError === 'error' && (
        <div className="auth-message auth-message-error" style={{ marginBottom: 20 }}>
          The password reset link is invalid or has expired. Please request a new one from the login page.
        </div>
      )}

      {message && (
        <div className={`auth-message auth-message-${message.type}`} style={{ marginBottom: 20 }}>
          {message.text}
        </div>
      )}

      <div className="auth-card" style={{ padding: '32px 28px' }}>
        <form onSubmit={onSubmit} noValidate>
          <div className="auth-field" style={{ position: 'relative' }}>
            <label htmlFor="rp-password" className="auth-label">New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="rp-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                style={{ paddingRight: 44 }}
                placeholder="Min 8 chars, uppercase, lowercase, number, special"
                autoComplete="new-password"
                autoFocus
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#7A5030', fontSize: '1rem', padding: 4,
                }}
              >
                {showPassword ? <i className="fas fa-eye-slash"></i> : <i className="fas fa-eye"></i>}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="auth-error">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="auth-field" style={{ position: 'relative' }}>
            <label htmlFor="rp-confirm" className="auth-label">Confirm New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="rp-confirm"
                type={showConfirm ? 'text' : 'password'}
                className="auth-input"
                style={{ paddingRight: 44 }}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                {...form.register('confirm_password')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                tabIndex={-1}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#7A5030', fontSize: '1rem', padding: 4,
                }}
              >
                {showConfirm ? <i className="fas fa-eye-slash"></i> : <i className="fas fa-eye"></i>}
              </button>
            </div>
            {form.formState.errors.confirm_password && (
              <p className="auth-error">{form.formState.errors.confirm_password.message}</p>
            )}
          </div>

          <div style={{
            background: 'rgba(122,12,12,0.04)', borderRadius: 8, padding: '12px 14px',
            marginBottom: 20, fontSize: '0.78rem', color: '#7A5030', lineHeight: 1.6,
          }}>
            <strong style={{ color: '#7A0C0C' }}>Password Requirements:</strong><br />
            • At least 8 characters<br />
            • One uppercase letter (A-Z)<br />
            • One lowercase letter (a-z)<br />
            • One number (0-9)<br />
            • One special character (@, #, $, etc.)
          </div>

          <button type="submit" className="auth-btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? <span className="auth-spinner"></span> : null}
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/" style={{ color: '#7A0C0C', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}>
            Back to Home
          </a>
        </div>
      </div>
    </>
  )
}
