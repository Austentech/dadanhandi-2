/**
 * CartProvider
 * ------------
 * Wires the cart store to auth state:
 *  - When user logs in: fetch cart from server
 *  - When user logs out: reset cart store
 *
 * Also opens/closes the cart drawer (slide-out panel) globally.
 */

'use client'

import { useEffect, createContext, useContext, useState, useCallback } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useAuth } from '@/hooks/use-auth'
import CartDrawer from '@/components/cart/CartDrawer'

interface CartContextValue {
  isCartOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { initFromServer, reset, isInitialized } = useCartStore()
  const [isCartOpen, setIsCartOpen] = useState(false)

  // When auth state changes:
  //  - Logged in: fetch cart from server
  //  - Logged out: reset cart store (guests cannot have items)
  useEffect(() => {
    if (isAuthenticated && !isInitialized) {
      initFromServer()
    } else if (!isAuthenticated && isInitialized) {
      reset()
    }
  }, [isAuthenticated, isInitialized, initFromServer, reset])

  const openCart = useCallback(() => setIsCartOpen(true), [])
  const closeCart = useCallback(() => setIsCartOpen(false), [])
  const toggleCart = useCallback(() => setIsCartOpen((v) => !v), [])

  return (
    <CartContext.Provider value={{ isCartOpen, openCart, closeCart, toggleCart }}>
      {children}
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
    </CartContext.Provider>
  )
}

export function useCartContext() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCartContext must be used within CartProvider')
  return ctx
}
