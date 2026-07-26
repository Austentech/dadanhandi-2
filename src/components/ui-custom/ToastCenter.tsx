/**
 * ToastCenter
 * -----------
 * Global toast/alert popup renderer.
 *
 * Renders all active toasts from the toast-store as centered, auto-closing
 * popups in the middle of the viewport.
 *
 * Features:
 *  - Centered on every device (mobile, tablet, desktop, landscape)
 *  - Auto-closes after 5 seconds (configurable per toast)
 *  - Manual X close button on each toast
 *  - Click anywhere on toast body to dismiss
 *  - Stacks vertically with gap if multiple toasts active
 *  - Progress bar shows remaining time
 *  - Accessible: role="alert", aria-live="polite"
 *  - Esc key dismisses the topmost toast
 *  - Pause auto-close on hover (so user can read long messages)
 *
 * Mount this ONCE at the app root (see ClientProviders.tsx).
 */

'use client'

import { useEffect, useRef } from 'react'
import { useToastStore, type ToastItem, type ToastType } from '@/store/toast-store'

// Icon + accent color per toast type
const TYPE_CONFIG: Record<ToastType, {
  icon: string
  iconBg: string
  iconColor: string
  accent: string
  titleColor: string
}> = {
  success: {
    icon: 'fas fa-check-circle',
    iconBg: '#ecfdf5',
    iconColor: '#059669',
    accent: '#10b981',
    titleColor: '#065f46',
  },
  error: {
    icon: 'fas fa-exclamation-circle',
    iconBg: '#fef2f2',
    iconColor: '#dc2626',
    accent: '#ef4444',
    titleColor: '#991b1b',
  },
  warning: {
    icon: 'fas fa-exclamation-triangle',
    iconBg: '#fffbeb',
    iconColor: '#d97706',
    accent: '#f59e0b',
    titleColor: '#92400e',
  },
  info: {
    icon: 'fas fa-info-circle',
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    accent: '#3b82f6',
    titleColor: '#1e40af',
  },
}

function ToastCard({ toast: t }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAtRef = useRef<number>(Date.now())
  const remainingRef = useRef<number>(t.durationMs)
  const pausedRef = useRef<boolean>(false)

  const cfg = TYPE_CONFIG[t.type]

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startTimer = () => {
    clearTimer()
    if (t.durationMs <= 0) return  // no auto-close
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      removeToast(t.id)
    }, remainingRef.current)
  }

  // Start countdown on mount
  useEffect(() => {
    startTimer()
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pause on hover (only if there's a duration)
  const handleMouseEnter = () => {
    if (t.durationMs <= 0) return
    pausedRef.current = true
    if (timerRef.current) {
      const elapsed = Date.now() - startedAtRef.current
      remainingRef.current = Math.max(0, remainingRef.current - elapsed)
      clearTimer()
    }
  }

  const handleMouseLeave = () => {
    if (t.durationMs <= 0) return
    pausedRef.current = false
    startTimer()
  }

  const handleDismiss = () => {
    clearTimer()
    removeToast(t.id)
  }

  // Progress bar width animation (only for visual feedback — actual timing
  // is handled by the JS timer above so it stays accurate when paused).
  const progressStyle: React.CSSProperties =
    t.durationMs > 0
      ? {
          animation: `toast-progress-shrink ${t.durationMs}ms linear forwards`,
        }
      : { width: '100%' }

  // Pause progress bar animation on hover
  const handleProgressEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.animationPlayState = 'paused'
  }
  const handleProgressLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.animationPlayState = 'running'
  }

  return (
    <div
      className={`toast-alert toast-alert-${t.type}`}
      role="alert"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleDismiss}
    >
      {/* Accent bar on left */}
      <div className="toast-alert-accent" style={{ background: cfg.accent }} />

      {/* Icon */}
      <div className="toast-alert-icon" style={{ background: cfg.iconBg, color: cfg.iconColor }}>
        <i className={cfg.icon} aria-hidden="true"></i>
      </div>

      {/* Body */}
      <div className="toast-alert-body">
        <strong className="toast-alert-title" style={{ color: cfg.titleColor }}>
          {t.title}
        </strong>
        {t.message && <span className="toast-alert-message">{t.message}</span>}
      </div>

      {/* X close button */}
      <button
        type="button"
        className="toast-alert-close"
        onClick={(e) => {
          e.stopPropagation()
          handleDismiss()
        }}
        aria-label="Dismiss notification"
      >
        <i className="fas fa-times" aria-hidden="true"></i>
      </button>

      {/* Progress bar (visual feedback for auto-close) */}
      {t.durationMs > 0 && (
        <div
          className="toast-alert-progress"
          style={{
            ...progressStyle,
            background: cfg.accent,
          }}
          onMouseEnter={handleProgressEnter}
          onMouseLeave={handleProgressLeave}
        />
      )}
    </div>
  )
}

export default function ToastCenter() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  // Esc dismisses the topmost (last-added) toast
  useEffect(() => {
    if (toasts.length === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const top = toasts[toasts.length - 1]
        if (top) removeToast(top.id)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toasts, removeToast])

  if (toasts.length === 0) return null

  return (
    <div
      className="toast-center-overlay"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="toast-center-stack">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </div>
  )
}
