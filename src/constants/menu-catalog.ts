/**
 * Menu Catalog
 * ------------
 * Canonical source of truth for all menu items.
 *
 * - "Handi Mutton (Half)" has been REMOVED.
 * - "Handi Mutton (Full Handi)" renamed to "Handi Mutton".
 * - Each item has a stable `id` (slug).
 * - Each item declares its `type` (fixed | weight | piece).
 * - Each item has one or more `variants`.
 *
 * PRICES are stored in PAISE (1 INR = 100 paise) as integers
 * to eliminate floating-point errors.
 *
 * For WEIGHT items, the variant.pricePaise is the PRICE PER KG.
 * The pricing engine computes the actual unit price from weight.
 */

import type { MenuCategory, MenuItem, MenuItemVariant } from '@/types/menu'
import { generateWeightOptions } from '@/lib/pricing'
import { CART_CONFIG } from '@/types/menu'

// ============================================================================
// PRICE HELPER — convert rupees to paise
// ============================================================================
function rs(rupees: number): number {
  return Math.round(rupees * 100)
}

// ============================================================================
// WEIGHT VARIANT BUILDER
// ============================================================================
/**
 * Build weight variants for a weight-based item.
 * Generates options from 250gm to maxWeightGrams (default 5kg) in 250gm steps.
 * Each variant's pricePaise is the PRICE PER KG (not the variant's total price).
 */
function buildWeightVariants(itemId: string, pricePerKgPaise: number): MenuItemVariant[] {
  const options = generateWeightOptions(
    CART_CONFIG.minWeightGrams,
    CART_CONFIG.weightStepGrams,
    CART_CONFIG.maxWeightGrams,
  )
  return options.map((opt) => ({
    id: `${itemId}--${opt.grams}gm`,
    label: opt.label,
    weightGrams: opt.grams,
    pricePaise: pricePerKgPaise, // per kg
  }))
}

// ============================================================================
// PIECE VARIANT BUILDER
// ============================================================================
function buildPieceVariants(
  itemId: string,
  options: { pieces: number; platePricePaise: number }[],
): MenuItemVariant[] {
  return options.map((opt) => ({
    id: `${itemId}--${opt.pieces}pcs`,
    label: `${opt.pieces} pcs`,
    pieceCount: opt.pieces,
    pricePaise: opt.platePricePaise,
  }))
}

// ============================================================================
// FIXED VARIANT BUILDER (single default plate)
// ============================================================================
function buildFixedVariant(itemId: string, platePricePaise: number): MenuItemVariant[] {
  return [
    {
      id: `${itemId}--default`,
      label: '1 plate',
      pricePaise: platePricePaise,
    },
  ]
}

