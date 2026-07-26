/**
 * Step 4 — Donation & Rewards
 * ---------------------------
 * Two optional donation checkboxes + reward point redemption input.
 *
 * Donations:
 *  - ₹5 for Plantation
 *  - ₹10 for Feed the Hunger
 *  - Both can be selected together
 *
 * Reward redemption:
 *  - Min 10 points required
 *  - 10 points = ₹5 discount (multiples of 10 only)
 *  - User's current balance shown
 *  - Quick-select buttons (10, 20, 50, max)
 *
 * On "Continue", calls /api/checkout/validate to get server-computed
 * final amount + potential points to earn. If validation succeeds,
 * proceeds to Step 5 (Payment).
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCheckoutStore } from '@/store/checkout-store'
import { formatPrice } from '@/lib/pricing'
import { DONATION_CONFIG, REWARD_CONFIG } from '@/types/checkout'

interface Step4DonationRewardsProps {
  onBack: () => void
  onNext: () => void
}

export default function Step4DonationRewards({ onBack, onNext }: Step4DonationRewardsProps) {
  const {
    donations,
    setDonations,
    rewardPointsToRedeem,
    setRewardPointsToRedeem,
    rewardBalance,
    fetchRewardBalance,
    isFetchingBalance,
    isValidating,
    validateCheckout,
    validatedFinalAmountPaise,
    validatedSubtotalPaise,
    validatedDonationPlantationPaise,
    validatedDonationHungerPaise,
    validatedRewardDiscountPaise,
    potentialPointsToEarn,
    error,
    setError,
  } = useCheckoutStore()

  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    fetchRewardBalance()
  }, [fetchRewardBalance])

  const handleRedeemChange = useCallback(
    (value: number) => {
      // Clamp to >= 0 and <= balance, multiple of 10
      let v = Math.max(0, Math.floor(value))
      if (v > rewardBalance) v = Math.floor(rewardBalance / 10) * 10
      if (v > 0 && v % 10 !== 0) v = Math.floor(v / 10) * 10
      setRewardPointsToRedeem(v)
    },
    [rewardBalance, setRewardPointsToRedeem],
  )

  const handleContinue = async () => {
    setLocalError(null)
    setError(null)

    if (rewardPointsToRedeem > 0 && rewardPointsToRedeem > rewardBalance) {
      setLocalError(`You only have ${rewardBalance} points. Cannot redeem ${rewardPointsToRedeem}.`)
      return
    }

    const result = await validateCheckout()
    if (result.success) {
      onNext()
    } else {
      setLocalError(result.message)
    }
  }

  const subtotalDisplay = validatedSubtotalPaise !== null ? formatPrice(validatedSubtotalPaise) : null
  const finalDisplay = validatedFinalAmountPaise !== null ? formatPrice(validatedFinalAmountPaise) : null
  const discountDisplay = validatedRewardDiscountPaise !== null && validatedRewardDiscountPaise > 0
    ? formatPrice(validatedRewardDiscountPaise)
    : null
  const donationTotalDisplay = (validatedDonationPlantationPaise ?? 0) + (validatedDonationHungerPaise ?? 0) > 0
    ? formatPrice((validatedDonationPlantationPaise ?? 0) + (validatedDonationHungerPaise ?? 0))
    : null

  const isEligibleForEarn =
    validatedSubtotalPaise !== null &&
    validatedSubtotalPaise > REWARD_CONFIG.earnThresholdPaise &&
    donations.plantation

  return (
    <div className="checkout-step">
      <h2 className="checkout-step-title">Donation & Rewards</h2>
      <p className="checkout-step-subtitle">
        Optional: contribute to a cause, or redeem your reward points for a discount.
      </p>

      {(localError || error) && (
        <div className="checkout-error-banner" role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{localError || error}</span>
        </div>
      )}

      {/* DONATIONS */}
      <h3 style={{ fontSize: '1rem', color: 'var(--text-dark)', marginBottom: 10 }}>
        Contribute to a Cause
      </h3>
      <div className="donation-grid">
        <div
          role="checkbox"
          aria-checked={donations.plantation}
          tabIndex={0}
          className={`donation-card ${donations.plantation ? 'selected' : ''}`}
          onClick={() => setDonations({ plantation: !donations.plantation })}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setDonations({ plantation: !donations.plantation })
            }
          }}
        >
          <div className="donation-card-checkbox">
            <i className="fas fa-check" aria-hidden="true"></i>
          </div>
          <div className="donation-card-body">
            <div className="donation-card-title">
              <span>Plantation</span>
              <span className="donation-card-amount">
                +{formatPrice(DONATION_CONFIG.plantationPaise)}
              </span>
            </div>
            <div className="donation-card-desc">
              Contribute ₹5 towards tree plantation. Help us make Patna greener, one sapling at a time.
            </div>
          </div>
        </div>

        <div
          role="checkbox"
          aria-checked={donations.hunger}
          tabIndex={0}
          className={`donation-card ${donations.hunger ? 'selected' : ''}`}
          onClick={() => setDonations({ hunger: !donations.hunger })}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              setDonations({ hunger: !donations.hunger })
            }
          }}
        >
          <div className="donation-card-checkbox">
            <i className="fas fa-check" aria-hidden="true"></i>
          </div>
          <div className="donation-card-body">
            <div className="donation-card-title">
              <span>Feed the Hunger</span>
              <span className="donation-card-amount">
                +{formatPrice(DONATION_CONFIG.hungerPaise)}
              </span>
            </div>
            <div className="donation-card-desc">
              Contribute ₹10 to feed someone in need. 100% of your donation goes to hunger relief.
            </div>
          </div>
        </div>
      </div>

      {/* REWARD REDEMPTION */}
      <div className="reward-section">
        <div className="reward-balance-display">
          <div className="reward-balance-icon" aria-hidden="true">
            <i className="fas fa-award"></i>
          </div>
          <div className="reward-balance-info">
            <div className="reward-balance-label">Your reward points</div>
            <div className="reward-balance-value">
              {isFetchingBalance ? 'Loading…' : `${rewardBalance} pts`}
            </div>
          </div>
        </div>

        <div className="reward-input-row">
          <span className="reward-input-label">Points to redeem:</span>
          <input
            type="number"
            className="reward-input"
            value={rewardPointsToRedeem || ''}
            min={0}
            max={rewardBalance}
            step={10}
            placeholder="0"
            onChange={(e) => handleRedeemChange(parseInt(e.target.value, 10) || 0)}
            aria-label="Points to redeem (multiple of 10)"
          />
          <div className="reward-quick-btns">
            <button
              type="button"
              className="reward-quick-btn"
              onClick={() => handleRedeemChange(0)}
            >
              None
            </button>
            <button
              type="button"
              className="reward-quick-btn"
              onClick={() => handleRedeemChange(10)}
              disabled={rewardBalance < 10}
            >
              10
            </button>
            <button
              type="button"
              className="reward-quick-btn"
              onClick={() => handleRedeemChange(20)}
              disabled={rewardBalance < 20}
            >
              20
            </button>
            <button
              type="button"
              className="reward-quick-btn"
              onClick={() => handleRedeemChange(50)}
              disabled={rewardBalance < 50}
            >
              50
            </button>
            <button
              type="button"
              className="reward-quick-btn"
              onClick={() => handleRedeemChange(rewardBalance)}
              disabled={rewardBalance < 10}
            >
              Max ({rewardBalance})
            </button>
          </div>
        </div>

        {rewardPointsToRedeem > 0 && (
          <div className="reward-discount-display">
            <span>
              {rewardPointsToRedeem} points → discount
            </span>
            <span className="reward-discount-value">
              −{formatPrice((rewardPointsToRedeem / 10) * 500)}
            </span>
          </div>
        )}

        <div className="reward-earn-info">
          <i className="fas fa-info-circle" aria-hidden="true" style={{ marginRight: 6 }}></i>
          {isEligibleForEarn ? (
            <span>
              <strong>🎉 You&apos;ll earn 5 reward points</strong> on this order (subtotal &gt; ₹500 + plantation donation selected).
              Points credited after successful payment.
            </span>
          ) : (
            <span>
              Earn <strong>5 reward points</strong> by selecting Plantation donation with a subtotal above ₹500.
              Points are credited only after successful payment.
            </span>
          )}
        </div>
      </div>

      {/* LIVE SUMMARY */}
      {subtotalDisplay && (
        <div className="checkout-summary">
          <div className="checkout-summary-title">Order Summary</div>
          <div className="checkout-summary-row">
            <span>Subtotal</span>
            <span>{subtotalDisplay}</span>
          </div>
          {donationTotalDisplay && (
            <div className="checkout-summary-row">
              <span>Donations</span>
              <span>+{donationTotalDisplay}</span>
            </div>
          )}
          {discountDisplay && (
            <div className="checkout-summary-row discount">
              <span>Reward discount ({rewardPointsToRedeem} pts)</span>
              <span>−{discountDisplay}</span>
            </div>
          )}
          {finalDisplay && (
            <div className="checkout-summary-row total">
              <span>Total Payable</span>
              <span>{finalDisplay}</span>
            </div>
          )}
          {potentialPointsToEarn > 0 && (
            <div className="checkout-summary-row muted" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)' }}>
              <span><i className="fas fa-award" aria-hidden="true" style={{ marginRight: 4 }}></i>Points you&apos;ll earn</span>
              <span>+{potentialPointsToEarn} pts</span>
            </div>
          )}
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
          onClick={handleContinue}
          disabled={isValidating}
        >
          {isValidating ? (
            <>
              <span className="payment-loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true"></span>
              Validating…
            </>
          ) : (
            <>
              Proceed to Payment
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
