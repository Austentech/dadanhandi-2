/**
 * Menu & Cart Type System
 * -----------------------
 * Strongly-typed models for menu items, variants, cart items, and pricing.
 * All money values are stored as INTEGER PAISE internally to avoid
 * floating-point errors. Display layer converts to rupees.
 */

// ============================================================================
// PRICING UNITS
// ============================================================================

/** Money in integer paise (1 rupee = 100 paise). Never use floats for money. */
export type Paise = number

/** Weight in grams. Always integer. */
export type Grams = number

/** Quantity is always a positive integer (1, 2, 3, ...). */
export type Quantity = number

// ============================================================================
// ITEM TYPES — determines pricing strategy
// ============================================================================

/**
 * FIXED: standard plate item. User selects quantity only.
 *        Price = quantity × plate_price
 *
 * WEIGHT: sold by weight (e.g. mutton per kg). User selects weight variant.
 *         Price = quantity × (price_per_kg × weight_kg)
 *
 * PIECE: sold in plates with fixed piece counts (e.g. 4 pcs, 6 pcs).
 *        User selects a piece variant, then quantity of that variant.
 *        Price = quantity × plate_price
 *        Per-piece price is displayed for information only.
 */
export type ItemType = 'fixed' | 'weight' | 'piece'

// ============================================================================
// MENU ITEM VARIANT
// ============================================================================

/**
 * A purchasable configuration of a menu item.
 *
 * - FIXED items have exactly ONE variant (the default plate).
 * - WEIGHT items have multiple variants (250gm, 500gm, 1kg, ...).
 * - PIECE items have multiple variants (4 pcs, 6 pcs, 8 pcs, ...).
 */
export interface MenuItemVariant {
  /** Stable unique ID — used as cart line key. Format: `${itemId}--${variantId}` */
  id: string
  /** Display label, e.g. "500 gm", "6 pcs", "1 plate" */
  label: string
  /** For WEIGHT items: weight in grams. Undefined for fixed/piece. */
  weightGrams?: Grams
  /** For PIECE items: number of pieces in this variant. Undefined for fixed/weight. */
  pieceCount?: number
  /** Price of this variant in paise. For weight items, this is price-per-kg. */
  pricePaise: Paise
}

// ============================================================================
// MENU ITEM (canonical, derived from constants but enriched)
// ============================================================================

export interface MenuItem {
  /** Stable slug ID, e.g. "handi-mutton", "chicken-curry" */
  id: string
  /** Display name, e.g. "Handi Mutton" */
  name: string
  /** Short description */
  description: string
  /** Emoji icon (kept from original design) */
  emoji: string
  /** Category ID — matches MenuCategory.id */
  category: string
  /** Pricing strategy */
  type: ItemType
  /** Available variants. Min 1. */
  variants: MenuItemVariant[]
  /** True if item is currently available for ordering */
  available: boolean
  /** Optional sort order within category */
  sortOrder?: number
}

export interface MenuCategory {
  id: string
  title: string
  items: MenuItem[]
}

// ============================================================================
// CART ITEM (client-side representation)
// ============================================================================

/**
 * A cart line item. Uniquely identified by `lineKey` which combines
 * itemId + variantId, so the same item with different variants are
 * separate cart lines (e.g. 500gm Handi Mutton and 1kg Handi Mutton).
 */
export interface CartItem {
  /** Unique line key: `${itemId}--${variantId}` */
  lineKey: string
  itemId: string
  variantId: string
  itemName: string
  itemEmoji: string
  itemType: ItemType
  /** Variant label at time of add, e.g. "500 gm" or "6 pcs" */
  variantLabel: string
  /** Weight in grams (for weight items) — used for server re-validation */
  weightGrams?: Grams
  /** Piece count (for piece items) */
  pieceCount?: number
  /** Unit price in paise (validated server-side on every action) */
  unitPricePaise: Paise
  /** Quantity — always integer >= 1 */
  quantity: Quantity
}

// ============================================================================
// PRICING RESULT
// ============================================================================

export interface PriceBreakdown {
  /** Per-line total in paise */
  lineTotalPaise: Paise
  /** Unit price in paise (already weight-adjusted for weight items) */
  unitPricePaise: Paise
  /** Quantity */
  quantity: Quantity
  /** Human-readable unit price, e.g. "₹600" or "₹1,200/kg" */
  unitPriceDisplay: string
  /** Human-readable line total, e.g. "₹1,800" */
  lineTotalDisplay: string
  /** For piece items only: per-piece price display, e.g. "₹80/piece" */
  perPieceDisplay?: string
}

export interface CartTotals {
  /** Sum of all line totals in paise */
  subtotalPaise: Paise
  /** Total item count (sum of quantities) */
  totalItems: number
  /** Total distinct lines */
  totalLines: number
  /** Human-readable subtotal */
  subtotalDisplay: string
  /**
   * Reserved for future modules (Checkout, Tax, Delivery).
   * Currently always 0 / empty.
   */
  taxesPaise: Paise
  deliveryFeePaise: Paise
  discountPaise: Paise
  grandTotalPaise: Paise
  grandTotalDisplay: string
}

// ============================================================================
// API REQUEST / RESPONSE SHAPES
// ============================================================================

export interface AddToCartRequest {
  itemId: string
  variantId: string
  quantity: number
}

export interface UpdateCartQuantityRequest {
  lineKey: string
  quantity: number
}

export interface RemoveFromCartRequest {
  lineKey: string
}

export interface CartApiResponse {
  success: boolean
  message: string
  data?: {
    cart: CartItem[]
    totals: CartTotals
  }
}

// ============================================================================
// CONFIG
// ============================================================================

export const CART_CONFIG = {
  /** Max items per cart line */
  maxQuantityPerLine: 50,
  /** Max distinct lines per cart */
  maxLines: 30,
  /** Min weight in grams */
  minWeightGrams: 250,
  /** Weight step in grams */
  weightStepGrams: 250,
  /** Max weight in grams (configurable; default 5 kg) */
  maxWeightGrams: 5000,
} as const
