/**
 * CartButton
 * ----------
 * Floating button shown on every page that opens the cart drawer.
 * Shows live item count badge.
 *
 * Reads from cart-store + cart-context.
 */

'use client'

import { useCartStore } from '@/store/cart-store'
import { useCartContext } from '@/components/cart/CartProvider'

export default function CartButton() {
  const { openCart } = useCartContext()
  const count = useCartStore((s) => s.totals.totalItems)

  return (
    <button
      type="button"
      className="floating-cart-btn"
      onClick={openCart}
      aria-label={`Open plate. ${count} items`}
    >
      <i className="fas fa-utensils"></i>
      {count > 0 && (
        <span className="floating-cart-badge" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
