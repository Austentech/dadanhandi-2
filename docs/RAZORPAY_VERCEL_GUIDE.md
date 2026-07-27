# Razorpay + Vercel Testing & Deployment Guide
## Dadan Handi Mutton Hotel — Checkout & Payment System

> **For whom:** Developers who do NOT run code locally. You write code → push to GitHub → Vercel auto-deploys → you test on the Vercel URL.
>
> **Why Razorpay (not Stripe)?** Stripe India is invite-only and rejected our application. Razorpay is the leading Indian payment gateway — instant onboarding, native UPI, no invite needed, RBI-regulated.
>
> **First time setting up a payment gateway?** This guide walks you through everything step-by-step.

---

## 📋 Your Workflow (Big Picture)

```
┌─────────────┐    git push     ┌──────────┐   auto-deploy   ┌──────────────────┐
│  Write code │ ───────────────▶│  GitHub  │ ───────────────▶│  Vercel Preview  │
└─────────────┘                 └──────────┘                 │  (test URL)      │
                                                            └────────┬─────────┘
                                                                     │ user pays
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Razorpay Modal  │
                                                            │  (UPI/Card/etc)  │
                                                            └────────┬─────────┘
                                                                     │ payment_id + signature
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Vercel API      │
                                                            │  /api/checkout/  │
                                                            │  verify-payment  │
                                                            └────────┬─────────┘
                                                                     │ verify HMAC signature
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  Supabase DB     │
                                                            │  order confirmed │
                                                            └──────────────────┘
```

## ⚡ Why Razorpay is SIMPLER than Stripe

| Aspect | Stripe (old) | Razorpay (new) |
|---|---|---|
| **Webhook required?** | ✅ Yes (or polling) | ❌ No — client-side verify is enough |
| **Onboarding** | Invite-only in India ❌ | Instant signup ✅ |
| **UPI support** | Via dashboard config | Native, no setup needed |
| **Client-side form** | Embedded Stripe Elements | Modal popup (simpler) |
| **Secret to manage** | `client_secret` per payment | Just `order_id` (no secret) |
| **Verification** | Webhook signature | HMAC signature (client → server) |
| **Setup time** | 1-2 hours | 15-30 minutes |

**The magic of Razorpay:** When the user pays, Razorpay returns a cryptographic signature that ONLY Razorpay can produce (using your `key_secret`). Your server verifies this signature — no webhook needed. The user sees instant confirmation.

---

## 🗂️ What You'll Need (Accounts & Tools)

