# Module 2 — Menu, Add to Plate (Cart) & Pricing Engine

Production-ready cart module for the Dadan Handi Mutton Hotel website.
This module is **scoped** to menu + cart + pricing only. Checkout, payment,
order creation, and pickup PIN are deferred to Module 3.

---

## 1. What Changed

### Menu Improvements
- **Typography upgraded**: Item names now 1.05rem / weight 800; prices 1.15rem / weight 900.
- **"Handi Mutton (Half)"** removed entirely.
- **"Handi Mutton (Full Handi)"** renamed to just **"Handi Mutton"**.
- All 22 menu items now have stable slug IDs (`handi-mutton`, `mutton-thali`, etc.).
- Each item has a `type` field that drives its pricing strategy.

### WhatsApp Ordering Removed
- Removed WhatsApp floating button (replaced with plate/cart button).
- Removed "Order on WhatsApp" CTA from hero section.
- Removed WhatsApp link from navbar mobile panel.
- Menu page hero now shows "Pickup orders only · Pay online · Order ready at store".

### New Menu Item Types
1. **Fixed** — single plate, qty-based (e.g. Mutton Thali ₹350).
2. **Weight** — sold per kg, 250gm increments from 250gm to 5kg (e.g. Handi Mutton ₹1,100/kg).
3. **Piece** — sold in plates of N pieces (e.g. Chicken Tandoori 4/6/8 pcs).

---

## 2. Folder Structure

```
src/
├── types/
│   └── menu.ts                      # All cart + menu types (Paise, Grams, CartItem, etc.)
├── constants/
│   └── menu-catalog.ts              # Canonical menu data (item types + variants + prices)
├── lib/
│   ├── pricing/
│   │   └── index.ts                 # Pricing engine (pure functions, no I/O)
│   └── validation/
│       └── cart-schemas.ts          # Zod schemas for cart API requests
├── services/
│   └── cart-service.ts              # Server-side cart operations (RLS + RPC)
├── store/
│   └── cart-store.ts                # Zustand store (optimistic UI + server sync)
├── components/
│   ├── menu/
│   │   ├── MenuItemCard.tsx         # Renders one item + variant selector + Add to Plate
│   │   └── MenuNoticeModal.tsx      # First-time-visitor popup with 5 notice points
│   └── cart/
│       ├── CartProvider.tsx         # Wires cart store to auth state
│       ├── CartButton.tsx           # Floating button with badge
│       ├── CartDrawer.tsx           # Slide-out plate panel
│       └── LoginPromptModal.tsx     # "Please login" modal for guests
├── app/
│   ├── menu/page.tsx                # Rebuilt menu page
│   └── api/cart/
│       ├── add/route.ts             # POST /api/cart/add
│       ├── update/route.ts          # POST /api/cart/update
│       ├── remove/route.ts          # POST /api/cart/remove
│       ├── clear/route.ts           # POST /api/cart/clear
│       └── get/route.ts             # GET /api/cart/get
└── supabase/migrations/
    └── 003_create_cart_tables.sql   # Cart + cart_items tables, RLS, RPC functions
```

---

## 3. Database Schema

Run `supabase/migrations/003_create_cart_tables.sql` in the Supabase SQL Editor.

### Tables
- **`cart`** — one row per user (uuid PK, `user_id` references `auth.users`).
- **`cart_items`** — one row per cart line (composite unique on `(cart_id, line_key)`).

### RLS Policies
- Users can ONLY read/write their own cart and cart_items.
- All mutations go through SECURITY DEFINER RPC functions which perform
  server-side validation before INSERT/UPDATE.

### RPC Functions
- `get_cart_for_user(p_user_id)` — returns all cart items for a user.
- `upsert_cart_item(...)` — adds or merges (increments qty) a cart line.
- `update_cart_item_quantity(p_user_id, p_line_key, p_quantity)` — sets absolute qty.
- `remove_cart_item(p_user_id, p_line_key)` — removes a single line.
- `clear_cart(p_user_id)` — empties the user's cart.

