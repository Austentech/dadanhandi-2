/**
 * AccountPage — Main orchestrator with sidebar navigation
 * Tab-based navigation: My Account, Order History, Ongoing Orders, Reward History
 * Plus Order Detail view (opens within Orders tab)
 */

'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useAccountStore, type AccountTab } from '@/store/account-store'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PageLoader from '@/components/ui-custom/PageLoader'
import AccountMyAccount from '@/components/account/AccountMyAccount'
import AccountOrderHistory from '@/components/account/AccountOrderHistory'
import AccountOngoingOrders from '@/components/account/AccountOngoingOrders'
import AccountRewardHistory from '@/components/account/AccountRewardHistory'
import AccountOrderDetail from '@/components/account/AccountOrderDetail'

const TABS: { key: AccountTab; label: string; icon: string }[] = [
  { key: 'account', label: 'My Account', icon: 'fas fa-user' },
  { key: 'orders', label: 'Order History', icon: 'fas fa-box' },
  { key: 'ongoing', label: 'Ongoing Orders', icon: 'fas fa-truck' },
  { key: 'rewards', label: 'Reward History', icon: 'fas fa-award' },
]

export default function AccountPage() {
  const router = useRouter()
  const { user, profile, isLoading, isAuthenticated, signOut } = useAuth()
  const {
    activeTab, setActiveTab, goBack, selectedOrderId, fetchOrders,
    fetchOngoingOrders, fetchRewards,
  } = useAccountStore()

  const firstName = profile?.full_name?.split(' ')[0] || 'User'

  const handleTabChange = useCallback((tab: AccountTab) => {
    setActiveTab(tab)
    if (tab === 'orders') fetchOrders(1)
    else if (tab === 'ongoing') fetchOngoingOrders()
    else if (tab === 'rewards') fetchRewards(1)
  }, [setActiveTab, fetchOrders, fetchOngoingOrders, fetchRewards])

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/')
  }, [router, signOut])

  // Fetch reward summary on mount for My Account tab
  useEffect(() => {
    if (isAuthenticated) {
      fetchRewards(1)
    }
  }, [isAuthenticated, fetchRewards])

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

        <section className="account-section" style={{ padding: '40px 0 80px' }}>
          <div className="container-custom">
            <div className="account-layout">
              {/* Sidebar */}
              <aside className="account-sidebar">
                <nav className="account-nav">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`account-nav-item ${activeTab === tab.key ? 'active' : ''}`}
                      onClick={() => handleTabChange(tab.key)}
                      aria-current={activeTab === tab.key ? 'page' : undefined}
                    >
                      <i className={tab.icon} style={{ width: 20, textAlign: 'center' }}></i>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
                <div style={{ borderTop: '1px solid rgba(122,12,12,0.1)', margin: '16px 0' }}></div>
                <button
                  type="button"
                  className="account-nav-item"
                  onClick={handleLogout}
                  style={{ color: '#C46A2E' }}
                >
                  <i className="fas fa-sign-out-alt" style={{ width: 20, textAlign: 'center' }}></i>
                  <span>Logout</span>
                </button>
              </aside>

              {/* Content */}
              <div className="account-content">
                {(activeTab === 'account') && (
                  <AccountMyAccount user={user} profile={profile} />
                )}
                {(activeTab === 'orders') && (
                  <AccountOrderHistory />
                )}
                {(activeTab === 'ongoing') && (
                  <AccountOngoingOrders />
                )}
                {(activeTab === 'rewards') && (
                  <AccountRewardHistory />
                )}
                {(activeTab === 'order-detail' && selectedOrderId) && (
                  <AccountOrderDetail orderId={selectedOrderId} onBack={goBack} />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
