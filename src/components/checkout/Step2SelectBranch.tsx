/**
 * Step 2 — Select Pickup Branch
 * -----------------------------
 * Displays the four branches as selectable cards. The user must select
 * exactly one branch to proceed.
 */

'use client'

import { useEffect, useState } from 'react'
import { useCheckoutStore } from '@/store/checkout-store'
import { BRANCHES } from '@/constants/branches'
import { isBranchOpen, formatTime12h } from '@/lib/branch-utils'
import type { Branch } from '@/types/checkout'

interface Step2SelectBranchProps {
  onBack: () => void
  onNext: () => void
}

export default function Step2SelectBranch({ onBack, onNext }: Step2SelectBranchProps) {
  const { branches, fetchBranches, branchSlug, setBranch, isFetchingBranches } = useCheckoutStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (branches.length === 0) {
      fetchBranches()
    }
  }, [branches.length, fetchBranches])

  const displayBranches: Branch[] = branches.length > 0 ? branches : BRANCHES

  const handleSelect = (slug: string) => {
    setBranch(slug)
    setError(null)
  }

  const handleNext = () => {
    if (!branchSlug) {
      setError('Please pick a branch first.')
      return
    }
    onNext()
  }

  return (
    <div className="checkout-step">
      <h2 className="checkout-step-title">Pick a Branch</h2>
      <p className="checkout-step-subtitle">
        Where do you want to pick up your order?
      </p>

      {error && (
        <div className="checkout-error-banner" role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}

      {isFetchingBranches && branches.length === 0 ? (
        <div className="payment-loading">
          <div className="payment-loading-spinner" aria-hidden="true"></div>
          <p>Loading branches…</p>
        </div>
      ) : (
        <div className="branch-grid" role="radiogroup" aria-label="Pickup branches">
          {displayBranches.map((branch) => {
            const isSelected = branchSlug === branch.slug
            const openInfo = isBranchOpen(branch)
            return (
              <button
                key={branch.slug}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`branch-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(branch.slug)}
              >
                <div className="branch-card-name">{branch.name}</div>
                <div className="branch-card-address">
                  {branch.addressLine1}
                  {branch.addressLine2 && <><br />{branch.addressLine2}</>}
                  {branch.pincode && <><br />PIN: {branch.pincode}</>}
                </div>
                <div className="branch-card-hours">
                  <i className="far fa-clock" aria-hidden="true"></i>
                  <span>
                    {formatTime12h(branch.openingTime)} – {formatTime12h(branch.closingTime)}
                  </span>
                </div>
                {!openInfo.isOpen && (
                  <span className="branch-card-closed-badge">
                    Currently closed · Opens at {formatTime12h(branch.openingTime)}
                  </span>
                )}
                {openInfo.closingSoon && (
                  <span className="branch-card-closed-badge" style={{ background: 'rgba(212,160,23,0.15)', color: 'var(--mustard)' }}>
                    Closing soon
                  </span>
                )}
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
        <button type="button" className="checkout-btn checkout-btn-primary" onClick={handleNext}>
          Continue
          <i className="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  )
}
