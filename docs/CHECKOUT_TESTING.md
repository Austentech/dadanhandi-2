# Checkout Testing Checklist

Manual test cases for the Phase 2 Module 3 Checkout & Payment system. Work through each test case before declaring the module production-ready.

> **Prerequisites**
> - Stripe CLI running: `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
> - Test cards available: <https://stripe.com/docs/testing>
> - SQL migration 004 applied to Supabase
> - Auth system working (Module 1)
> - Cart system working (Module 2)

---

## A. Checkout Flow

### A.1 — Happy Path (Logged-in user, successful payment)

**Steps:**
1. Log in with a test account
2. Add 2–3 items to plate (mix of weight + piece + fixed)
3. Open cart drawer → click "Continue to Checkout"
4. Verify redirected to `/checkout`
5. Verify Step 1 shows all items with correct prices
6. Click "Continue"
7. Verify Step 2 shows 4 branches as cards
8. Click a branch → "Continue"
9. Verify Step 3 shows today's date + time slots
10. Select a future slot → "Continue"
11. Verify Step 4 shows donation options + reward balance (0 if new user)
12. Click "Continue"
13. Verify validation runs (spinner)
14. Verify Step 5 shows Stripe Payment Element
15. Enter card `4242 4242 4242 4242`, future expiry, any CVC
16. Click "Pay ₹X"
17. Verify Step 6 shows "Confirming Your Payment…"
18. Wait for webhook (1–3 seconds)
19. Verify success page shows: order number, branch, pickup time, items, total, reward points earned
20. Click "Order More" → verify redirected to `/menu`
21. Verify cart is cleared (plate count = 0)

**Expected:** Order created in DB with `order_status = 'confirmed'`, `payment_status = 'succeeded'`. Reward points credited if conditions met.

---

### A.2 — Empty Cart

**Steps:**
1. Log in
2. Empty cart (or remove all items)
3. Navigate to `/checkout` directly via URL
4. Verify Step 1 shows "Your plate is empty" message
5. Verify "Browse Menu" button works

**Expected:** No way to proceed past Step 1 with empty cart.

---

### A.3 — Unauthenticated User

**Steps:**
1. Log out
2. Navigate to `/checkout` directly via URL
3. Verify "Please Log In to Continue" message
4. Verify "Back to Menu" button works

**Expected:** No checkout possible without auth.

---

## B. Branch Selection

### B.1 — Branch Required

**Steps:**
1. Reach Step 2
2. Click "Continue" without selecting a branch
3. Verify error: "Please select a pickup branch to continue."

**Expected:** Cannot proceed without selecting a branch.

### B.2 — Branch Selection Visual

**Steps:**
1. On Step 2, click a branch
2. Verify it gets a red border + checkmark icon
3. Click a different branch
4. Verify the first one deselects, second one selects

**Expected:** Exactly one branch selected at any time.

### B.3 — Closed Branch Display

**Steps:**
1. Test outside operating hours (e.g., 9 AM or 11 PM IST)
2. Verify branch cards show "Currently closed · Opens at 10:00 AM" badge

**Expected:** Branches show closed status, but selection still allowed (user can pre-order for when branch opens).

---

## C. Time Slot Validation

### C.1 — Past Slots Disabled

**Steps:**
1. Reach Step 3 at any time after 10:00 AM IST
2. Verify all slots whose start time has passed are visually disabled (strikethrough, reduced opacity)
3. Try to click a disabled slot
4. Verify it cannot be selected

**Expected:** Only future slots are selectable.

### C.2 — Restaurant Closed

**Steps:**
1. Reach Step 3 outside operating hours (before 10 AM or after 10 PM IST)
2. Verify "We're currently closed" notice is shown
3. Verify "Continue" button is disabled

**Expected:** Cannot proceed with checkout when restaurant is closed.

### C.3 — Slot Required

**Steps:**
1. Reach Step 3
2. Click "Continue" without selecting a slot
3. Verify error: "Please select a pickup time to continue."

**Expected:** Cannot proceed without selecting a slot.

### C.4 — Slot Auto-Refresh

**Steps:**
1. Reach Step 3
2. Wait 60 seconds
3. Verify the slots refresh (a slot that just passed becomes disabled)

**Expected:** Slots stay current even if user lingers on the page.

---

## D. Donation Selection

### D.1 — Both Donations Selected

**Steps:**
1. Reach Step 4
2. Click both donation checkboxes
3. Verify both show as selected (mustard border + checkmark)
4. Click "Continue"
5. Verify validation succeeds
6. Verify summary shows "+₹15 Donations"

**Expected:** Both donations can be selected together; total updates correctly.

### D.2 — No Donations

**Steps:**
1. Reach Step 4
2. Don't select any donation
3. Click "Continue"
4. Verify validation succeeds
5. Verify summary shows no donation line

**Expected:** Donations are optional.

### D.3 — Donation Toggle

**Steps:**
1. Select Plantation donation
2. Verify checkbox shows check
3. Click again
4. Verify checkbox clears

**Expected:** Donations can be toggled on/off freely.

---

## E. Reward Earning

### E.1 — Earn 5 Points (Qualifying Order)

**Steps:**
1. Add items to plate totaling > ₹500 (e.g., 1 kg Handi Mutton = ₹1,100)
2. Reach Step 4
3. Select Plantation donation (₹5)
4. Verify "🎉 You'll earn 5 reward points" message appears
5. Complete the order with successful payment
6. Check Supabase `reward_transactions` table → verify row with `type='earn'`, `points=5`
7. Check `reward_balance` → balance increased by 5

**Expected:** 5 points awarded when subtotal > ₹500 AND plantation donation selected.

### E.2 — No Points (Subtotal ≤ ₹500)

**Steps:**
1. Add items totaling ≤ ₹500 (e.g., 250 gm Handi Mutton = ₹275)
2. Reach Step 4
3. Select Plantation donation
4. Verify "Earn 5 reward points by selecting Plantation donation with a subtotal above ₹500" message (no 🎉)
5. Complete the order
6. Verify no earn transaction in DB

**Expected:** No points earned when subtotal ≤ ₹500.

### E.3 — No Points (No Plantation Donation)

**Steps:**
1. Add items totaling > ₹500
2. Reach Step 4
3. Do NOT select Plantation donation
4. Verify no 🎉 message
5. Complete the order
6. Verify no earn transaction in DB

**Expected:** No points earned without plantation donation, even if subtotal > ₹500.

---

## F. Reward Redemption

### F.1 — Successful Redemption

**Steps:**
1. Use an account with ≥ 20 reward points (run test E.1 multiple times)
2. Reach Step 4
3. Enter "20" in the points input (or click "20" quick button)
4. Verify discount shows "−₹10"
5. Click "Continue"
6. Verify validation succeeds
7. Verify summary shows "Reward discount (20 pts): −₹10"
8. Complete the order
9. Check `reward_transactions` → row with `type='redeem'`, `points=-20`
10. Check `reward_balance` → balance decreased by 20

**Expected:** 20 points redeemed → ₹10 discount applied.

### F.2 — Insufficient Points

**Steps:**
1. Use an account with 5 reward points
2. Reach Step 4
3. Try to enter "20" in the points input
4. Verify input clamps to 0 (since balance < 10)
5. Verify "20" quick button is disabled

**Expected:** Cannot redeem more points than available.

### F.3 — Non-Multiple-of-10

**Steps:**
1. Reach Step 4 with 25 points balance
2. Type "25" in the points input
3. Verify it gets clamped to 20

**Expected:** Only multiples of 10 are allowed.

### F.4 — Points Restored on Payment Failure

**Steps:**
1. Use an account with 30 reward points
2. Reach Step 4
3. Redeem 20 points
4. Complete Step 5 with a failing card (`4000 0000 0000 0002`)
5. Verify Step 6 shows "Payment Failed"
6. Check `reward_transactions` → row with `type='restore'`, `points=+20`
7. Check `reward_balance` → balance back to 30

**Expected:** Redeemed points automatically restored when payment fails.

---

## G. Stripe Payment Success

### G.1 — Successful Card Payment

**Steps:**
1. Reach Step 5
2. Enter card `4242 4242 4242 4242`, expiry `12/34`, CVC `123`
3. Click "Pay"
4. Verify processing spinner appears on button
5. Verify Step 6 appears within 5 seconds
6. Verify success view with all order details

**Expected:** Payment succeeds; order confirmed via webhook.

### G.2 — Successful UPI Payment

**Steps:**
1. Reach Step 5
2. Select UPI tab in Payment Element
3. Enter UPI ID `success@stripe`
4. Click "Pay"
5. Verify success

**Expected:** UPI payment succeeds.

### G.3 — 3DS Authentication

**Steps:**
1. Reach Step 5
2. Enter card `4000 0027 6000 3184` (triggers 3DS)
3. Click "Pay"
4. Verify Stripe's 3DS modal appears
5. Complete the 3DS authentication
6. Verify success

**Expected:** 3DS authentication flow works end-to-end.

---

## H. Stripe Payment Failure

### H.1 — Card Declined

**Steps:**
1. Reach Step 5
2. Enter card `4000 0000 0000 0002` (generic decline)
3. Click "Pay"
4. Verify error message appears in Step 5
5. Verify user stays on Step 5 (cart + order preserved)
6. Verify a different card can be tried without restarting

**Expected:** Failed payment does not lose cart; user can retry.

### H.2 — Insufficient Funds

**Steps:**
1. Reach Step 5
2. Enter card `4000 0000 0000 9995`
3. Click "Pay"
4. Verify failure message

**Expected:** Specific failure reason shown; cart preserved.

### H.3 — Webhook Restores Points on Failure

**Steps:**
1. Reach Step 4 with 30 points, redeem 20
2. Reach Step 5
3. Pay with declining card
4. After failure, navigate back to menu
5. Reach Step 4 again on a new checkout
6. Verify reward balance is back to 30 (points restored)

**Expected:** Points restored automatically via webhook.

---

## I. Duplicate Payment Protection

### I.1 — Double-Click Pay Button

**Steps:**
1. Reach Step 5
2. Click "Pay" button rapidly 3 times
3. Verify button is disabled after first click
4. Check Stripe dashboard → only ONE PaymentIntent confirmation

**Expected:** Only one payment is processed.

### I.2 — Browser Refresh During Payment

**Steps:**
1. Reach Step 5
2. Click "Pay"
3. Immediately refresh the page (F5)
4. Verify checkout page reloads
5. Check Stripe dashboard → confirm whether payment completed
6. If completed: webhook should mark order as confirmed
7. If not completed: user can retry with a fresh idempotency key

**Expected:** No duplicate orders created.

### I.3 — Multiple Tabs

**Steps:**
1. Open `/checkout` in two browser tabs
2. Complete checkout in Tab 1
3. Switch to Tab 2 — verify it has its own idempotency key (separate order)

**Expected:** Each tab is an independent checkout; no cross-contamination.

### I.4 — Duplicate Webhook Delivery

**Steps:**
1. Complete a successful payment
2. Note the order ID
3. Via Stripe CLI: `stripe trigger payment_intent.succeeded` (this sends a generic event, not yours — but tests dedup)
4. Check `processed_webhook_events` table → unique event IDs only

**Expected:** Duplicate webhook events are silently ignored.

---

## J. Webhook Verification

### J.1 — Valid Signature

**Steps:**
1. Complete a payment
2. Check server logs for `[STRIPE WEBHOOK] Order ... confirmed. Points earned: ...`

**Expected:** Webhook processed successfully.

### J.2 — Invalid Signature

**Steps:**
1. Send a POST to `/api/stripe/webhook` with invalid signature (curl)
2. Verify 400 response
3. Check server logs for `[STRIPE WEBHOOK] Signature verification failed`

**Expected:** Invalid signatures rejected; no order state changes.

### J.3 — Webhook Secret Not Set

**Steps:**
1. Temporarily remove `STRIPE_WEBHOOK_SECRET` from `.env.local`
2. Try to complete a payment
3. Verify webhook fails to verify (server log: "Webhook secret not configured")
4. Verify order stays in `awaiting_payment` state
5. Restore the env var

**Expected:** Graceful failure; order is not incorrectly marked as confirmed.

---

## K. Cart Persistence

### K.1 — Cart Cleared on Success

**Steps:**
1. Complete a successful payment
2. Verify plate count badge shows 0
3. Check Supabase `cart_items` table → no rows for this user

**Expected:** Cart cleared atomically inside the webhook's `mark_order_succeeded` RPC.

### K.2 — Cart Preserved on Failure

**Steps:**
1. Fail a payment
2. Verify plate count badge still shows items
3. Check `cart_items` table → items still present

**Expected:** Cart preserved on failure; user can retry.

### K.3 — Cart Preserved on Cancellation

**Steps:**
1. Reach Step 5
2. Click "Back" to Step 4
3. Navigate away from checkout (click "Back to Menu" on Step 1)
4. Verify cart is still populated

**Expected:** Cart preserved across navigation.

---

## L. Responsive Layout

### L.1 — Mobile (375px width)

**Steps:**
1. Open Chrome DevTools → Toggle device toolbar → iPhone SE (375px)
2. Walk through the entire checkout flow
3. Verify:
   - Progress indicator labels are hidden (just numbers + checkmarks)
   - Branch cards stack vertically
   - Slot grid shows 2 columns
   - Donation cards stack vertically
   - Nav buttons stack vertically (Back on top, Continue below)
   - Stripe Payment Element is fully visible and usable
   - Confirmation card is readable

**Expected:** Full flow works on mobile.

### L.2 — Tablet (768px width)

**Steps:**
1. Set viewport to 768px (iPad)
2. Walk through flow
3. Verify:
   - Branch cards in 2-column grid
   - Slot grid in 3 columns
   - Donation cards in 2-column grid

**Expected:** Layout adapts to tablet.

### L.3 — Desktop (1280px+)

**Steps:**
1. Set viewport to 1280px
2. Walk through flow
3. Verify:
   - All grids use maximum columns
   - Progress indicator shows labels
   - Cards have generous padding

**Expected:** Desktop layout is clean and readable.

---

## M. Validation Failures

### M.1 — Modified Subtotal (Client Tampering)

**Steps:**
1. Open browser DevTools
2. Add items to cart
3. Use DevTools to modify the cart store's `subtotalPaise` value
4. Try to validate checkout
5. Verify server recalculates subtotal from scratch — tampered value is ignored

**Expected:** Server is source of truth; client tampering has no effect.

### M.2 — Invalid Branch Slug

**Steps:**
1. Use curl to POST to `/api/checkout/validate` with `branchSlug: "invalid-slug"`
2. Verify 400 response with "Invalid branch slug format" or "Please select a valid pickup branch."

**Expected:** Invalid slugs rejected.

### M.3 — Invalid Slot Key

**Steps:**
1. POST to `/api/checkout/validate` with `pickupSlotKey: "99:99-99:99"`
2. Verify 400 response

**Expected:** Malformed slot keys rejected at Zod validation layer.

### M.4 — Past Pickup Date

**Steps:**
1. Try to create an order with a past pickup date (this requires tampering since UI only allows today)
2. Verify server rejects (the slot would be marked `disabled` and validation fails)

**Expected:** Past dates impossible to submit.

### M.5 — Reward Points Not Multiple of 10

**Steps:**
1. POST to `/api/checkout/validate` with `rewardPointsToRedeem: 15`
2. Verify 400 response with "Points must be a multiple of 10."

**Expected:** Non-multiples of 10 rejected.

### M.6 — Redeem More Than Balance

**Steps:**
1. User has 10 reward points
2. POST to `/api/checkout/validate` with `rewardPointsToRedeem: 100`
3. Verify 400 response with "Insufficient reward points. You have 10 points."

**Expected:** Over-redemption rejected.

---

## N. Security Edge Cases

### N.1 — Accessing Another User's Order

**Steps:**
1. User A creates an order
2. Log in as User B
3. Try `GET /api/checkout/order/[User-A-Order-Id]`
4. Verify 404 response ("Order not found")

**Expected:** RLS prevents cross-user access.

### N.2 — Directly Mutating Reward Balance

**Steps:**
1. Use Supabase client to try: `supabase.from('reward_balance').update({ balance_points: 999999 }).eq('user_id', ...)`
2. Verify RLS blocks the update (no insert/update/delete policies)

**Expected:** Direct table mutations blocked; only SECURITY DEFINER RPCs can modify balance.

### N.3 — Directly Creating an Order

**Steps:**
1. Use Supabase client to try: `supabase.from('orders').insert({...})`
2. Verify RLS allows it only if `user_id = auth.uid()` (the insert policy)
3. Try to insert with someone else's user_id → blocked

**Expected:** Users can only create their own orders. Even so, the create_draft_order RPC is the only sanctioned path.

### N.4 — Stripe Secret Key Not Exposed

**Steps:**
1. Open browser DevTools → Network tab
2. Walk through checkout
3. Search all network requests for "sk_"
4. Verify no request contains the secret key

**Expected:** Only the publishable key (`pk_...`) is sent to the client.

### N.5 — Webhook Replay Attack

**Steps:**
1. Capture a webhook payload (e.g., via Stripe CLI logs)
2. Replay the same request multiple times with the same event ID
3. Verify only the first request is processed; subsequent ones return success but are no-ops

**Expected:** Idempotent webhook processing via `processed_webhook_events` table.

### N.6 — Error Messages Don't Leak Internals

**Steps:**
1. Force various errors (invalid card, network failure, etc.)
2. Inspect all error responses
3. Verify no error message contains: stack traces, file paths, Stripe internal errors, DB errors, server IDs

**Expected:** All error messages are user-friendly and generic.

---

## O. Performance

### O.1 — Page Load Time

**Steps:**
1. Open Chrome DevTools → Network tab
2. Navigate to `/checkout`
3. Verify initial page load < 2 seconds on broadband
4. Verify no unnecessary API calls (config, branches, slots, balance should be one-time fetches)

**Expected:** Fast initial load; minimal network chatter.

### O.2 — Polling Efficiency

**Steps:**
1. Complete a payment
2. Watch network tab on Step 6
3. Verify polling happens every 2 seconds
4. Verify polling stops once `orderStatus === 'confirmed'` or `'failed'`
5. Verify polling times out after 60 seconds

**Expected:** No runaway polling.

---

## P. Accessibility

### P.1 — Keyboard Navigation

**Steps:**
1. Open `/checkout`
2. Use only Tab/Shift+Tab/Enter/Space/Esc to navigate the entire flow
3. Verify every interactive element is reachable via keyboard
4. Verify focus is visible on all elements

**Expected:** Full keyboard accessibility.

### P.2 — Screen Reader

**Steps:**
1. Enable VoiceOver (Mac) or NVDA (Windows)
2. Walk through the checkout flow
3. Verify:
   - Progress indicator announces step changes
   - Branch cards announce as radio buttons
   - Slot grid announces as radio group
   - Donation cards announce as checkboxes
   - Form labels are read correctly
   - Error messages are announced via `role="alert"`

**Expected:** Screen reader compatible.

### P.3 — Color Contrast

**Steps:**
1. Use Chrome DevTools → Lighthouse → Accessibility audit
2. Verify no contrast violations
3. Verify all interactive elements have visible focus indicators

**Expected:** WCAG AA compliant.

---

## Q. SQL Migration Verification

### Q.1 — Tables Created

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'branches', 'orders', 'order_items', 'payments',
  'reward_transactions', 'reward_balance', 'processed_webhook_events'
);
```

Expected: 7 rows returned.

### Q.2 — RLS Enabled

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'branches', 'orders', 'order_items', 'payments',
  'reward_transactions', 'reward_balance', 'processed_webhook_events'
);
```

Expected: All have `rowsecurity = true`.

### Q.3 — Branches Seeded

```sql
SELECT slug, name, city, state FROM public.branches ORDER BY sort_order;
```

Expected: 4 rows — danapur, rajeev-nagar, arraah, ranchi.

### Q.4 — RPCs Exist

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_branches', 'get_branch_by_slug',
  'get_reward_balance', 'preview_reward_redemption',
  'create_draft_order', 'attach_payment_intent_to_order',
  'mark_order_succeeded', 'mark_order_failed',
  'get_order_for_user', 'cancel_draft_order',
  'get_recent_orders_for_user', 'generate_order_number'
);
```

Expected: 12 rows returned.

---

## Sign-off

Once ALL test cases pass:

- [ ] All A through Q sections verified
- [ ] SQL migration applied to production Supabase
- [ ] Stripe webhook endpoint configured in production
- [ ] Environment variables set in production hosting
- [ ] Smoke test with real (small) payment completed
- [ ] Refund flow tested via Stripe dashboard

Module 3 is production-ready.