- [ ] **GitHub account** (you have this)
- [ ] **Vercel account** (sign up at https://vercel.com with GitHub)
- [ ] **Supabase project** (already set up from Modules 1 & 2)
- [ ] **Razorpay account** (we'll create this in Step 1 — instant signup)
- [ ] **PAN card + bank account** (for going LIVE — not needed for testing)
- [ ] A **credit/debit card** for the final ₹10 real-money smoke test (Step 8)

---

# 🚀 PHASE 1 — Razorpay Account Setup (One-Time, ~10 min)

## Step 1.1 — Create Your Razorpay Account

1. Go to **https://razorpay.com/** → click **Sign Up** (top right)
2. Fill in:
   - **Work Email**: your business email
   - **Password**: strong password
   - **Country**: India (auto-selected)
3. Click **Create Account**
4. Verify your email (check inbox, click "Verify Email")
5. You'll be taken to the Razorpay Dashboard at https://dashboard.razorpay.com/

> ✅ **That's it!** No approval wait. Test mode works IMMEDIATELY.

## Step 1.2 — Switch to TEST Mode

1. In the Razorpay dashboard, top-left corner — find the **"Test Mode"** toggle
2. Make sure it's **ON** (you'll see a yellow "Test Mode" indicator)
3. While in Test Mode, you can use Razorpay's test cards and UPI IDs — no real money changes hands

> ⚠️ **Important:** Don't switch to Live Mode until Phase 8 (going live). Test Mode is your testing ground.

## Step 1.3 — Generate Your API Keys

1. In Razorpay Dashboard → click **Settings** (gear icon, bottom-left)
2. Click **API Keys** → **Generate Test Key**
3. You'll see TWO keys:
   - **Key ID**: `RAZORPAY_TEST_KEY_PLACEHOLDER` (safe to expose to browser)
   - **Key Secret**: a long string (SERVER-ONLY, never expose to browser, never commit to git)
4. **COPY BOTH** — Razorpay will NOT show the Key Secret again after you close this window
5. Save them somewhere safe temporarily (we'll paste them into Vercel env vars in Phase 3)

> 🔒 **SECURITY RULES (read carefully):**
> - **Key ID** (`rzp_test_...`) is SAFE to expose in browser code. Vercel env var name: `NEXT_PUBLIC_RAZORPAY_KEY_ID`
> - **Key Secret** is **like a password**. NEVER commit to git. NEVER put in any `NEXT_PUBLIC_*` variable. Only used in server-side API routes.
> - **Webhook Secret** (we'll get this in Phase 5) — same security rules as the Key Secret.

## Step 1.4 — Enable Payment Methods (Optional, defaults are usually fine)

Razorpay enables all standard Indian payment methods (UPI, Cards, Netbanking, Wallets) by default. But let's verify:

1. Razorpay Dashboard → **Settings** → **Payment Methods**
2. Verify these are enabled:
   - **UPI** (default ON) — PhonePe, GPay, Paytm, BHIM
   - **Cards** (default ON) — Credit, Debit, RuPay
   - **Netbanking** (default ON) — all major Indian banks
   - **Wallets** (default ON) — Paytm, Mobikwik, etc.
3. If anything is disabled, click the toggle to enable it

> ✅ Unlike Stripe, you don't need to configure each payment method separately for India. Razorpay handles this automatically.

---

# 🗄️ PHASE 2 — Supabase Database Setup (One-Time, ~5 min)

You need to apply the SQL migration that creates all checkout tables (orders, payments, rewards, branches, etc.). The migration has been updated to use Razorpay column names (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`).

## Step 2.1 — Open Supabase SQL Editor

1. Go to **https://supabase.com/dashboard** → click your project
2. Left sidebar → **SQL Editor** → **New query**

## Step 2.2 — Apply Migration 004 (Checkout Tables)

1. In your code, open: `supabase/migrations/004_create_checkout_payment_rewards.sql`
2. **Copy the entire file contents** (Ctrl+A → Ctrl+C)
3. Paste into Supabase SQL Editor (the new query window)
4. Click **Run** (Ctrl+Enter or the green Run button)
5. Wait — it should say "Success. No rows returned."

## Step 2.3 — Verify Tables Were Created

In a new SQL Editor tab, paste and run:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'branches', 'orders', 'order_items', 'payments',
  'reward_transactions', 'reward_balance', 'processed_webhook_events'
);
```

**Expected:** 7 rows returned.

## Step 2.4 — Verify 4 Branches Seeded

```sql
SELECT slug, name, city, state FROM public.branches ORDER BY sort_order;
```

**Expected:** 4 rows — danapur, rajeev-nagar, arraah, ranchi.

## Step 2.5 — Verify Razorpay Columns Exist

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
AND column_name LIKE 'razorpay%';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payments'
AND column_name LIKE 'razorpay%';
```

**Expected:**
- `orders` table: 1 row (`razorpay_order_id`)
- `payments` table: 3 rows (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`)

## Step 2.6 — Get Your Supabase Keys

1. Supabase Dashboard → **Project Settings** (gear icon, bottom-left) → **API**
2. Copy these three values:
   - **Project URL**: `https://YOUR-PROJECT-ref.supabase.co`
   - **anon public** key: `eyJhbGciOi...` (long string)
   - **service_role** key: click "Reveal" → `eyJhbGciOi...` (longer string)

---

# ⚙️ PHASE 3 — Vercel Project Setup & Environment Variables (~10 min)

## Step 3.1 — Connect Your GitHub Repo to Vercel (if not already done)

1. Go to **https://vercel.com** → sign in with GitHub
2. Click **Add New → Project**
3. Find your `dadanhandihotel` repo → click **Import**
4. Framework preset: **Next.js** (auto-detected)
5. Leave build settings as default
6. Click **Deploy** — first build may fail because env vars aren't set, that's OK

## Step 3.2 — Open Environment Variables Settings

1. In Vercel Dashboard → click your project
2. Top tabs → **Settings** → **Environment Variables**
3. You'll see three environments:
   - **Production** (your live site, after merge to `main`)
   - **Preview** (auto-generated URLs for each PR/branch)
   - **Development** (skip — you don't run `vercel dev`)

## Step 3.3 — Add These Environment Variables

For each variable:
- Click **Add New**
- Type the **Name** and **Value**
- Tick the checkboxes for **both Production AND Preview** environments
- Click **Save**

### Supabase Variables

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT-ref.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (anon public) | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (service_role) | Production + Preview |

### Razorpay Variables (TEST MODE)

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `RAZORPAY_TEST_KEY_PLACEHOLDER` | Production + Preview |
| `RAZORPAY_KEY_ID` | `RAZORPAY_TEST_KEY_PLACEHOLDER` (same as above) | Production + Preview |
| `RAZORPAY_KEY_SECRET` | (your key_secret from Step 1.3) | Production + Preview |
| `RAZORPAY_WEBHOOK_SECRET` | (leave empty for now — we'll add it in Phase 5) | — |

> 💡 **Note on duplicate Key ID:** We set BOTH `NEXT_PUBLIC_RAZORPAY_KEY_ID` (used by client-side Checkout.js) AND `RAZORPAY_KEY_ID` (used by server-side SDK). They're the SAME value — but Next.js only exposes `NEXT_PUBLIC_*` vars to the browser. The server uses the non-prefixed one for clarity.

### Application Variables

| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` (your Vercel production URL) | Production + Preview |

## Step 3.4 — Redeploy to Apply Env Vars

After adding all env vars:
1. Go to **Deployments** tab
2. Find the latest deployment → click the **"..."** menu → **Redeploy**
3. Wait for build to complete (~2-3 minutes)
4. Click **Visit** to open your preview URL

---

# 🌐 PHASE 4 — First Deploy & Sanity Check (~5 min)

## Step 4.1 — Visit Your Preview URL

Open: `https://your-project-git-your-branch.vercel.app`

## Step 4.2 — Test Auth + Cart

1. Click **Login** → enter your phone number → enter OTP
2. Go to **Menu** → add 2-3 items to your plate
3. Click the plate icon (top right) → verify cart drawer opens

## Step 4.3 — Hit the Checkout Config Endpoint

In your browser, visit:
```
https://your-preview-url.vercel.app/api/checkout/config
```

You should see JSON with:
```json
{
  "success": true,
  "data": {
    "razorpayKeyId": "rzp_test_...",
    ...
  }
}
```

> ✅ If `razorpayKeyId` shows `rzp_test_...` — env vars are correctly set.
> ❌ If `razorpayKeyId` is `null` — your `RAZORPAY_KEY_ID` env var isn't set. Re-check Step 3.3.

## Step 4.4 — Hit the Branches Endpoint

```
https://your-preview-url.vercel.app/api/branches
```

Should return 4 branches. If empty, migration 004 didn't run (return to Phase 2).

---

# 🧪 PHASE 5 — Full End-to-End Testing (~30 min)

**The best part about Razorpay:** You don't need to set up a webhook to test payments. The signature verification on the client → server flow is enough. Webhooks are OPTIONAL (we'll cover them in Phase 6 as a resilience enhancement).

## Step 5.1 — Razorpay Test Cards (Save These)

Use these on the Razorpay Checkout modal (when it opens):

### Successful payments

| Card Number | Method | Result |
|---|---|---|
| `4111 1111 1111 1111` | Visa Credit Card | ✅ Success |
| `5241 0000 0000 0006` | Mastercard Credit | ✅ Success |
| `6011 0000 0000 0004` | Discover Credit | ✅ Success |
| `4111 1111 1111 1111` | Visa Debit Card | ✅ Success |

**For all test cards, use:**
- **Expiry:** Any future date (e.g., `12/34`)
- **CVV:** Any 3 digits (e.g., `123`)
- **Name on card:** Any name

### Failed payments (test error handling)

| Card Number | Result |
|---|---|
| `4111 1111 1111 1112` | ❌ Invalid card number |
| `4000 0000 0000 0002` | ❌ Card declined |
| `5104 0000 0000 0016` | ❌ Insufficient funds |

### Test UPI IDs

| UPI ID | Result |
|---|---|
| `success@razorpay` | ✅ Success |
| `failure@razorpay` | ❌ Failure |

> **UPI simulation note:** Razorpay's UPI test mode works differently — you'll see a UPI intent flow. Just use the test UPI ID above to simulate.

---

## Step 5.2 — Walk Through the Happy Path (Successful Payment)

On your Vercel preview URL:

1. **Login** with a test account (phone + OTP)
2. Go to **Menu** → add 2-3 items:
   - e.g., 500gm Handi Mutton
   - e.g., 2x Piece item
   - e.g., 1x Fixed item
3. Click **Plate icon** (top right) → **Continue to Checkout**
4. You're redirected to `/checkout` — **Step 1: Review Plate**
   - ✅ Verify all items show with correct prices and weights
5. Click **Continue** → **Step 2: Select Branch**
   - ✅ Verify 4 branches appear as cards
   - Click a branch → it highlights with red border + checkmark
6. Click **Continue** → **Step 3: Pickup Time**
   - ✅ Today's date appears at top
   - ✅ Time slots show from 10 AM to 10 PM
   - ✅ Past slots are visually disabled
   - Select a future slot
7. Click **Continue** → **Step 4: Donation & Rewards**
   - ✅ See two donation cards
   - ✅ See your reward balance (0 if new user)
   - Toggle Plantation donation ON
8. Click **Continue** → **Step 5: Payment**
   - ✅ Spinner briefly shows "Preparing your secure payment…"
   - ✅ Three payment method preview cards appear (UPI, Card, Netbanking)
   - ✅ "Pay ₹X" button is enabled
9. Click **Pay ₹X**
   - ✅ Razorpay Checkout modal opens (full screen on mobile, popup on desktop)
   - ✅ Modal shows the brand name "Dadan Handi Mutton Hotel" + logo
   - ✅ Modal shows multiple payment tabs (UPI, Cards, Netbanking, Wallets)
10. **In the Razorpay modal**, choose **Cards** tab and enter:
    - Card Number: `4111 1111 1111 1111`
    - Expiry: `12/34`
    - CVV: `123`
    - Name: `Test User`
11. Click **Pay** in the Razorpay modal
12. Within 2-5 seconds:
    - ✅ Razorpay modal closes
    - ✅ Toast appears: "Payment Successful! Your order has been confirmed."
    - ✅ Step 6 (Confirmation) appears with:
      - Order number (e.g., `DHM-2026-001234`)
      - Branch name
      - Pickup time
      - Items list
      - Total paid
      - Reward points earned (if applicable)

> 🎉 **If you reached here — congratulations!** Your entire Razorpay checkout flow works.

## Step 5.3 — Verify in Razorpay Dashboard

1. Go to Razorpay Dashboard (Test Mode) → **Transactions** → **Payments**
2. You should see a payment entry matching the amount you paid
3. Click the payment → see:
   - Status: **Captured**
   - Method: Card (or UPI)
   - Order ID: `order_NqjXcXxXxXxXxX`
   - Notes (you'll see your `internal_order_id` and `internal_order_number`)

## Step 5.4 — Verify in Supabase Database

1. Supabase Dashboard → **Table Editor** → **orders**
2. Find your order (most recent row) — verify:
   - `order_status` = `confirmed`
   - `payment_status` = `succeeded`
   - `razorpay_order_id` = (matches the ID from Razorpay dashboard)
3. Go to **Table Editor → payments** — verify:
   - `razorpay_order_id` = (same as above)
   - `razorpay_payment_id` = (e.g., `pay_NqjXcXxXxXxXxX`)
   - `razorpay_signature` = (long hex string)
   - `status` = `succeeded`
4. Go to **Table Editor → order_items** — verify items match your cart

## Step 5.5 — Verify Cart Was Cleared

1. Go back to your site
2. Click the plate icon → verify cart is EMPTY
3. Supabase → **Table Editor → cart_items** → verify no rows for your user

## Step 5.6 — Test Failed Payment

1. Repeat the checkout flow to reach Step 5 again
2. Click **Pay ₹X** to open Razorpay modal
3. This time, enter a **declining card**: `4000 0000 0000 0002`
4. Click **Pay** in the modal
5. Within 2 seconds:
   - ✅ Razorpay shows "Payment Failed" message
   - ✅ Modal closes (or shows retry option)
   - ✅ Toast appears: "Payment Failed: Card declined"
   - ✅ You stay on Step 5 (can retry with a different card)
6. Verify:
   - Cart is NOT cleared (items still in plate)
   - Order in Supabase has `order_status = 'failed'`, `payment_status = 'failed'`
7. Try the success card again → it should work

## Step 5.7 — Test Reward Points Earning

1. Add items totaling MORE than ₹500 (e.g., 1 kg Handi Mutton = ₹1,100)
2. Reach Step 4 → select **Plantation donation (₹5)**
3. ✅ Verify "🎉 You'll earn 5 reward points" message appears
4. Complete the order with the success card
5. Check Supabase → **reward_transactions** → verify a row with `type = 'earn'`, `points = 5`
6. Check Supabase → **reward_balance** → balance increased by 5

## Step 5.8 — Test Reward Points Redemption

(Requires you to have ≥ 10 points — run Step 5.7 a couple times, or manually insert points via Supabase SQL Editor:)

```sql
-- Give yourself 50 points for testing
-- Replace YOUR-USER-UUID-HERE with your user's UUID
-- (Find it in Supabase → Authentication → Users)

INSERT INTO public.reward_balance (user_id, balance_points, total_earned, total_redeemed)
VALUES ('YOUR-USER-UUID-HERE', 50, 50, 0)
ON CONFLICT (user_id) DO UPDATE
SET balance_points = 50, total_earned = 50;
```

Then:
1. Add items to cart → reach Step 4
2. ✅ Verify balance shows "50 points"
3. Type "20" in the points input → verify discount shows "−₹10"
4. Complete the order
5. Verify in Supabase:
   - `reward_transactions` → row with `type = 'redeem'`, `points = -20`
   - `reward_balance` → balance = 30 (50 − 20)

## Step 5.9 — Test Reward Points Restoration on Payment Failure

1. With remaining 30 points, add items to cart
2. Reach Step 4 → redeem 20 points (visible balance should drop to 10)
3. Reach Step 5 → use the **DECLINE card** (`4000 0000 0000 0002`)
4. After failure, check Supabase:
   - `reward_transactions` → row with `type = 'restore'`, `points = +20`
   - `reward_balance` → balance back to 30 (points restored)

## Step 5.10 — Test UPI Payment

1. Reach Step 5 → click **Pay ₹X**
2. In Razorpay modal, choose **UPI** tab
3. Enter UPI ID: `success@razorpay`
4. Click **Pay**
5. ✅ Verify success (Razorpay simulates the UPI payment instantly in test mode)

## Step 5.11 — Test Duplicate Click Protection

1. Reach Step 5 with the success card
2. **Click the "Pay" button rapidly 3-4 times**
3. Verify:
   - Button gets disabled after first click (spinner shows "Processing…")
   - Only ONE order is created in Supabase
   - Only ONE payment shows in Razorpay Dashboard

## Step 5.12 — Test Empty Cart & Unauthenticated Access

1. **Empty cart**: Log out → log back in → empty cart → visit `/checkout` directly
   - ✅ Should show "Your plate is empty" with "Browse Menu" button
2. **No auth**: Log out → visit `/checkout` directly
   - ✅ Should show "Please Log In to Continue" with "Back to Menu" button

---

# 🔔 PHASE 6 — Optional: Razorpay Webhook (Resilience Layer, ~10 min)

The webhook is OPTIONAL — your checkout already works without it. But adding it provides an important safety net:

**Why add a webhook?**
- If a user closes their browser between Razorpay modal success and the `verify-payment` API call, the payment succeeds but our DB isn't updated
- The webhook catches this case — Razorpay retries for up to ~3 days
- Both paths call the same `mark_order_succeeded` RPC (idempotent — no double-confirmation)

## Step 6.1 — Note Your Vercel Webhook URL

Your webhook endpoint (already coded) lives at:
```
https://your-preview-url.vercel.app/api/razorpay/webhook
```

## Step 6.2 — Create the Webhook in Razorpay

1. Razorpay Dashboard (Test Mode) → **Settings** → **Webhooks**
2. Click **Add New Webhook**
3. Fill in:
   - **Webhook URL**: `https://your-preview-url.vercel.app/api/razorpay/webhook`
   - **Secret**: Type a strong random string (e.g., `dadanhandi_whsec_xyz789abc123`)
     - **Save this secret** — we'll add it to Vercel env vars
   - **Alert Email**: your email (for webhook failure alerts)
4. Under **Events**, select these:
   - `payment.captured` (when payment succeeds)
   - `payment.failed` (when payment fails)
   - `refund.processed` (optional — for future refunds)
5. Click **Create Webhook**

## Step 6.3 — Add Webhook Secret to Vercel

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Click **Add New**
3. **Name**: `RAZORPAY_WEBHOOK_SECRET`
4. **Value**: (the secret you set in Step 6.2)
5. Tick **Production** and **Preview**
6. Click **Save**
7. **Redeploy** your project

## Step 6.4 — Test the Webhook

1. Razorpay Dashboard → **Settings** → **Webhooks** → your endpoint
2. Click **Send Test Event** (or just complete a payment)
3. Verify the webhook is delivered with `200 OK` status
4. Check Vercel logs: Deployments → latest preview → **Logs** tab → search for `RAZORPAY WEBHOOK`

> ✅ If you see `[RAZORPAY WEBHOOK] Order ... confirmed via webhook` in Vercel logs — webhook works!

---

# 🔍 PHASE 7 — Debugging & Monitoring

## Step 7.1 — View Vercel Function Logs (Your Best Friend)

Whenever something doesn't work, **check the Vercel logs FIRST**.

1. Vercel Dashboard → your project → **Deployments**
2. Click the **latest preview deploy**
3. Click the **Logs** tab
4. Filter by **All Functions** or specifically `api/checkout/verify-payment` or `api/razorpay/webhook`
5. Look for these log lines:
   - `[PAYMENT SERVICE] ...` — Razorpay SDK errors
   - `[VERIFY PAYMENT] ...` — Signature verification issues
   - `[RAZORPAY WEBHOOK] ...` — Webhook events
   - `[ORDER SERVICE] ...` — Database RPC errors

## Step 7.2 — View Razorpay Dashboard Logs

1. Razorpay Dashboard → **Transactions** → **Payments** → see all payment attempts
2. Click any payment → see full details + timeline
3. Razorpay Dashboard → **Settings** → **API Keys** → **API Logs** (last 7 days of API calls your server made)

## Step 7.3 — View Webhook Delivery History

1. Razorpay Dashboard → **Settings** → **Webhooks** → your endpoint
2. Click **View All Webhooks** (or similar)
3. Each webhook event shows:
   - Event type (e.g., `payment.captured`)
   - Status: `200 OK`, `400`, `500`, `Pending`
   - Attempt count (if Razorpay is retrying)
   - Timestamp
4. Click an event → see the **full payload** + **your server's response**

---

# 🚢 PHASE 8 — Going Live (Production) (~30 min + Razorpay KYC time)

> ⚠️ **Only start this phase AFTER all Phase 5 tests pass.**

## Step 8.1 — Complete Razorpay Account Activation (KYC)

1. Razorpay Dashboard → top-left → toggle **Test Mode OFF** (now in Live Mode)
2. Razorpay will prompt you to **Activate Account**
3. Click **Activate Account** → complete KYC:
   - **Business type**: Sole Proprietor / Private Limited / Partnership
   - **Business name**: Dadan Handi Mutton Hotel
   - **PAN number**: Your business PAN (or personal PAN for sole proprietor)
   - **Bank account**: Indian bank account (preferred in business name)
   - **Business address**: restaurant address
   - **Business category**: Food & Beverage / Restaurants
   - **Website**: https://dadanhandihotel.com (or your Vercel URL)
4. Submit → Razorpay reviews (usually instant or within a few hours for India)
5. You'll get an email when activated

> ✅ **Razorpay India KYC is faster than Stripe.** Most accounts are activated within minutes.

## Step 8.2 — Generate LIVE Mode API Keys

1. After activation, in Razorpay Dashboard (Live Mode — toggle top-left)
2. Go to **Settings → API Keys** → **Generate Live Key**
3. Copy:
   - **Key ID**: `RAZORPAY_LIVE_KEY_PLACEHOLDER`
   - **Key Secret**: (long string — save it now, won't be shown again)

## Step 8.3 — Create LIVE Mode Webhook Endpoint (Optional but Recommended)

1. Razorpay Dashboard (Live Mode) → **Settings → Webhooks**
2. Click **Add New Webhook**
3. **Webhook URL**: `https://dadanhandihotel.com/api/razorpay/webhook` (your production URL)
4. **Secret**: a NEW strong random string (different from test mode)
5. **Events**: same as test mode (`payment.captured`, `payment.failed`)
6. Click **Create Webhook**
7. Copy the LIVE webhook secret

> ⚠️ **Note:** Live mode webhook secrets are DIFFERENT from test mode. You need a separate endpoint for live mode.

## Step 8.4 — Update Vercel Environment Variables for Production

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. For the **Production** environment only, update these four:

| Name | New Value (Production only) |
|---|---|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `RAZORPAY_LIVE_KEY_PLACEHOLDER` |
| `RAZORPAY_KEY_ID` | `RAZORPAY_LIVE_KEY_PLACEHOLDER` (same as above) |
| `RAZORPAY_KEY_SECRET` | (your LIVE key_secret) |
| `RAZORPAY_WEBHOOK_SECRET` | (LIVE webhook secret from Step 8.3) |

> **How to update only Production:** When editing a variable, Vercel shows checkboxes for which environments to update. Tick ONLY **Production**. Leave Preview alone (so preview deploys keep using test keys for ongoing testing).

3. After updating, click **Save**

## Step 8.5 — Set Your Production Domain (Optional but Recommended)

If you have a custom domain (`dadanhandihotel.com`):
1. Vercel Dashboard → your project → **Settings → Domains**
2. Add your domain → follow DNS instructions
3. Update `NEXT_PUBLIC_SITE_URL` in Production env vars to `https://dadanhandihotel.com`

## Step 8.6 — Deploy to Production

1. Merge your feature branch to `main` on GitHub (or push to `main` directly)
2. Vercel auto-detects the push → builds → deploys to **Production**
3. Watch the build in Vercel Dashboard → Deployments → wait for "Ready" status

## Step 8.7 — Verify Production Webhook Works

1. After deploy completes, visit: `https://dadanhandihotel.com/api/checkout/config`
2. Verify `razorpayKeyId` shows `rzp_live_...` (not `rzp_test_...`)
3. Go to Razorpay Dashboard → Webhooks → your LIVE endpoint
4. Click **Send Test Event** → `payment.captured`
5. Verify status `200 OK`

## Step 8.8 — Real-Money Smoke Test (CRITICAL)

1. On your **production site**, log in
2. Add a cheap item to cart (smallest amount)
3. Walk through checkout
4. On Step 5, use your **REAL credit/debit card** (or UPI)
5. Pay the small amount
6. Verify:
   - Step 6 shows confirmation
   - Payment appears in Razorpay Dashboard → **Transactions → Payments** (with real money)
   - Order appears in Supabase → `orders` table with `payment_status = 'succeeded'`
   - Cart cleared

> ✅ The money will be deposited to your bank account within 2-7 business days (Razorpay's payout schedule, T+2 for India).

## Step 8.9 — Test Refund Flow (Optional)

1. In Razorpay Dashboard → **Transactions → Payments** → find your smoke test payment
2. Click **Refund** → enter full amount → **Refund**
3. Wait 2-5 seconds
4. Check Supabase → `payments` table → status updated to `refunded` (if webhook processed `refund.processed`)
5. Verify the refund appears in your bank statement within 5-10 business days

---

# 🆘 Troubleshooting (Common Issues)

## "Payment system is not configured" error on Step 5

**Cause:** `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` env var is missing on Vercel.

**Fix:**
1. Vercel → Settings → Environment Variables
2. Verify `RAZORPAY_KEY_ID` (starts with `rzp_test_` or `rzp_live_`) is set
3. Verify `RAZORPAY_KEY_SECRET` is set
4. Verify both are checked for the **Preview** environment (if testing on preview URL)
5. **Redeploy** (env var changes need a redeploy)

## Razorpay Checkout modal doesn't open

**Cause:** `NEXT_PUBLIC_RAZORPAY_KEY_ID` not set, OR the Razorpay script failed to load.

**Debug:**
1. Open browser DevTools (F12) → Console tab
2. Look for errors like "Razorpay is not defined" or "Failed to load script"
3. Check Network tab → look for `checkout.razorpay.com/v1/checkout.js`
4. Verify `/api/checkout/config` returns `razorpayKeyId` (not `null`)

**Fix:**
- Add `NEXT_PUBLIC_RAZORPAY_KEY_ID` env var in Vercel
- Redeploy

## "Payment verification failed" after successful payment

**Cause:** `RAZORPAY_KEY_SECRET` on the server doesn't match the Key ID used by the client.

**Fix:**
1. Razorpay Dashboard → Settings → API Keys → copy both Key ID and Key Secret fresh
2. Vercel → Settings → Environment Variables → update BOTH:
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (= Key ID)
   - `RAZORPAY_KEY_ID` (= same Key ID)
   - `RAZORPAY_KEY_SECRET` (= Key Secret)
3. **Redeploy**

## Payment succeeds but order stays in "awaiting_payment"

**Cause:** The verify-payment API call failed (network error, server error), OR the webhook isn't configured.

**Debug:**
1. Vercel → Deployments → latest → Logs → search for `[VERIFY PAYMENT]`
2. If no verify-payment log → the client didn't call the endpoint (network issue?)
3. If verify-payment log shows error → check the error message
4. If you set up the webhook (Phase 6), check `[RAZORPAY WEBHOOK]` logs

**Manual recovery:** If you see a payment in Razorpay dashboard but the order is still `awaiting_payment`, you can manually mark it confirmed via Supabase SQL Editor:

```sql
-- Replace with your order ID and payment details
SELECT * FROM public.mark_order_succeeded(
  p_order_id := 'YOUR-ORDER-UUID',
  p_razorpay_payment_id := 'pay_xxx_from_razorpay_dashboard',
  p_razorpay_signature := 'manual_recovery_no_signature',
  p_webhook_event_id := 'manual-recovery-' || extract(epoch from now())::text,
  p_event_type := 'manual_recovery',
  p_raw_payload := '{"reason":"manual recovery from dashboard"}'::jsonb
);
```

## Razorpay error: "Amount must be at least 100"

**Cause:** Razorpay's minimum amount for INR is 100 paise (₹1). Your cart total is less than ₹1.

**Fix:**
- This shouldn't happen with real menu items (all are > ₹100)
- If it does, the user has a very small cart — show a friendly error: "Minimum order amount is ₹1"

## UPI not showing in Razorpay Checkout modal

**Cause:** UPI is disabled in your Razorpay dashboard, OR account country isn't India.

**Fix:**
1. Razorpay Dashboard → Settings → Payment Methods
2. Verify UPI is enabled
3. Verify account country is India (Dashboard → Account Settings → Business Details)

## "Invalid API key" error in Vercel logs

**Cause:** Wrong key format, OR you mixed test and live keys.

**Fix:**
- Test mode: keys start with `rzp_test_` (Key ID) + a string secret
- Live mode: keys start with `rzp_live_` (Key ID) + a string secret
- Make sure the Key ID and Key Secret are from the SAME mode (both test OR both live)

## Build fails on Vercel

**Cause:** Various — most common are TypeScript errors or missing env vars at build time.

**Fix:**
1. Vercel Dashboard → Deployments → click the failed deploy → **Build Logs**
2. Scroll to find the error (red text)
3. Common errors:
   - `Cannot find module 'razorpay'` → check `package.json` includes razorpay, run `bun install` and commit `bun.lock`
   - TypeScript error → fix in code, push again

## Webhook works in test mode but fails in production

**Cause:** You're using test webhook secret in production env vars.

**Fix:**
1. Razorpay Dashboard → toggle to **Live mode** (top-left)
2. Settings → Webhooks → your LIVE endpoint → copy LIVE signing secret
3. Vercel → Settings → Environment Variables → `RAZORPAY_WEBHOOK_SECRET` → update for **Production** environment only
4. Redeploy

---

# 📞 Quick Reference Cheatsheet

## Environment Variables Master List

| Variable | Where to Get It | Test Mode Value | Live Mode Value |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | `https://xxx.supabase.co` | (same) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | `eyJ...` | (same) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → Reveal | `eyJ...` | (same) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay → Settings → API Keys | `rzp_test_...` | `rzp_live_...` |
| `RAZORPAY_KEY_ID` | (same as above — duplicated for server use) | `rzp_test_...` | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys → Reveal | (string) | (string) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay → Settings → Webhooks → your endpoint | (string) | (string, DIFFERENT) |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL | `https://project.vercel.app` | `https://dadanhandihotel.com` |

## Test Cards (Save These!)

| Card Number | Result |
|---|---|
| `4111 1111 1111 1111` | ✅ Success (Visa) |
| `5241 0000 0000 0006` | ✅ Success (Mastercard) |
| `4000 0000 0000 0002` | ❌ Declined |
| `5104 0000 0000 0016` | ❌ Insufficient funds |

**For all cards:** expiry `12/34`, CVV `123`

## Test UPI IDs

| UPI ID | Result |
|---|---|
| `success@razorpay` | ✅ Success |
| `failure@razorpay` | ❌ Failure |

## API Endpoints to Verify (visit in browser)

| Endpoint | What It Returns | Expected |
|---|---|---|
| `/api/checkout/config` | Checkout config + Razorpay key_id | JSON with `razorpayKeyId: "rzp_test_..."` |
| `/api/branches` | 4 branches | JSON with 4 items |
| `/api/checkout/pickup-slots` | Today's time slots | JSON with slots |
| `/api/rewards/balance` | User's reward points (requires auth) | JSON with `balance: 0` (for new users) |

## Razorpay Dashboard URLs

| What | URL |
|---|---|
| Dashboard (Test) | https://dashboard.razorpay.com/app/ |
| API Keys (Test) | https://dashboard.razorpay.com/app/settings/apikeys |
| API Keys (Live) | https://dashboard.razorpay.com/app/settings/apikeys (toggle Live mode) |
| Webhooks (Test) | https://dashboard.razorpay.com/app/settings/webhooks |
| Payments (Test) | https://dashboard.razorpay.com/app/payments |
| Payment Methods | https://dashboard.razorpay.com/app/settings/payment_methods |
| API Logs | https://dashboard.razorpay.com/app/apilogs |

## Supabase Dashboard URLs

| What | URL |
|---|---|
| SQL Editor | https://supabase.com/dashboard/project/_/sql/new |
| Table Editor | https://supabase.com/dashboard/project/_/editor |
| API Settings (keys) | https://supabase.com/dashboard/project/_/settings/api |
| Authentication → Users | https://supabase.com/dashboard/project/_/auth/users |

## Vercel Dashboard URLs

| What | URL |
|---|---|
| Project Deployments | https://vercel.com/dashboard → click project |
| Environment Variables | Project → Settings → Environment Variables |
| Domains | Project → Settings → Domains |
| Deployment Logs | Project → Deployments → click deploy → Logs |

---

# 🏗️ Architecture Summary

```
                          ┌─────────────────────────┐
                          │  User's Browser          │
                          │  (Razorpay Checkout.js)  │
                          └────────────┬─────────────┘
                                       │ razorpay_payment_id
                                       │ razorpay_order_id
                                       │ razorpay_signature
                                       ▼
                          ┌─────────────────────────┐
                          │  Vercel: /api/checkout/ │
                          │  verify-payment         │
                          │  (PRIMARY path)         │
                          └────────────┬─────────────┘
                                       │ HMAC SHA256 verify
                                       │ (timing-safe compare)
                                       ▼
                          ┌─────────────────────────┐
                          │  Supabase RPC:           │
                          │  mark_order_succeeded    │
                          │  (idempotent)            │
                          └────────────┬─────────────┘
                                       │ award points + clear cart
                                       ▼
                                       ✅ Confirmed

        OPTIONAL (resilience):

   Razorpay ──webhook──► /api/razorpay/webhook ──► same RPC (idempotent)
```

---

# ✅ Final Pre-Launch Checklist

Before announcing to customers, verify ALL of these:

## Razorpay Side
- [ ] Account activated (KYC complete)
- [ ] Live API keys obtained (`rzp_live_...` + secret)
- [ ] Live webhook endpoint created pointing to production URL
- [ ] Live webhook signing secret obtained
- [ ] Test smoke payment completed and refunded

## Vercel Side
- [ ] Production env vars updated with LIVE Razorpay keys
- [ ] Preview env vars still using TEST Razorpay keys (for ongoing dev)
- [ ] Custom domain configured (optional but recommended)
- [ ] Latest deploy is "Ready" with no build errors
- [ ] `/api/checkout/config` returns `rzp_live_...` on production URL

## Supabase Side
- [ ] Migration 004 applied to production Supabase
- [ ] 4 branches seeded
- [ ] All RLS policies active
- [ ] All RPCs created (`create_draft_order`, `attach_razorpay_order_to_order`, `mark_order_succeeded`, `mark_order_failed`, etc.)

## Code Side
- [ ] No `console.log` of sensitive data (Razorpay secrets, user PII)
- [ ] All API routes return generic errors (no stack traces to client)
- [ ] Rate limiting active on `/api/checkout/*` and `/api/razorpay/webhook`
- [ ] Signature verification working (no `400` errors on verify-payment)

## Functional Tests (in production)
- [ ] Login works
- [ ] Add to cart works
- [ ] Checkout 6-step flow works end-to-end
- [ ] Real card payment succeeds (smoke test with ₹10)
- [ ] Order appears in Supabase `orders` table
- [ ] Cart clears after successful payment
- [ ] Failed payment preserves cart
- [ ] Reward points awarded on qualifying order
- [ ] Reward points redeemable for discount
- [ ] UPI payment succeeds
- [ ] Webhook received (Razorpay Dashboard → Webhooks → 200 OK)

---

## 📚 Further Reading

- **Razorpay Docs**: https://razorpay.com/docs
- **Razorpay Standard Checkout**: https://razorpay.com/docs/payments/checkout-amount-integration/
- **Razorpay Webhooks**: https://razorpay.com/docs/webhooks/
- **Razorpay Test Cards**: https://razorpay.com/docs/payments/payments/test-card-upi-network/
- **Razorpay India UPI**: https://razorpay.com/payments/upi
- **Razorpay API Reference**: https://razorpay.com/docs/api
- **Vercel Environment Variables**: https://vercel.com/docs/projects/environment-variables
- **Vercel Deployment Logs**: https://vercel.com/docs/observability/runtime-logs
- **Supabase RLS**: https://supabase.com/docs/guides/auth/row-level-security
- **Next.js App Router**: https://nextjs.org/docs/app

---

## 🆘 When You're Stuck

If something breaks and you can't figure it out:

1. **Check Vercel logs first** — `Deployments → latest → Logs`
2. **Check Razorpay payment history** — `Transactions → Payments`
3. **Check Razorpay webhook delivery** — `Settings → Webhooks → your endpoint`
4. **Check Supabase tables** — `Table Editor → orders / payments / reward_transactions`
5. **Re-read the relevant section above** — most issues are covered in Troubleshooting

You've got this! 💪