// ============================================================================
// MENU ITEMS
// ============================================================================
const ITEMS: MenuItem[] = [
  // ----------------------------------------------------------------
  // MUTTON
  // ----------------------------------------------------------------
  {
    id: 'handi-mutton',
    name: 'Handi Mutton',
    description: 'Traditional clay handi mutton, slow-cooked with whole spices',
    emoji: '🍲',
    category: 'mutton',
    type: 'weight',
    available: true,
    sortOrder: 1,
    // ₹1,100 per kg (price was previously shown as ₹1100 for 1 kg)
    variants: buildWeightVariants('handi-mutton', rs(1100)),
  },
  {
    id: 'mutton-thali',
    name: 'Mutton Thali',
    description: 'Mutton, rice, fulka, salad, chutney — complete meal',
    emoji: '🍛',
    category: 'mutton',
    type: 'fixed',
    available: true,
    sortOrder: 2,
    variants: buildFixedVariant('mutton-thali', rs(350)),
  },
  {
    id: 'mutton-keema',
    name: 'Mutton Keema',
    description: 'Spiced minced mutton, cooked in handi style',
    emoji: '🍖',
    category: 'mutton',
    type: 'fixed',
    available: true,
    sortOrder: 3,
    variants: buildFixedVariant('mutton-keema', rs(250)),
  },
  {
    id: 'istu-mutton',
    name: 'Istu Mutton',
    description: 'Traditional Bihar-style mutton istu',
    emoji: '🥘',
    category: 'mutton',
    type: 'piece',
    available: true,
    sortOrder: 4,
    // ₹280/plate (6 pcs) — original data; per-piece ₹46.67 -> displayed as ~₹47
    variants: buildPieceVariants('istu-mutton', [
      { pieces: 4, platePricePaise: rs(220) },
      { pieces: 6, platePricePaise: rs(280) },
      { pieces: 8, platePricePaise: rs(360) },
    ]),
  },
  {
    id: 'mutton-curry',
    name: 'Mutton Curry',
    description: 'Classic mutton curry with rich gravy',
    emoji: '🍲',
    category: 'mutton',
    type: 'fixed',
    available: true,
    sortOrder: 5,
    variants: buildFixedVariant('mutton-curry', rs(220)),
  },

  // ----------------------------------------------------------------
  // CHICKEN
  // ----------------------------------------------------------------
  {
    id: 'chicken-handi',
    name: 'Chicken Handi',
    description: 'Tender chicken in handi gravy with mustard oil',
    emoji: '🍗',
    category: 'chicken',
    type: 'weight',
    available: true,
    sortOrder: 1,
    variants: buildWeightVariants('chicken-handi', rs(800)),
  },
  {
    id: 'chicken-curry',
    name: 'Chicken Curry',
    description: 'Home-style chicken curry',
    emoji: '🍗',
    category: 'chicken',
    type: 'fixed',
    available: true,
    sortOrder: 2,
    variants: buildFixedVariant('chicken-curry', rs(200)),
  },
  {
    id: 'chicken-tandoori',
    name: 'Chicken Tandoori',
    description: 'Smoky chargrilled tandoori chicken',
    emoji: '🔥',
    category: 'chicken',
    type: 'piece',
    available: true,
    sortOrder: 3,
    // ₹350 full / 4 pcs — split into piece variants
    variants: buildPieceVariants('chicken-tandoori', [
      { pieces: 4, platePricePaise: rs(350) },
      { pieces: 6, platePricePaise: rs(500) },
      { pieces: 8, platePricePaise: rs(650) },
    ]),
  },
  {
    id: 'chicken-seekh-tikka',
    name: 'Chicken Seekh Tikka',
    description: 'Spiced minced chicken skewers',
    emoji: '🍢',
    category: 'chicken',
    type: 'piece',
    available: true,
    sortOrder: 4,
    variants: buildPieceVariants('chicken-seekh-tikka', [
      { pieces: 4, platePricePaise: rs(180) },
      { pieces: 6, platePricePaise: rs(220) },
      { pieces: 8, platePricePaise: rs(280) },
    ]),
  },

  // ----------------------------------------------------------------
  // FISH
  // ----------------------------------------------------------------
  {
    id: 'fish-curry',
    name: 'Fish Curry',
    description: 'Traditional Bihar-style fish curry',
    emoji: '🐟',
    category: 'fish',
    type: 'piece',
    available: true,
    sortOrder: 1,
    variants: buildPieceVariants('fish-curry', [
      { pieces: 4, platePricePaise: rs(280) },
      { pieces: 6, platePricePaise: rs(350) },
      { pieces: 8, platePricePaise: rs(450) },
    ]),
  },
  {
    id: 'fish-fry',
    name: 'Fish Fry',
    description: 'Crispy fried fish with masala',
    emoji: '🐠',
    category: 'fish',
    type: 'piece',
    available: true,
    sortOrder: 2,
    variants: buildPieceVariants('fish-fry', [
      { pieces: 4, platePricePaise: rs(280) },
      { pieces: 6, platePricePaise: rs(380) },
      { pieces: 8, platePricePaise: rs(480) },
    ]),
  },

  // ----------------------------------------------------------------
  // TANDOORI & STARTERS
  // ----------------------------------------------------------------
  {
    id: 'tandoori-chicken-full',
    name: 'Chicken Tandoori (Full)',
    description: 'Whole chicken marinated and chargrilled',
    emoji: '🔥',
    category: 'tandoori',
    type: 'piece',
    available: true,
    sortOrder: 1,
    variants: buildPieceVariants('tandoori-chicken-full', [
      { pieces: 4, platePricePaise: rs(350) },
      { pieces: 6, platePricePaise: rs(500) },
      { pieces: 8, platePricePaise: rs(650) },
    ]),
  },
  {
    id: 'seekh-tikka',
    name: 'Seekh Tikka',
    description: 'Minced chicken seekh kebabs',
    emoji: '🍢',
    category: 'tandoori',
    type: 'piece',
    available: true,
    sortOrder: 2,
    variants: buildPieceVariants('seekh-tikka', [
      { pieces: 4, platePricePaise: rs(180) },
      { pieces: 6, platePricePaise: rs(220) },
      { pieces: 8, platePricePaise: rs(280) },
    ]),
  },
  {
    id: 'mutton-seekh',
    name: 'Mutton Seekh',
    description: 'Minced mutton seekh kebabs',
    emoji: '🥩',
    category: 'tandoori',
    type: 'piece',
    available: true,
    sortOrder: 3,
    variants: buildPieceVariants('mutton-seekh', [
      { pieces: 4, platePricePaise: rs(220) },
      { pieces: 6, platePricePaise: rs(300) },
      { pieces: 8, platePricePaise: rs(380) },
    ]),
  },

  // ----------------------------------------------------------------
  // THALI & MEALS
  // ----------------------------------------------------------------
  {
    id: 'thali-mutton',
    name: 'Mutton Thali',
    description: 'Mutton, rice, fulka, salad, chutney, raita',
    emoji: '🍛',
    category: 'thali',
    type: 'fixed',
    available: true,
    sortOrder: 1,
    variants: buildFixedVariant('thali-mutton', rs(350)),
  },
  {
    id: 'thali-chicken',
    name: 'Chicken Thali',
    description: 'Chicken, rice, fulka, salad, dal',
    emoji: '🍛',
    category: 'thali',
    type: 'fixed',
    available: true,
    sortOrder: 2,
    variants: buildFixedVariant('thali-chicken', rs(280)),
  },
  {
    id: 'thali-egg-curry',
    name: 'Egg Curry Thali',
    description: 'Egg curry, rice, fulka, salad',
    emoji: '🍳',
    category: 'thali',
    type: 'fixed',
    available: true,
    sortOrder: 3,
    variants: buildFixedVariant('thali-egg-curry', rs(180)),
  },

  // ----------------------------------------------------------------
  // SIDES & EXTRAS
  // ----------------------------------------------------------------
  {
    id: 'steamed-rice',
    name: 'Steamed Rice',
    description: 'Fluffy basmati rice',
    emoji: '🍚',
    category: 'sides',
    type: 'fixed',
    available: true,
    sortOrder: 1,
    variants: buildFixedVariant('steamed-rice', rs(60)),
  },
  {
    id: 'fulka-roti',
    name: 'Fulka / Roti',
    description: 'Fresh butter fulka',
    emoji: '🫓',
    category: 'sides',
    type: 'piece',
    available: true,
    sortOrder: 2,
    // Original: ₹30 for 4 pcs (so ₹7.50/piece)
    variants: buildPieceVariants('fulka-roti', [
      { pieces: 2, platePricePaise: rs(20) },
      { pieces: 4, platePricePaise: rs(30) },
      { pieces: 6, platePricePaise: rs(45) },
      { pieces: 8, platePricePaise: rs(60) },
    ]),
  },
  {
    id: 'salad',
    name: 'Salad',
    description: 'Fresh onion, lemon, green chilli salad',
    emoji: '🥗',
    category: 'sides',
    type: 'fixed',
    available: true,
    sortOrder: 3,
    variants: buildFixedVariant('salad', rs(30)),
  },
  {
    id: 'raita',
    name: 'Raita',
    description: 'Curd-based side dish',
    emoji: '🥣',
    category: 'sides',
    type: 'fixed',
    available: true,
    sortOrder: 4,
    variants: buildFixedVariant('raita', rs(40)),
  },
  {
    id: 'green-salad',
    name: 'Green Salad',
    description: 'Fresh green salad with dressing',
    emoji: '🥬',
    category: 'sides',
    type: 'fixed',
    available: true,
    sortOrder: 5,
    variants: buildFixedVariant('green-salad', rs(50)),
  },
]