---

## 4. Pricing Engine

All money is stored as **integer paise** (1 INR = 100 paise). Never floats.

### Key functions (in `src/lib/pricing/index.ts`)
- `calculateUnitPrice(type, variant)` — returns paise for one unit.
- `calculateLineTotal(unitPricePaise, quantity)` — returns paise for a line.
- `calculateCartTotals(items)` — returns `{ subtotalPaise, totalItems, grandTotalPaise, ... }`.
- `generateWeightOptions(min, step, max)` — returns all 250gm increments.
- `formatPrice(paise)` — Indian-formatted string (e.g. `₹1,100`).
- `formatWeightLabel(grams)` — `250 gm`, `1 kg`, `1.25 kg`, etc.

### Rounding
- Weight pricing uses **round-half-up** via integer math:
  `(pricePaise × grams + 500) / 1000` (floor division after +500).
- No floating-point drift possible.

### Tests
Run: `npx tsx scripts/test-pricing.ts` — 33 sanity tests, all passing.

---

## 5. API Reference

All endpoints require authentication. Unauthenticated requests return 401.

### `POST /api/cart/add`
Body: `{ "itemId": "handi-mutton", "variantId": "handi-mutton--500gm", "quantity": 1 }`
Response: `{ "success": true, "data": { "cart": [...], "totals": {...} } }`

### `POST /api/cart/update`
Body: `{ "lineKey": "handi-mutton--handi-mutton--500gm", "quantity": 3 }`

### `POST /api/cart/remove`
Body: `{ "lineKey": "handi-mutton--handi-mutton--500gm" }`

### `POST /api/cart/clear`
No body. Empties the cart.

### `GET /api/cart/get`
Returns the user's current cart and totals.

### Security
- All inputs validated with Zod (strict regex on item/variant IDs).
- Server re-validates that `itemId + variantId` exist in catalog.
- Server RECALCULATES unit price from catalog — client price is NEVER trusted.
- Rate limited per IP + per user (30 add/min, 60 update/min, 10 clear/min).

---

## 6. Manual Testing Checklist

### Guest Browsing
- [ ] Open `/menu` in incognito — menu notice popup appears after 400ms.
- [ ] Click "I Understand" — popup dismisses; does NOT reappear during session.
- [ ] Browse items — prices visible, variant dropdowns work.
- [ ] Click "Add to Plate" on any item → login prompt modal appears.
- [ ] Click "Cancel" on login prompt → modal closes, no redirect.
- [ ] Click "Login" on login prompt → existing AuthModal opens in login view.

### Login Required
- [ ] Login with email/password.
- [ ] Cart initializes from server (visible if previously had items).
- [ ] Add item → "✓ Added to your plate" flash appears, auto-clears in 2.5s.
- [ ] Floating cart button shows badge with item count.

### Weight Selection
- [ ] Open Handi Mutton → dropdown shows 20 options (250gm to 5kg).
- [ ] Select 500gm → price shows ₹550 (1100 × 0.5).
- [ ] Select 750gm → price shows ₹825.
- [ ] Select 1.25 kg → price shows ₹1,375.
- [ ] Select 2 kg → price shows ₹2,200.
- [ ] Add 500gm and 1kg of same item → appear as TWO separate cart lines.

### Piece Selection
- [ ] Open Chicken Tandoori → dropdown shows 4/6/8 pcs options.
- [ ] Select 6 pcs @ ₹500 → price shows ₹500; subtitle shows "₹83/piece" (500/6).
- [ ] Add to plate → cart shows "6 pcs · ₹83/piece".

### Quantity Stepper
- [ ] In cart drawer, click "+" → qty increases, line total updates instantly.
- [ ] Click "-" → qty decreases; at qty=1, clicking "-" removes the item.
- [ ] Try to exceed 50 — server rejects with "Quantity exceeds maximum".

