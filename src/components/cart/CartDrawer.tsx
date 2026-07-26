/**
 * CartDrawer (Plate)
 * ------------------
 * Slide-out panel showing the user's plate.
 *
 * Features:
 *  - List cart items with name, variant label, unit price, qty stepper
 *  - Live total updates
 *  - Remove item (×)
 *  - Clear plate
 *  - "Continue to Checkout" placeholder (next module)
 *
 * State:
 *  - Reads from cart-store (no local state for cart data)
 *  - Open/close state comes from CartProvider via props
 *
 * Accessibility:
 *  - Esc to close
 *  - Focus trap (basic)
 *  - role="dialog" aria-modal="true"
 *  - Body scroll locked when open
 */

'use client'

import { useEffect, useCallback } from 'react'
import { useCartStore } from '@/store/cart-store'
import { calculateLineBreakdown } from '@/lib/pricing'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, totals, updateQuantity, removeItem, clear, isLoading } = useCartStore()

  // Esc to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  const handleQtyChange = useCallback(
    async (lineKey: string, currentQty: number, delta: number) => {
      const newQty = currentQty + delta
      if (newQty < 1) {
        await removeItem({ lineKey })
      } else {
        await updateQuantity({ lineKey, quantity: newQty })
      }
    },
    [updateQuantity, removeItem],
  )

  if (!isOpen) return null

  const isEmpty = items.length === 0

  return (
    <div
      className="cart-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div
        className="cart-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Your plate"
      >
        {/* Header */}
        <div className="cart-drawer-header">
          <div className="cart-drawer-title-wrap">
            <span className="cart-drawer-icon">🍽️</span>
            <h2 id="cart-drawer-title">Your Plate</h2>
            <span className="cart-drawer-count">{totals.totalItems}</span>
          </div>
          <button
            type="button"
            className="cart-drawer-close"
            onClick={onClose}
            aria-label="Close plate"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        {isEmpty ? (
          <div className="cart-drawer-empty">
            <div className="cart-drawer-empty-icon">🫕</div>
            <h3>Your plate is empty</h3>
            <p>Browse our menu and add items to your plate to get started.</p>
            <button
              type="button"
              className="cart-drawer-browse-btn"
              onClick={onClose}
            >
              <i className="fas fa-utensils" style={{ marginRight: 6 }}></i>
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            <div className="cart-drawer-items">
              {items.map((item) => {
                const breakdown = calculateLineBreakdown(item)
                return (
                  <div key={item.lineKey} className="cart-item">
                    <div className="cart-item-emoji">{item.itemEmoji}</div>
                    <div className="cart-item-body">
                      <div className="cart-item-name">{item.itemName}</div>
                      <div className="cart-item-variant">{item.variantLabel}</div>
                      <div className="cart-item-price-row">
                        <span className="cart-item-unit-price">
                          {breakdown.unitPriceDisplay}
                          {item.itemType === 'piece' && breakdown.perPieceDisplay && (
                            <span className="cart-item-per-piece"> · {breakdown.perPieceDisplay}</span>
                          )}
                        </span>
                      </div>

                      {/* Qty stepper */}
                      <div className="cart-item-stepper">
                        <button
                          type="button"
                          className="cart-stepper-btn"
                          onClick={() => handleQtyChange(item.lineKey, item.quantity, -1)}
                          disabled={isLoading}
                          aria-label={`Decrease quantity of ${item.itemName}`}
                        >
                          <i className="fas fa-minus"></i>
                        </button>
                        <span className="cart-stepper-qty" aria-live="polite">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-stepper-btn"
                          onClick={() => handleQtyChange(item.lineKey, item.quantity, 1)}
                          disabled={isLoading}
                          aria-label={`Increase quantity of ${item.itemName}`}
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                      </div>
                    </div>

                    <div className="cart-item-right">
                      <div className="cart-item-line-total">{breakdown.lineTotalDisplay}</div>
                      <button
                        type="button"
                        className="cart-item-remove"
                        onClick={() => removeItem({ lineKey: item.lineKey })}
                        disabled={isLoading}
                        aria-label={`Remove ${item.itemName} from plate`}
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer with totals */}
            <div className="cart-drawer-footer">
              <div className="cart-totals-row">
                <span className="cart-totals-label">Subtotal</span>
                <span className="cart-totals-value">{totals.subtotalDisplay}</span>
              </div>
              <div className="cart-totals-row cart-totals-row-muted">
                <span>Taxes & pickup fees</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="cart-totals-row cart-totals-row-grand">
                <span>Total</span>
                <span>{totals.grandTotalDisplay}</span>
              </div>

              {/* Action buttons */}
              <button
                type="button"
                className="cart-checkout-btn"
                disabled
                title="Checkout will be available in the next module"
              >
                <i className="fas fa-arrow-right" style={{ marginRight: 6 }}></i>
                Continue to Checkout
              </button>
              <button
                type="button"
                className="cart-clear-btn"
                onClick={() => clear()}
                disabled={isLoading}
              >
                Clear Plate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
