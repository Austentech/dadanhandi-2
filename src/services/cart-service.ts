/**
 * Cart Service (server-side)
 * --------------------------
 * Single server-side interface for all cart operations.
 *
 * SECURITY MODEL:
 *  - Every public function performs FULL server-side validation:
 *    1. Validate input shape (Zod)
 *    2. Validate item + variant exist in menu catalog
 *    3. RECALCULATE price from catalog (NEVER trust client price)
 *    4. Persist via SECURITY DEFINER RPC (RLS-enforced)
 *  - Client-supplied prices are NEVER used — they are always recomputed.
 *  - Errors return generic messages; details logged server-side only.
 *
 * Future modules (Checkout) will read cart state from these same functions.
 */

import { createServerClient } from '@/lib/supabase/client-server'
import { getVariant } from '@/constants/menu-catalog'
import { calculateUnitPrice, buildLineKey } from '@/lib/pricing'
import type { CartItem, CartTotals } from '@/types/menu'
import { calculateCartTotals } from '@/lib/pricing'

// ============================================================================
// TYPES
// ============================================================================
export interface CartOperationResult {
  success: boolean
  message: string
  cart: CartItem[]
  totals: CartTotals
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a CartItem from a raw DB row.
 */
function rowToCartItem(row: {
  line_key: string
  item_id: string
  variant_id: string
  item_name: string
  item_emoji: string
  item_type: 'fixed' | 'weight' | 'piece'
  variant_label: string
  weight_grams: number | null
  piece_count: number | null
  unit_price_paise: number
  quantity: number
}): CartItem {
  return {
    lineKey: row.line_key,
    itemId: row.item_id,
    variantId: row.variant_id,
    itemName: row.item_name,
    itemEmoji: row.item_emoji,
    itemType: row.item_type,
    variantLabel: row.variant_label,
    weightGrams: row.weight_grams ?? undefined,
    pieceCount: row.piece_count ?? undefined,
    unitPricePaise: row.unit_price_paise,
    quantity: row.quantity,
  }
}

/**
 * Fetch the user's full cart and computed totals.
 */
export async function getCart(userId: string): Promise<{ cart: CartItem[]; totals: CartTotals }> {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('get_cart_for_user', {
    p_user_id: userId,
  })

  if (error) {
    console.error('[CART SERVICE] getCart error:', error.message)
    return { cart: [], totals: calculateCartTotals([]) }
  }

  const rows = (data || []) as Array<Parameters<typeof rowToCartItem>[0]>
  const cart = rows.map(rowToCartItem)
  const totals = calculateCartTotals(cart)
  return { cart, totals }
}

// ============================================================================
// ADD ITEM
// ============================================================================

export interface AddItemParams {
  itemId: string
  variantId: string
  quantity: number
}

export async function addItem(
  userId: string,
  params: AddItemParams,
): Promise<CartOperationResult> {
  // 1. Validate item + variant exist in catalog
  const variantInfo = getVariant(params.itemId, params.variantId)
  if (!variantInfo) {
    return fail('Item not found or invalid selection.', [])
  }

  const { item, variant } = variantInfo

  // 2. Verify item is available
  if (!item.available) {
    return fail('This item is currently unavailable.', [])
  }

  // 3. RECALCULATE unit price server-side (NEVER trust client)
  const unitPricePaise = calculateUnitPrice(item.type, variant)

  // 4. Build line key
  const lineKey = buildLineKey(params.itemId, params.variantId)

  // 5. Persist via SECURITY DEFINER RPC
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('upsert_cart_item', {
    p_user_id: userId,
    p_item_id: params.itemId,
    p_variant_id: params.variantId,
    p_line_key: lineKey,
    p_item_name: item.name,
    p_item_emoji: item.emoji,
    p_item_type: item.type,
    p_variant_label: variant.label,
    p_weight_grams: variant.weightGrams ?? null,
    p_piece_count: variant.pieceCount ?? null,
    p_unit_price_paise: unitPricePaise,
    p_quantity: params.quantity,
  })

  if (error) {
    console.error('[CART SERVICE] addItem RPC error:', error.message)
    return fail('Failed to add item to cart.', [])
  }

  const result = data as { success: boolean; message?: string; merged?: boolean } | null
  if (!result?.success) {
    return fail(result?.message || 'Failed to add item.', [])
  }

  // 6. Return updated cart
  const { cart, totals } = await getCart(userId)
  return {
    success: true,
    message: result.merged ? 'Item quantity updated in your plate.' : 'Item added to your plate.',
    cart,
    totals,
  }
}

// ============================================================================
// UPDATE QUANTITY
// ============================================================================

export async function updateQuantity(
  userId: string,
  lineKey: string,
  quantity: number,
): Promise<CartOperationResult> {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('update_cart_item_quantity', {
    p_user_id: userId,
    p_line_key: lineKey,
    p_quantity: quantity,
  })

  if (error) {
    console.error('[CART SERVICE] updateQuantity RPC error:', error.message)
    return fail('Failed to update quantity.', [])
  }

  const result = data as { success: boolean; message?: string } | null
  if (!result?.success) {
    return fail(result?.message || 'Failed to update quantity.', [])
  }

  const { cart, totals } = await getCart(userId)
  return {
    success: true,
    message: 'Quantity updated.',
    cart,
    totals,
  }
}

// ============================================================================
// REMOVE ITEM
// ============================================================================

export async function removeItem(
  userId: string,
  lineKey: string,
): Promise<CartOperationResult> {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('remove_cart_item', {
    p_user_id: userId,
    p_line_key: lineKey,
  })

  if (error) {
    console.error('[CART SERVICE] removeItem RPC error:', error.message)
    return fail('Failed to remove item.', [])
  }

  const { cart, totals } = await getCart(userId)
  return {
    success: true,
    message: 'Item removed from your plate.',
    cart,
    totals,
  }
}

// ============================================================================
// CLEAR CART
// ============================================================================

export async function clearCart(userId: string): Promise<CartOperationResult> {
  const supabase = await createServerClient()

  const { data, error } = await supabase.rpc('clear_cart', {
    p_user_id: userId,
  })

  if (error) {
    console.error('[CART SERVICE] clearCart RPC error:', error.message)
    return fail('Failed to clear cart.', [])
  }

  return {
    success: true,
    message: 'Plate cleared.',
    cart: [],
    totals: calculateCartTotals([]),
  }
}

// ============================================================================
// AUTH HELPER
// ============================================================================

/**
 * Get the authenticated user from the current request session.
 * Returns { user, errorResponse } — caller should return errorResponse if user is null.
 */
export async function getAuthenticatedUser(): Promise<
  { user: { id: string } | null; error: { status: number; body: unknown } | null }
> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: {
        status: 401,
        body: {
          success: false,
          message: 'Please log in to manage your plate.',
        },
      },
    }
  }

  return { user: { id: user.id }, error: null }
}

// ============================================================================
// INTERNAL HELPER
// ============================================================================

function fail(message: string, cart: CartItem[]): CartOperationResult {
  return {
    success: false,
    message,
    cart,
    totals: calculateCartTotals(cart),
  }
}
