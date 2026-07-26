/**
 * MenuItemCard
 * ------------
 * Renders a single menu item with:
 *  - Item name + description (improved typography)
 *  - Variant selector (weight dropdown / piece dropdown / single plate)
 *  - Live price preview (calculated client-side using pricing engine)
 *  - "Add to Plate" button (or login prompt for guests)
 *
 * Pricing is recalculated server-side on Add; this component only renders
 * the calculated preview for UX. The server is the source of truth.
 */

'use client'

import { useState, useMemo } from 'react'
import type { MenuItem, MenuItemVariant } from '@/types/menu'
import { calculateUnitPrice, formatPrice, formatPricePerUnit } from '@/lib/pricing'
import { useAuth } from '@/hooks/use-auth'
import { useCartStore } from '@/store/cart-store'
import LoginPromptModal from '@/components/cart/LoginPromptModal'

interface MenuItemCardProps {
  item: MenuItem
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { isAuthenticated } = useAuth()
  const { addItem, isLoading } = useCartStore()
  const [selectedVariantId, setSelectedVariantId] = useState(item.variants[0]?.id || '')
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selectedVariant: MenuItemVariant | undefined = useMemo(
    () => item.variants.find((v) => v.id === selectedVariantId),
    [item.variants, selectedVariantId],
  )

  const unitPricePaise = useMemo(() => {
    if (!selectedVariant) return 0
    return calculateUnitPrice(item.type, selectedVariant)
  }, [item.type, selectedVariant])

  // Per-piece price (for piece items only)
  const perPiecePaise = useMemo(() => {
    if (item.type !== 'piece' || !selectedVariant?.pieceCount) return null
    return Math.floor(unitPricePaise / selectedVariant.pieceCount)
  }, [item.type, selectedVariant, unitPricePaise])

  const handleAddToPlate = async () => {
    // Clear previous flash
    setFlashMessage(null)

    if (!isAuthenticated) {
      setShowLoginPrompt(true)
      return
    }

    if (!selectedVariant) return

    const result = await addItem({
      itemId: item.id,
      variantId: selectedVariant.id,
      quantity: 1,
    })

    if (result.success) {
      setFlashMessage({ type: 'success', text: '✓ Added to your plate' })
    } else {
      setFlashMessage({ type: 'error', text: result.message })
    }

    // Auto-clear flash after 2.5s
    setTimeout(() => setFlashMessage(null), 2500)
  }

  const isWeight = item.type === 'weight'
  const isPiece = item.type === 'piece'
  const hasMultipleVariants = item.variants.length > 1

  return (
    <div className="menu-item-card menu-item-card-v2">
      <div className="menu-item-img-placeholder">{item.emoji}</div>

      <div className="menu-item-body">
        <div className="menu-item-name">{item.name}</div>
        <p className="menu-item-desc">{item.description}</p>

        {/* Variant selector — only show if more than 1 variant */}
        {hasMultipleVariants && (
          <div className="menu-item-variant-row">
            <label className="menu-item-variant-label">
              {isWeight ? 'Select weight:' : isPiece ? 'Select pieces:' : 'Select:'}
            </label>
            <select
              className="menu-item-variant-select"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              aria-label={`Select ${isWeight ? 'weight' : isPiece ? 'piece count' : 'variant'} for ${item.name}`}
            >
              {item.variants.map((v) => {
                const vUnitPrice = calculateUnitPrice(item.type, v)
                return (
                  <option key={v.id} value={v.id}>
                    {v.label} — {formatPrice(vUnitPrice)}
                  </option>
                )
              })}
            </select>
          </div>
        )}

        {/* Flash message (success/error) */}
        {flashMessage && (
          <div className={`menu-item-flash menu-item-flash-${flashMessage.type}`}>
            {flashMessage.text}
          </div>
        )}
      </div>

      <div className="menu-item-right menu-item-right-v2">
        {/* Price block */}
        <div className="menu-item-price-block">
          {isWeight && selectedVariant ? (
            <>
              <div className="menu-item-price">{formatPrice(unitPricePaise)}</div>
              <div className="menu-item-qty">
                {formatPricePerUnit(selectedVariant.pricePaise, 'kg')} · {selectedVariant.label}
              </div>
            </>
          ) : isPiece && selectedVariant ? (
            <>
              <div className="menu-item-price">{formatPrice(unitPricePaise)}</div>
              <div className="menu-item-qty">
                {selectedVariant.label}
                {perPiecePaise !== null && ` · ${formatPrice(perPiecePaise)}/piece`}
              </div>
            </>
          ) : (
            <>
              <div className="menu-item-price">{formatPrice(unitPricePaise)}</div>
              <div className="menu-item-qty">per plate</div>
            </>
          )}
        </div>

        {/* Add to Plate button */}
        <button
          type="button"
          className="btn-add-to-plate"
          onClick={handleAddToPlate}
          disabled={isLoading || !selectedVariant}
          aria-label={`Add ${item.name} to plate`}
        >
          {isLoading ? (
            <span className="auth-spinner"></span>
          ) : (
            <i className="fas fa-plus"></i>
          )}
          <span>Add to Plate</span>
        </button>
      </div>

      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
      />
    </div>
  )
}
