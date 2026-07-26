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
import { useToastStore } from '@/store/toast-store'
import LoginPromptModal from '@/components/cart/LoginPromptModal'

interface MenuItemCardProps {
  item: MenuItem
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { isAuthenticated } = useAuth()
  const { addItem, isLoading } = useCartStore()
  const pushToast = useToastStore((s) => s.pushToast)
  const [selectedVariantId, setSelectedVariantId] = useState(item.variants[0]?.id || '')
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

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
    if (!isAuthenticated) {
      setShowLoginPrompt(true)
      return
    }

    if (!selectedVariant) {
      pushToast({
        type: 'error',
        title: 'No variant selected',
        message: 'Please select a weight or piece option first.',
      })
      return
    }

    const result = await addItem({
      itemId: item.id,
      variantId: selectedVariant.id,
      quantity: 1,
    })

    if (result.success) {
      pushToast({
        type: 'success',
        title: 'Added to your plate',
        message: `${item.name} (${selectedVariant.label}) has been added.`,
      })
    } else {
      // Show error in centered toast popup — easy to see on every device.
      pushToast({
        type: 'error',
        title: 'Could not add item',
        message: result.message || 'Please try again in a moment.',
      })
    }
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

        {/* Success/error feedback now shown as centered toast popup
            via the global ToastCenter (see ClientProviders). */}
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
