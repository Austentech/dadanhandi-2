/**
 * Checkout Progress Indicator
 * ---------------------------
 * Shows the user which step they're on, which steps are complete,
 * and which are upcoming. Fully keyboard-accessible.
 */

'use client'

import { CHECKOUT_CONFIG } from '@/types/checkout'

interface CheckoutProgressProps {
  currentStep: number  // 1-indexed
}

const STEP_ICONS = ['1', '2', '3', '4', '5', '6'] as const

export default function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  return (
    <nav className="checkout-progress" aria-label="Checkout progress">
      {CHECKOUT_CONFIG.stepNames.map((name, idx) => {
        const stepNum = idx + 1
        const isActive = stepNum === currentStep
        const isCompleted = stepNum < currentStep

        return (
          <div key={stepNum} style={{ display: 'contents' }}>
            <div
              className={`checkout-progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${stepNum}: ${name} ${isCompleted ? '(completed)' : isActive ? '(current)' : ''}`}
            >
              <div className="checkout-progress-circle">
                {isCompleted ? (
                  <i className="fas fa-check" aria-hidden="true"></i>
                ) : (
                  STEP_ICONS[idx]
                )}
              </div>
              <span className="checkout-progress-label">{name}</span>
            </div>
            {idx < CHECKOUT_CONFIG.stepNames.length - 1 && (
              <div
                className={`checkout-progress-connector ${isCompleted ? 'completed' : ''}`}
                aria-hidden="true"
              ></div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
