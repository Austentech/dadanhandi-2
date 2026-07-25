'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { completeProfileSchema, type CompleteProfileFormData } from '@/lib/validation/schemas'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageLoader from '@/components/ui-custom/PageLoader'

export default function CompleteProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const form = useForm<CompleteProfileFormData>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      whatsapp_number: '',
      area: '',
      city: '',
      pincode: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        setTimeout(() => router.push('/'), 1000)
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
      <PageLoader />
      <Navbar />
      <main>
        <section className="page-hero">
          <div className="container-custom" style={{ position: 'relative' }}>
            <nav style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ color: '#F4C430' }}>Complete Profile</span>
            </nav>
            <h1 className="page-hero-title">Complete Your <span>Profile</span></h1>
            <p style={{ color: '#7A5030', fontSize: '1rem', marginTop: 10 }}>
              We need a few more details before you can start ordering
            </p>
          </div>
        </section>

        <section style={{ padding: '50px 0 80px' }}>
          <div className="container-custom" style={{ maxWidth: 520, margin: '0 auto' }}>
            {message && (
              <div className={`auth-message auth-message-${message.type}`} style={{ marginBottom: 20 }}>
                {message.text}
              </div>
            )}

            <form onSubmit={onSubmit} noValidate>
              <div className="auth-field">
                <label htmlFor="cp-whatsapp" className="auth-label">WhatsApp Number *</label>
                <input
                  id="cp-whatsapp"
                  type="tel"
                  className="auth-input"
                  placeholder="10-digit Indian mobile number"
                  autoComplete="tel"
                  autoFocus
                  {...form.register('whatsapp_number')}
                />
                {form.formState.errors.whatsapp_number && (
                  <p className="auth-error">{form.formState.errors.whatsapp_number.message}</p>
                )}
              </div>

              <div className="auth-field">
                <label htmlFor="cp-area" className="auth-label">Area *</label>
                <input
                  id="cp-area"
                  type="text"
                  className="auth-input"
                  placeholder="Your area / locality"
                  {...form.register('area')}
                />
                {form.formState.errors.area && (
                  <p className="auth-error">{form.formState.errors.area.message}</p>
                )}
              </div>

              <div className="auth-field-row">
                <div className="auth-field">
                  <label htmlFor="cp-city" className="auth-label">City *</label>
                  <input
                    id="cp-city"
                    type="text"
                    className="auth-input"
                    placeholder="Your city"
                    {...form.register('city')}
                  />
                  {form.formState.errors.city && (
                    <p className="auth-error">{form.formState.errors.city.message}</p>
                  )}
                </div>
                <div className="auth-field">
                  <label htmlFor="cp-pincode" className="auth-label">Pincode *</label>
                  <input
                    id="cp-pincode"
                    type="text"
                    className="auth-input"
                    placeholder="6-digit pincode"
                    {...form.register('pincode')}
                  />
                  {form.formState.errors.pincode && (
                    <p className="auth-error">{form.formState.errors.pincode.message}</p>
                  )}
                </div>
              </div>

              <button type="submit" className="auth-btn-primary" disabled={loading} style={{ width: '100%', marginTop: 24 }}>
                {loading ? <span className="auth-spinner"></span> : null}
                {loading ? 'Saving...' : 'Complete Profile'}
              </button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