// ============================================================================
// MENU CATEGORIES
// ============================================================================
export const MENU_CATALOG: MenuCategory[] = [
  {
    id: 'mutton',
    title: 'Mutton Handi <span>Items</span>',
    items: ITEMS.filter((i) => i.category === 'mutton').sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0),
    ),
  },
  {
    id: 'chicken',
    title: 'Chicken <span>Specials</span>',
    items: ITEMS.filter((i) => i.category === 'chicken').sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0),
    ),
  },
  {
    id: 'fish',
    title: 'Fish & <span>Seafood</span>',
    items: ITEMS.filter((i) => i.category === 'fish').sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0),
    ),
  },
  {
    id: 'tandoori',
    title: 'Tandoori & <span>Starters</span>',
    items: ITEMS.filter((i) => i.category === 'tandoori').sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0),
    ),
  },
  {
    id: 'thali',
    title: 'Thali & <span>Meals</span>',
    items: ITEMS.filter((i) => i.category === 'thali').sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0),
    ),
  },
  {
    id: 'sides',
    title: 'Sides & <span>Extras</span>',
    items: ITEMS.filter((i) => i.category === 'sides').sort((a, b) =>
      (a.sortOrder || 0) - (b.sortOrder || 0),
    ),
  },
]

// ============================================================================
// LOOKUP HELPERS (used by client + server for validation)
// ============================================================================
const ITEM_INDEX: Map<string, MenuItem> = new Map(ITEMS.map((i) => [i.id, i]))
const VARIANT_INDEX: Map<string, { item: MenuItem; variant: MenuItemVariant }> = new Map()
for (const item of ITEMS) {
  for (const variant of item.variants) {
    VARIANT_INDEX.set(variant.id, { item, variant })
  }
}

export function getMenuItem(itemId: string): MenuItem | null {
  return ITEM_INDEX.get(itemId) || null
}

export function getVariant(
  itemId: string,
  variantId: string,
): { item: MenuItem; variant: MenuItemVariant } | null {
  // First verify item exists
  const item = ITEM_INDEX.get(itemId)
  if (!item) return null
  // Then verify variant belongs to this item
  const variant = item.variants.find((v) => v.id === variantId)
  if (!variant) return null
  return { item, variant }
}

export function getAllItems(): MenuItem[] {
  return ITEMS
}
