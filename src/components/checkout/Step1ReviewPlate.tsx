/**
 * Step 1 — Review Plate
 * ---------------------
 * Shows the user's current cart with the ability to:
 *  - Increase / decrease quantity (uses existing cart-store actions)
 *  - Remove items
 *  - Go back to menu
 *  - See subtotal / total (client-side; server re-validates on next step)
 *
 * Server re-validates the cart on every API call — client display is UX only.
 */

'use client'

import { useCartStore } from '@/store/cart-store'
import { calculateLineBreakdown, formatWeightLabel } from '@/lib/pricing'
import type { CartItem } from '@/types/menu'

interface Step1ReviewPlateProps {
  onBackToMenu: () => void
  onNext: () => void
}

function getQuantityDisplay(item: CartItem): string {
  if (item.itemType === 'weight' && item.weightGrams) {
    const totalGrams = item.weightGrams * item.quantity
    return formatWeightLabel(totalGrams)
  }
  if (item.itemType === 'piece' && item.pieceCount) {
    const totalPieces = item.pieceCount * item.quantity
    return `${totalPieces} pcs`
  }
  return String(item.quantity)
}

function getVariantBreakdownDisplay(item: CartItem): string {
  if (item.quantity <= 1) return ''
  if (item.itemType === 'weight' || item.itemType === 'piece') {
    return ` (${item.quantity} × ${item.variantLabel})`
  }
  return ''
}

export default function Step1ReviewPlate({ onBackToMenu, onNext }: Step1ReviewPlateProps) {
  const { items, totals, updateQuantity, removeItem, updatingLineKey } = useCartStore()

  const isEmpty = items.length === 0

  const handleQtyChange = async (lineKey: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta
    if (newQty < 1) {
      await removeItem({ lineKey })
    } else {
      await updateQuantity({ lineKey, quantity: newQty })
    }
  }

  return (
    <div className="checkout-step">
      <h2 className="checkout-step-title">Review Your Plate</h2>
      <p className="checkout-step-subtitle">
        Confirm the items in your plate. You can adjust quantities or remove items before continuing.
      </p>

      {isEmpty ? (
        <div className="checkout-empty-plate">
          <div className="checkout-empty-plate-icon">🫕</div>
          <h3 style={{ fontFamily: 'var(--font-playfair)', color: 'var(--dark-red)', marginBottom: 6 }}>
            Your plate is empty
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            Add items from the menu before proceeding to checkout.
          </p>
          <button type="button" className="checkout-btn checkout-btn-primary" onClick={onBackToMenu}>
            <i className="fas fa-utensils" aria-hidden="true"></i>
            Browse Menu
          </button>
        </div>
      ) : (
        <>
          <div className="checkout-cart-list" role="list">
            {items.map((item) => {
              const breakdown = calculateLineBreakdown(item)
              const qtyDisplay = getQuantityDisplay(item)
              const variantBreakdown = getVariantBreakdownDisplay(item)
              const isThisLineUpdating = updatingLineKey === item.lineKey

              return (
                <div key={item.lineKey} className="checkout-cart-line" role="listitem">
                  <div className="checkout-cart-line-emoji" aria-hidden="true">{item.itemEmoji}</div>
                  <div className="checkout-cart-line-body">
                    <div className="checkout-cart-line-name">{item.itemName}</div>
                    <div className="checkout-cart-line-variant">
                      {item.itemType === 'weight' || item.itemType === 'piece'
                        ? (item.quantity > 1 ? `${qtyDisplay}${variantBreakdown}` : item.variantLabel)
                        : item.variantLabel}
                    </div>
                    <div className="checkout-cart-line-price">
                      {breakdown.unitPriceDisplay}
                      {item.itemType === 'piece' && breakdown.perPieceDisplay && (
                        <span style={{ color: 'var(--text-muted)' }}> · {breakdown.perPieceDisplay}</span>
                      )}
                    </div>
                    <div className="checkout-cart-line-stepper">
                      <button
                        type="button"
                        className="checkout-stepper-btn"
                        onClick={() => handleQtyChange(item.lineKey, item.quantity, -1)}
                        disabled={isThisLineUpdating}
                        aria-label={`Decrease quantity of ${item.itemName}`}
                      >
                        <i className="fas fa-minus" aria-hidden="true"></i>
                      </button>
                      <span className="checkout-stepper-qty" aria-live="polite">
                        {isThisLineUpdating ? (
                          <span className="auth-spinner" style={{ width: 14, height: 14, display: 'inline-block' }}></span>
                        ) : (
                          qtyDisplay
                        )}
                      </span>
                      <button
                        type="button"
                        className="checkout-stepper-btn"
                        onClick={() => handleQtyChange(item.lineKey, item.quantity, 1)}
                        disabled={isThisLineUpdating}
                        aria-label={`Increase quantity of ${item.itemName}`}
                      >
                        <i className="fas fa-plus" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div className="checkout-cart-line-total">{breakdown.lineTotalDisplay}</div>
                    <button
                      type="button"
                      className="checkout-cart-line-remove"
                      onClick={() => removeItem({ lineKey: item.lineKey })}
                      disabled={isThisLineUpdating}
                      aria-label={`Remove ${item.itemName} from plate`}
                    >
                      <i className="fas fa-trash-alt" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="checkout-summary">
            <div className="checkout-summary-title">Plate Summary</div>
            <div className="checkout-summary-row">
              <span>Items</span>
              <span>{totals.totalItems}</span>
            </div>
            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <span>{totals.subtotalDisplay}</span>
            </div>
            <div className="checkout-summary-row muted">
              <span>Taxes & donations</span>
              <span>Calculated at next steps</span>
            </div>
          </div>

          <div className="checkout-nav-buttons">
            <button type="button" className="checkout-btn checkout-btn-secondary" onClick={onBackToMenu}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i>
              Back to Menu
            </button>
            <button type="button" className="checkout-btn checkout-btn-primary" onClick={onNext}>
              Continue
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
