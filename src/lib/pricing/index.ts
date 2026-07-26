/**
 * Pricing Engine
 * --------------
 * Single source of truth for all price calculations.
 *
 * Rules:
 *  - All money is integer paise (1 INR = 100 paise). Never floats.
 *  - All weights are integer grams. Never floats.
 *  - All quantities are positive integers.
 *  - Calculations are DETERMINISTIC — same inputs always produce same outputs.
 *  - This module is pure: no I/O, no side effects, easily unit-testable.
 *
 * Future modules (Checkout, Tax, Discount, Delivery) will extend this engine
 * without rewriting existing logic.
 */

import type {
  CartItem,
  CartTotals,
  Grams,
  MenuItem,
  MenuItemVariant,
  Paise,
  PriceBreakdown,
  Quantity,
} from '@/types/menu'
import { CART_CONFIG } from '@/types/menu'

// ============================================================================
// WEIGHT GENERATOR
// ============================================================================

/**
 * Generate all weight variants for a weight-based item.
 * Produces labels in 250gm increments: 250 gm, 500 gm, 750 gm, 1 kg,
 * 1.25 kg, 1.5 kg, 1.75 kg, 2 kg, ... up to maxWeightGrams.
 *
 * Logic:
 *  - < 1000 gm: label as "X gm"
 *  - exactly 1000 gm: label as "1 kg"
 *  - > 1000 gm and divisible by 1000: label as "N kg"
 *  - > 1000 gm and not divisible: label as "N.NN kg" (e.g. "1.25 kg")
 */
export interface WeightOption {
  grams: Grams
  label: string
}

export function generateWeightOptions(
  minGrams: Grams = CART_CONFIG.minWeightGrams,
  stepGrams: Grams = CART_CONFIG.weightStepGrams,
  maxGrams: Grams = CART_CONFIG.maxWeightGrams,
): WeightOption[] {
  if (minGrams < stepGrams) {
    throw new Error(`minGrams (${minGrams}) must be >= stepGrams (${stepGrams})`)
  }
  if (stepGrams <= 0) {
    throw new Error('stepGrams must be positive')
  }
  if (maxGrams < minGrams) {
    throw new Error(`maxGrams (${maxGrams}) must be >= minGrams (${minGrams})`)
  }

  const options: WeightOption[] = []
  for (let g = minGrams; g <= maxGrams; g += stepGrams) {
    options.push({ grams: g, label: formatWeightLabel(g) })
  }
  return options
}

export function formatWeightLabel(grams: Grams): string {
  if (grams < 1000) return `${grams} gm`
  if (grams === 1000) return '1 kg'
  if (grams % 1000 === 0) return `${grams / 1000} kg`
  // Decimal kg with up to 2 decimal places, trailing zeros trimmed
  const kg = grams / 1000
  const formatted = kg.toFixed(2).replace(/\.?0+$/, '')
  return `${formatted} kg`
}

// ============================================================================
// PRICE CALCULATION — CORE
// ============================================================================

/**
 * Calculate unit price for a variant.
 *
 * For FIXED and PIECE items, the variant's pricePaise IS the unit price.
 *
 * For WEIGHT items, the variant's pricePaise is the PRICE PER KG.
 * Unit price = round(pricePerKg × weightGrams / 1000).
 *
 * Rounding: standard round-half-up to nearest paise. This matches
 * typical retail pricing behavior.
 */
export function calculateUnitPrice(
  itemType: MenuItem['type'],
  variant: MenuItemVariant,
): Paise {
  if (itemType === 'weight') {
    if (!variant.weightGrams || variant.weightGrams <= 0) {
      throw new Error('Weight item variant must have positive weightGrams')
    }
    // pricePerKg × grams / 1000, rounded half-up to nearest paise
    // Use integer math to avoid float drift: (pricePaise × grams + 500) / 1000
    // (the +500 before floor division implements round-half-up)
    const rawNumerator = variant.pricePaise * variant.weightGrams
    return Math.floor((rawNumerator + 500) / 1000)
  }
  return variant.pricePaise
}

