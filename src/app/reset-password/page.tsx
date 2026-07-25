'use client'

import { Suspense } from 'react'
import ResetPasswordForm from './ResetPasswordForm'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageLoader from '@/components/ui-custom/PageLoader'

export default function ResetPasswordPage() {
  return (
    <>
      <PageLoader />
      <Navbar />
      <main>
        <section className="page-hero">
          <div className="container-custom" style={{ position: 'relative' }}>
            <nav style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              <a href="/" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Home</a>
              <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.4)' }}>/</span>
              <span style={{ color: '#F4C430' }}>Reset Password</span>
            </nav>
            <h1 className="page-hero-title">Reset <span>Password</span></h1>
            <p style={{ color: '#7A5030', fontSize: '1rem', marginTop: 10 }}>
              Enter your new password below
            </p>
          </div>
        </section>

        <section style={{ padding: '50px 0 80px' }}>
          <div className="container-custom" style={{ maxWidth: 460, margin: '0 auto' }}>
            <Suspense fallback={
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="auth-spinner" style={{ margin: '0 auto', width: 32, height: 32 }}></div>
              </div>
            }>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
