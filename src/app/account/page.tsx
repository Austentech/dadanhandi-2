'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageLoader from '@/components/ui-custom/PageLoader'

export default function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = use(searchParams)
  const router = useRouter()
  const { user, profile, isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return (
      <>
        <PageLoader />
        <Navbar />
        <main>
          <section className="page-hero">
            <div className="container-custom">
              <h1 className="page-hero-title">My <span>Account</span></h1>
            </div>
          </section>
          <section style={{ padding: '60px 0' }}>
            <div className="container-custom" style={{ textAlign: 'center' }}>
              <div className="auth-spinner" style={{ margin: '0 auto', width: 32, height: 32 }}></div>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  if (!isAuthenticated || !user) {
    router.push('/?auth=required')
    return null
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'User'

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
              <span style={{ color: '#F4C430' }}>My Account</span>
            </nav>
            <h1 className="page-hero-title">My <span>Account</span></h1>
            <p style={{ color: '#7A5030', fontSize: '1rem', marginTop: 10 }}>
              Welcome back, {firstName}
            </p>
          </div>
        </section>

        <section style={{ padding: '50px 0 80px' }}>
          <div className="container-custom" style={{ maxWidth: 700, margin: '0 auto' }}>
            {/* Profile Card */}
            <div className="auth-card auth-card-responsive" style={{ marginBottom: 32 }}>
              <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.3rem', fontWeight: 700, color: '#7A0C0C', marginBottom: 20 }}>
                Profile Information
              </h3>
              <div className="profile-grid">
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>Full Name</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.full_name || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>Email</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.email || user.email || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>WhatsApp</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.whatsapp_number || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>Mobile</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.mobile_number || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>Area</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.area || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>City</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.city || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>Pincode</p>
                  <p style={{ fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.pincode || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#7A5030', marginBottom: 4 }}>Provider</p>
                  <p style={{ fontWeight: 600, textTransform: 'capitalize', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{profile?.provider || '—'}</p>
                </div>
              </div>
              {profile && !profile.profile_completed && (
                <div className="auth-message auth-message-error" style={{ marginTop: 20 }}>
                  Your profile is incomplete. Please complete it to place orders.
                  <a href="/auth/complete-profile" style={{ marginLeft: 8, color: '#7A0C0C', fontWeight: 700, textDecoration: 'underline' }}>
                    Complete Profile
                  </a>
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="auth-card">
              <h3 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: '1.3rem', fontWeight: 700, color: '#7A0C0C', marginBottom: 20 }}>
                Quick Actions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: 'fas fa-box', label: 'Order History', desc: 'View your past orders', href: '/account?tab=orders' },
                  { icon: 'fas fa-truck', label: 'Ongoing Orders', desc: 'Track active orders', href: '/account?tab=ongoing' },
                  { icon: 'fas fa-map-marker-alt', label: 'Saved Addresses', desc: 'Manage delivery addresses', href: '/account?tab=addresses' },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      border: '1px solid rgba(122,12,12,0.1)',
                      borderRadius: 10,
                      textDecoration: 'none',
                      color: '#4A2010',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--dark-red)'
                      e.currentTarget.style.background = 'rgba(122,12,12,0.03)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(122,12,12,0.1)'
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <i className={item.icon} style={{ color: '#7A0C0C', fontSize: '1.1rem', width: 24, textAlign: 'center' }}></i>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.8rem', color: '#7A5030' }}>{item.desc}</div>
                    </div>
                    <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', color: '#C46A2E', fontSize: '0.8rem' }}></i>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
