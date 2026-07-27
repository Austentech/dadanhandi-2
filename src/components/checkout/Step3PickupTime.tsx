/**
 * Step 3 — Select Pickup Time
 * ---------------------------
 * Displays today's available pickup time slots. Past slots are shown
 * but disabled. Future dates are NOT allowed (enforced server-side).
 */

'use client'

import { useEffect, useState } from 'react'
import { useCheckoutStore } from '@/store/checkout-store'

interface Step3PickupTimeProps {
  onBack: () => void
  onNext: () => void
}

export default function Step3PickupTime({ onBack, onNext }: Step3PickupTimeProps) {
  const {
    pickupSlots,
    pickupSlotKey,
    setPickupSlot,
    fetchPickupSlots,
    isFetchingSlots,
  } = useCheckoutStore()

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pickupSlots.length === 0) {
      fetchPickupSlots()
    }
  }, [pickupSlots.length, fetchPickupSlots])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPickupSlots()
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPickupSlots])

  const selectableSlots = pickupSlots.filter((s) => !s.disabled)
  const isRestaurantOpen = selectableSlots.length > 0

  const handleSelect = (key: string) => {
    setPickupSlot(key)
    setError(null)
  }

  const handleNext = () => {
    if (!pickupSlotKey) {
      setError('Please select a pickup time to continue.')
      return
    }
    const slot = pickupSlots.find((s) => s.key === pickupSlotKey)
    if (!slot || slot.disabled) {
      setError('This time slot has already passed. Please select a different time.')
      return
    }
    onNext()
  }

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })

  return (
    <div className="checkout-step">
      <h2 className="checkout-step-title">Select Pickup Time</h2>
      <p className="checkout-step-subtitle">
        Pickup is available today only. Choose a time slot below — slots that have already passed are disabled.
      </p>

      {error && (
        <div className="checkout-error-banner" role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="pickup-date-display">
        <i className="far fa-calendar" aria-hidden="true"></i>
        <span>Today: <strong>{todayLabel}</strong></span>
      </div>

      {!isRestaurantOpen && pickupSlots.length > 0 && (
        <div className="pickup-closed-notice" role="status">
          <i className="fas fa-store-slash" aria-hidden="true"></i>
          <span>We&apos;re currently closed. Pickup hours are 10:00 AM – 10:00 PM IST.</span>
        </div>
      )}

      {isFetchingSlots && pickupSlots.length === 0 ? (
        <div className="payment-loading">
          <div className="payment-loading-spinner" aria-hidden="true"></div>
          <p>Loading pickup times…</p>
        </div>
      ) : (
        <div className="pickup-slot-grid" role="radiogroup" aria-label="Pickup time slots">
          {pickupSlots.map((slot) => {
            const isSelected = pickupSlotKey === slot.key
            return (
              <button
                key={slot.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={slot.disabled}
                className={`pickup-slot ${isSelected ? 'selected' : ''} ${slot.disabled ? 'disabled' : ''}`}
                onClick={() => !slot.disabled && handleSelect(slot.key)}
                disabled={slot.disabled}
                title={slot.disabled ? slot.disabledReason : undefined}
              >
                {slot.shortLabel}
              </button>
            )
          })}
        </div>
      )}

      <div className="checkout-nav-buttons">
        <button type="button" className="checkout-btn checkout-btn-secondary" onClick={onBack}>
          <i className="fas fa-arrow-left" aria-hidden="true"></i>
          Back
        </button>
        <button
          type="button"
          className="checkout-btn checkout-btn-primary"
          onClick={handleNext}
          disabled={!isRestaurantOpen}
        >
          Continue
          <i className="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  )
}
