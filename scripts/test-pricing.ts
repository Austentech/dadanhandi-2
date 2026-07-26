/**
 * Pricing Engine — Sanity Tests
 * Run with: npx tsx scripts/test-pricing.ts
 */

import {
  calculateUnitPrice,
  calculateLineTotal,
  calculateCartTotals,
  generateWeightOptions,
  formatWeightLabel,
  formatPrice,
  buildLineKey,
} from '../src/lib/pricing'
import type { CartItem, MenuItemVariant } from '../src/types/menu'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ ${message}`)
  }
}

console.log('\n=== WEIGHT LABEL FORMATTING ===')
assert(formatWeightLabel(250) === '250 gm', '250 gm')
assert(formatWeightLabel(500) === '500 gm', '500 gm')
assert(formatWeightLabel(750) === '750 gm', '750 gm')
assert(formatWeightLabel(1000) === '1 kg', '1 kg')
assert(formatWeightLabel(1250) === '1.25 kg', '1.25 kg')
assert(formatWeightLabel(1500) === '1.5 kg', '1.5 kg')
assert(formatWeightLabel(2000) === '2 kg', '2 kg')
assert(formatWeightLabel(5000) === '5 kg', '5 kg')

console.log('\n=== WEIGHT OPTIONS GENERATION ===')
const opts = generateWeightOptions()
assert(opts.length === 20, `20 weight options from 250gm to 5000gm (got ${opts.length})`)
assert(opts[0].grams === 250, 'First option is 250gm')
assert(opts[opts.length - 1].grams === 5000, 'Last option is 5000gm')

console.log('\n=== PRICE FORMATTING (Indian grouping) ===')
assert(formatPrice(0) === '₹0', '0 paise -> ₹0')
assert(formatPrice(100) === '₹1', '100 paise -> ₹1')
assert(formatPrice(55000) === '₹550', '55000 paise -> ₹550')
assert(formatPrice(110000) === '₹1,100', '110000 paise -> ₹1,100 (comma grouping)')
assert(formatPrice(120000) === '₹1,200', '120000 paise -> ₹1,200')

console.log('\n=== UNIT PRICE — WEIGHT ITEMS ===')
const handiMutton500Variant: MenuItemVariant = {
  id: 'handi-mutton--500gm',
  label: '500 gm',
  weightGrams: 500,
  pricePaise: 110000,
}
assert(calculateUnitPrice('weight', handiMutton500Variant) === 55000, '500gm of ₹1,100/kg = ₹550')

const handiMutton750Variant: MenuItemVariant = {
  id: 'handi-mutton--750gm',
  label: '750 gm',
  weightGrams: 750,
  pricePaise: 110000,
}
assert(calculateUnitPrice('weight', handiMutton750Variant) === 82500, '750gm of ₹1,100/kg = ₹825')

const handiMutton1250Variant: MenuItemVariant = {
  id: 'handi-mutton--1250gm',
  label: '1.25 kg',
  weightGrams: 1250,
  pricePaise: 110000,
}
assert(calculateUnitPrice('weight', handiMutton1250Variant) === 137500, '1.25kg of ₹1,100/kg = ₹1,375')

const handiMutton2000Variant: MenuItemVariant = {
  id: 'handi-mutton--2000gm',
  label: '2 kg',
  weightGrams: 2000,
  pricePaise: 110000,
}
assert(calculateUnitPrice('weight', handiMutton2000Variant) === 220000, '2kg of ₹1,100/kg = ₹2,200')

console.log('\n=== UNIT PRICE — ROUND HALF-UP ===')
const v1099_250: MenuItemVariant = { id: 'x', label: '250 gm', weightGrams: 250, pricePaise: 109900 }
assert(calculateUnitPrice('weight', v1099_250) === 27475, '250gm of ₹1,099/kg = ₹274.75 (rounded)')

console.log('\n=== UNIT PRICE — FIXED / PIECE ITEMS ===')
const fixedVariant: MenuItemVariant = {
  id: 'mutton-thali--default',
  label: '1 plate',
  pricePaise: 35000,
}
assert(calculateUnitPrice('fixed', fixedVariant) === 35000, 'Fixed plate returns its own price')

const pieceVariant: MenuItemVariant = {
  id: 'istu-mutton--6pcs',
  label: '6 pcs',
  pieceCount: 6,
  pricePaise: 28000,
}
assert(calculateUnitPrice('piece', pieceVariant) === 28000, 'Piece plate returns its own price')

console.log('\n=== LINE TOTAL ===')
assert(calculateLineTotal(55000, 1) === 55000, '1 × ₹550 = ₹550')
assert(calculateLineTotal(55000, 3) === 165000, '3 × ₹550 = ₹1,650')
assert(calculateLineTotal(55000, 0) === 0, '0 qty = 0 (safety)')

console.log('\n=== CART TOTALS ===')
const cart: CartItem[] = [
  {
    lineKey: 'handi-mutton--500gm',
    itemId: 'handi-mutton',
    variantId: 'handi-mutton--500gm',
    itemName: 'Handi Mutton',
    itemEmoji: '🍲',
    itemType: 'weight',
    variantLabel: '500 gm',
    weightGrams: 500,
    unitPricePaise: 55000,
    quantity: 2,
  },
  {
    lineKey: 'mutton-thali--default',
    itemId: 'mutton-thali',
    variantId: 'mutton-thali--default',
    itemName: 'Mutton Thali',
    itemEmoji: '🍛',
    itemType: 'fixed',
    variantLabel: '1 plate',
    unitPricePaise: 35000,
    quantity: 1,
  },
]
const totals = calculateCartTotals(cart)
assert(totals.subtotalPaise === 145000, 'Subtotal: (2×₹550) + ₹350 = ₹1,450')
assert(totals.totalItems === 3, 'Total items: 2 + 1 = 3')
assert(totals.totalLines === 2, 'Total lines: 2')
assert(totals.grandTotalPaise === 145000, 'Grand total = subtotal (no taxes/fees yet)')

console.log('\n=== EMPTY CART ===')
const emptyTotals = calculateCartTotals([])
assert(emptyTotals.subtotalPaise === 0, 'Empty cart subtotal = 0')
assert(emptyTotals.totalItems === 0, 'Empty cart totalItems = 0')
assert(emptyTotals.subtotalDisplay === '₹0', 'Empty cart display = ₹0')

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`)
if (failed > 0) {
  process.exit(1)
}