/**
 * Calculate line total = unit price × quantity.
 * Both inputs are integers, so output is an exact integer — no rounding needed.
 */
export function calculateLineTotal(unitPricePaise: Paise, quantity: Quantity): Paise {
  if (quantity < 1) return 0
  return unitPricePaise * quantity
}

/**
 * Full price breakdown for a single cart line.
 * Returns both internal paise values and human-readable display strings.
 */
export function calculateLineBreakdown(item: CartItem): PriceBreakdown {
  const lineTotalPaise = calculateLineTotal(item.unitPricePaise, item.quantity)
  const unitPriceDisplay = formatPrice(item.unitPricePaise)
  const lineTotalDisplay = formatPrice(lineTotalPaise)

  let perPieceDisplay: string | undefined
  if (item.itemType === 'piece' && item.pieceCount && item.pieceCount > 0) {
    const perPiecePaise = Math.floor(item.unitPricePaise / item.pieceCount)
    perPieceDisplay = `${formatPrice(perPiecePaise)}/piece`
  }

  return {
    lineTotalPaise,
    unitPricePaise: item.unitPricePaise,
    quantity: item.quantity,
    unitPriceDisplay,
    lineTotalDisplay,
    perPieceDisplay,
  }
}

// ============================================================================
// CART TOTALS
// ============================================================================

/**
 * Calculate cart totals from a list of cart items.
 *
 * Future modules will add taxes, delivery fee, discounts here
 * without changing the signature or breaking existing callers.
 */
export function calculateCartTotals(items: CartItem[]): CartTotals {
  let subtotalPaise = 0
  let totalItems = 0

  for (const item of items) {
    subtotalPaise += calculateLineTotal(item.unitPricePaise, item.quantity)
    totalItems += item.quantity
  }

  // Reserved fields — populated by future Checkout module
  const taxesPaise = 0
  const deliveryFeePaise = 0
  const discountPaise = 0
  const grandTotalPaise = subtotalPaise + taxesPaise + deliveryFeePaise - discountPaise

  return {
    subtotalPaise,
    totalItems,
    totalLines: items.length,
    subtotalDisplay: formatPrice(subtotalPaise),
    taxesPaise,
    deliveryFeePaise,
    discountPaise,
    grandTotalPaise,
    grandTotalDisplay: formatPrice(grandTotalPaise),
  }
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format paise as Indian Rupees with thousand separators.
 * Example: 110000 -> "₹1,100"
 *
 * Uses Intl.NumberFormat for correct Indian grouping (1,00,000 pattern).
 */
export function formatPrice(paise: Paise): string {
  if (!Number.isInteger(paise)) {
    throw new Error(`Paise must be integer, got: ${paise}`)
  }
  const rupees = Math.floor(paise / 100)
  // Use en-IN for Indian numbering (lakh/crore grouping)
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees)
  return formatted
}

/**
 * Format paise with explicit per-unit suffix.
 * Example: formatPricePerUnit(120000, 'kg') -> "₹1,200/kg"
 */
export function formatPricePerUnit(paise: Paise, unit: string): string {
  return `${formatPrice(paise)}/${unit}`
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function isValidQuantity(q: number): boolean {
  return Number.isInteger(q) && q >= 1 && q <= CART_CONFIG.maxQuantityPerLine
}

export function isValidWeight(grams: number): boolean {
  return (
    Number.isInteger(grams) &&
    grams >= CART_CONFIG.minWeightGrams &&
    grams <= CART_CONFIG.maxWeightGrams &&
    grams % CART_CONFIG.weightStepGrams === 0
  )
}

export function isValidPieceCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= 100
}

// ============================================================================
// CART LINE KEY
// ============================================================================

/**
 * Build a deterministic line key from itemId and variantId.
 * Same itemId+variantId always produces the same key, so identical
 * configurations merge into one line.
 */
export function buildLineKey(itemId: string, variantId: string): string {
  return `${itemId}--${variantId}`
}

export function parseLineKey(lineKey: string): { itemId: string; variantId: string } | null {
  const parts = lineKey.split('--')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  return { itemId: parts[0], variantId: parts[1] }
}