### Remove Item
- [ ] Click trash icon on a cart line → item removed, totals recalculate.

### Clear Plate
- [ ] Click "Clear Plate" → cart empties, empty state shows.

### Refresh Persistence
- [ ] Add items, refresh page → cart is restored from server (logged-in users only).
- [ ] Logout → cart resets in UI (server data preserved for next login).

### Rate Limiting
- [ ] Send 31 add requests in 1 minute → 429 "Too many actions. Please slow down."
- [ ] Wait 60 seconds → can add again.

### Invalid Requests
- [ ] POST /api/cart/add with `itemId: "fake-item"` → 400 "Item not found or invalid selection."
- [ ] POST /api/cart/add with `quantity: 0` → 400 "Quantity must be at least 1".
- [ ] POST /api/cart/add with `quantity: 1.5` → 400 "Quantity must be an integer".
- [ ] POST /api/cart/add with malformed JSON → 500 generic error (no stack trace leaked).

### Responsive
- [ ] Mobile (<576px): variant selector goes full-width below label; price+button row wraps.
- [ ] Tablet (576-767px): variant selector 280px max-width.
- [ ] Desktop: standard layout, no overflow.
- [ ] Cart drawer: full-width on mobile, 420px on desktop.
- [ ] Floating cart button: 50px on mobile, 54px on desktop.

### Accessibility
- [ ] All buttons have `aria-label`.
- [ ] Modal: Esc closes; focus moves to primary button on open.
- [ ] Cart drawer: Esc closes; body scroll locked when open.
- [ ] Selectors: keyboard-accessible (Tab + arrow keys).
- [ ] Flash messages: visible without screen reader (visual only — not announced).

---

## 7. Configuration Points

All config lives in `src/types/menu.ts` → `CART_CONFIG`:

```ts
export const CART_CONFIG = {
  maxQuantityPerLine: 50,    // Max qty per cart line
  maxLines: 30,              // Max distinct lines per cart
  minWeightGrams: 250,       // Min selectable weight
  weightStepGrams: 250,      // Weight increment
  maxWeightGrams: 5000,      // Max selectable weight (5 kg)
}
```

Menu notice modal storage:
- `src/components/menu/MenuNoticeModal.tsx` → `STORAGE_TYPE` (default `'sessionStorage'`).
- Change to `'localStorage'` to persist acknowledgement across sessions.

---

## 8. Future Module Hooks

The architecture is designed so Module 3 (Checkout & Payment) can plug in without changes:

- `CartTotals` already has reserved fields: `taxesPaise`, `deliveryFeePaise`, `discountPaise`, `grandTotalPaise`.
- `calculateCartTotals()` already computes grand total = subtotal + taxes + delivery - discount.
- `cart-service.ts` exposes `getCart(userId)` which the Checkout module can call to read final cart state before payment.
- The CartDrawer's "Continue to Checkout" button is disabled but ready — Module 3 just needs to enable it and route to `/checkout`.
- Database `cart_items` table has all metadata needed for order creation (item_id, variant_id, weight_grams, piece_count, unit_price_paise, quantity).

---

## 9. Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Menu readability improved without changing visual identity | ✅ |
| "Handi Mutton (Half)" removed | ✅ |
| "Handi Mutton" no longer shows "(Full Mutton)" | ✅ |
| Weight-based items calculate prices for any supported weight | ✅ |
| Piece-based items show plate price + per-piece price | ✅ |
| Only logged-in users can add items | ✅ |
| Guests get clear login prompt | ✅ |
| Users can update, remove, clear items | ✅ |
| Pricing calculated consistently + validated server-side | ✅ |
| Menu notice popup behaves as specified | ✅ |
| WhatsApp ordering fully removed | ✅ |
| Secure, scalable, documented, ready for Checkout module | ✅ |
