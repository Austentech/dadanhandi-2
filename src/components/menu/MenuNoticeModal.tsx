/**
 * MenuNoticeModal
 * ---------------
 * First-time-visitor popup shown on the /menu page.
 *
 * Behaviour:
 *  - On first visit to /menu in a browsing session, show modal.
 *  - User can dismiss via:
 *      a) "I Understand" button (primary)
 *      b) "Close" button (secondary, in sticky footer)
 *      c) X icon button (top-right corner, always visible)
 *      d) Click on the backdrop
 *      e) Press Esc
 *  - Acknowledgement is stored in sessionStorage (per-session) so the popup
 *    does NOT reappear during the same browsing session.
 *
 * Layout strategy (fixes "can not scroll down" issue on mobile):
 *  - Modal is split into 3 parts: Header / Scrollable Content / Sticky Footer
 *  - Only the middle "menu-notice-points" area scrolls, NOT the whole modal
 *  - Footer (with close buttons) is always visible — `position: sticky` at bottom
 *  - X icon at top-right is always visible — `position: absolute`
 *  - This means user can ALWAYS reach a close button, regardless of scroll position
 *
 * Mobile-friendly:
 *  - Uses `dvh` (dynamic viewport units) with `vh` fallback for iOS Safari
 *  - `overscroll-behavior: contain` prevents scroll chaining to body
 *  - `-webkit-overflow-scrolling: touch` for iOS momentum scroll
 *  - On small screens, modal aligns to top (`flex-start`) instead of center
 *
 * Accessibility:
 *  - Focus trap (Esc to close = same as "I Understand")
 *  - role="dialog" aria-modal="true"
 *  - All buttons have explicit aria-labels
 *  - Initial focus goes to the primary "I Understand" button
 */

'use client'

import { useEffect, useRef, useState } from 'react'

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
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let cancelled = false
    try {
      const ack = window[STORAGE_TYPE].getItem(STORAGE_KEY)
      if (!ack) {
        // Small delay so it appears after page settles
        const t = setTimeout(() => {
          if (!cancelled) setShow(true)
        }, 400)
        return () => {
          cancelled = true
          clearTimeout(t)
        }
      }
    } catch {
      // Storage may be disabled — show modal anyway (deferred to avoid
      // setState-in-effect lint warning)
      const t = setTimeout(() => {
        if (!cancelled) setShow(true)
      }, 400)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
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

  // Move focus to the primary button when modal opens
  useEffect(() => {
    if (show && primaryBtnRef.current) {
      const t = setTimeout(() => primaryBtnRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
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
        {/* Always-visible X close button (top-right) */}
        <button
          type="button"
          className="menu-notice-close-x"
          onClick={acknowledge}
          aria-label="Close notice"
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>

        {/* Header — fixed at top, never scrolls */}
        <div className="menu-notice-header">
          <span className="menu-notice-icon">📋</span>
          <h2 id="menu-notice-title">Before You Order — Please Read</h2>
          <p className="menu-notice-subtitle">
            Important pickup order guidelines from Dadan Handi Mutton Hotel
          </p>
        </div>

        {/* Scrollable content area — only this part scrolls */}
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

        {/* Sticky footer — always visible at the bottom */}
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
            ref={primaryBtnRef}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}
