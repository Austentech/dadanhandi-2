/**
 * GET /api/checkout/config
 * ------------------------
 * Returns client-side configuration for the checkout flow:
 *  - Razorpay key_id (safe to expose to client)
 *  - Reward config (earn rules, redeem rules)
 *  - Donation amounts
 *  - Pickup config (operating hours, slot interval, timezone)
 *  - Step names
 *
 * Public endpoint (no auth required) — all data here is non-sensitive.
 */

import { NextResponse } from 'next/server'
import { getKeyId } from '@/services/payment-service'
import {
  CHECKOUT_CONFIG,
  REWARD_CONFIG,
  DONATION_CONFIG,
  PICKUP_CONFIG,
} from '@/types/checkout'

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Checkout config loaded.',
    data: {
      razorpayKeyId: getKeyId(),
      reward: {
        earnPointsPerQualifyingOrder: REWARD_CONFIG.earnPointsPerQualifyingOrder,
        earnThresholdPaise: REWARD_CONFIG.earnThresholdPaise,
        earnRequiredDonationPaise: REWARD_CONFIG.earnRequiredDonationPaise,
        minRedeemPoints: REWARD_CONFIG.minRedeemPoints,
        redeemStepPoints: REWARD_CONFIG.redeemStepPoints,
        discountPerStepPaise: REWARD_CONFIG.discountPerStepPaise,
      },
      donation: {
        plantationPaise: DONATION_CONFIG.plantationPaise,
        hungerPaise: DONATION_CONFIG.hungerPaise,
      },
      pickup: {
        timezone: PICKUP_CONFIG.timezone,
        openingHour: PICKUP_CONFIG.openingHour,
        closingHour: PICKUP_CONFIG.closingHour,
        slotIntervalMinutes: PICKUP_CONFIG.slotIntervalMinutes,
      },
      checkout: {
        totalSteps: CHECKOUT_CONFIG.totalSteps,
        stepNames: CHECKOUT_CONFIG.stepNames,
        maxCustomerNotesLength: CHECKOUT_CONFIG.maxCustomerNotesLength,
        currency: CHECKOUT_CONFIG.currency,
      },
    },
  })
}
