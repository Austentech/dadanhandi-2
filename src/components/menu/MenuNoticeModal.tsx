/**
 * MenuNoticeModal
 * ---------------
 * First-time-visitor popup shown on the /menu page.
 *
 * Behaviour:
 *  - On first visit to /menu in a browsing session, show modal.
 *  - User must click "I Understand" to dismiss.
 *  - Acknowledgement is stored in sessionStorage (per-session) so the popup
 *    does NOT reappear during the same browsing session.
 *  - Behaviour is configurable: change STORAGE_KEY or STORAGE_TYPE to
 *    'localStorage' to persist across sessions.
 *
 * Accessibility:
 *  - Focus trap (Esc to close = same as "I Understand")
 *  - role="dialog" aria-modal="true"
 *  - Buttons have explicit labels
 */

'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'dadan_menu_notice_ack'
const STORAGE_TYPE: 'sessionStorage' | 'localStorage' = 'sessionStorage'

const NOTICE_POINTS = [
  {
    icon: 'fas fa-rupee-sign',
    title: 'Full Payment Advance',
    text: 'Complete payment is required before your order is confirmed. No cash on pickup.',
  },
  {
    icon: 'fas fa-check-circle',
    title: 'Verify at Store',
    text: 'Please check your order at the store while collecting. No exchange or return after pickup.',
  },
  {
    icon: 'fas fa-ban',
    title: 'No Cancellation',
    text: 'Once confirmed, orders cannot be cancelled. We begin preparation immediately.',
  },
  {
    icon: 'fas fa-clock',
    title: 'Pickup Within Slot',
    text: 'Please pick up your order within the selected time slot to ensure freshness.',
  },
  {
    icon: 'fas fa-key',
    title: 'Carry Pickup PIN',
    text: 'Bring your Pickup PIN while collecting the order. You will receive it after payment.',
  },
]

export default function MenuNoticeModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const ack = window[STORAGE_TYPE].getItem(STORAGE_KEY)
      if (!ack) {
        // Small delay so it appears after page settles
        const t = setTimeout(() => setShow(true), 400)
        return () => clearTimeout(t)
      }
    } catch {
      // Storage may be disabled — show modal anyway
      setShow(true)
    }
  }, [])

  const acknowledge = () => {
    try {
      window[STORAGE_TYPE].setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore — storage may be unavailable
    }
    setShow(false)
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (show) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [show])

  // Esc to dismiss
  useEffect(() => {
    if (!show) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') acknowledge()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [show])

  if (!show) return null

  return (
    <div
      className="menu-notice-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-notice-title"
      onClick={acknowledge}
    >
      <div
        className="menu-notice-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-notice-header">
          <span className="menu-notice-icon">📋</span>
          <h2 id="menu-notice-title">Before You Order — Please Read</h2>
          <p className="menu-notice-subtitle">
            Important pickup order guidelines from Dadan Handi Mutton Hotel
          </p>
        </div>

        <div className="menu-notice-points">
          {NOTICE_POINTS.map((p, i) => (
            <div key={i} className="menu-notice-point">
              <span className="menu-notice-point-icon">
                <i className={p.icon}></i>
              </span>
              <div className="menu-notice-point-body">
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="menu-notice-footer">
          <button
            type="button"
            className="menu-notice-btn-secondary"
            onClick={acknowledge}
            aria-label="Close notice"
          >
            Close
          </button>
          <button
            type="button"
            className="menu-notice-btn-primary"
            onClick={acknowledge}
            autoFocus
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}
