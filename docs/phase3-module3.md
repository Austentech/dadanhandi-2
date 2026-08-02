# Phase 3 – Module 3: Intelligent Order Queue & Branch Communication

## Overview

This module implements a **Preparation Window Scheduling** system that controls which orders appear in the admin queue based on their pickup time proximity. Orders only become visible when they enter the configurable preparation window, keeping the kitchen focused on immediate work.

---

## Architecture

### Preparation Window

```
Current Time: 12:00 PM   |   Window: 1 hour (configurable)
                           |
                           v
              Visible Orders: 12 PM – 1 PM slots
              Hidden Orders: 2 PM, 3 PM, 6 PM, 8 PM slots
```

**Configuration**: `ADMIN_CONFIG.PREPARATION_WINDOW_HOURS` in `src/lib/admin/config.ts`
- Default: `1` (hour)
- Change to `2` or `3` to widen the window — zero code changes needed elsewhere

### Order Visibility Flow

```
Customer places order → payment succeeds → order_status='confirmed'
                                                    ↓
                                    pickup_slot_start compared to [now, now + window]
                                                    ↓
                                    ┌─ WITHIN window → Visible in New Orders queue
                                    └─ AFTER window  → Counted as "Upcoming" on Dashboard
                                                    ↓
                              (When window advances, order automatically appears)
```

### Server-Side Enforcement

All visibility filtering happens on the **server** (API routes), never the client. The client device clock is never trusted.

---

## Files Created / Modified

### New Files

| File | Purpose |
|------|---------|
| `src/services/admin/admin-scheduling-service.ts` | Reusable order visibility engine. Computes preparation window bounds in IST. Pure functions for testing. |
| `src/lib/admin/branch-contacts.ts` | Centralized branch manager contact directory. Single source of truth for all admin views. |
| `supabase/migrations/008_admin_order_statuses.sql` | Extends `order_status` constraint to include `accepted`, `preparing`, `ready_for_pickup`, `completed`. Adds `service_role` RLS policies. |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/admin/config.ts` | Added `PREPARATION_WINDOW_HOURS: 1` and `RATE_LIMITS.DASHBOARD / ORDERS_LIST` |
| `src/services/admin/admin-order-service.ts` | Dashboard stats now split pending/upcoming by preparation window. List orders applies window filter for `confirmed` status. Orders sorted by `pickup_slot_start` ASC. |
| `src/app/admin/dashboard/page.tsx` | Renamed "Pending" → "Current Queue" (with subtitle). Added "Upcoming Orders" as a main stat card. Reorganized quick info. |
| `src/app/admin/orders/new/page.tsx` | Added branch manager contact row with click-to-call. Added payment method badge. Auto-refresh every 60s. Updated subtitle. |
| `src/app/api/admin/dashboard/route.ts` | Uses centralized rate limit config. |
| `src/app/api/admin/orders/list/route.ts` | Uses centralized rate limit config. |
| `src/app/globals.css` | Added `.admin-branch-contact-*`, `.admin-payment-method-badge`, `.admin-stat-subtitle`, `.admin-stat-icon.orange` styles + responsive rules. |

---

## Database Usage

### Queries (all use service_role client, bypassing RLS)

**Dashboard Stats** (parallel queries):
- `orders` WHERE `order_status != 'draft'` AND `created_at >= today_start` → Today's Orders
- `orders` WHERE `order_status = 'confirmed' AND payment_status = 'succeeded' AND pickup_date = today AND pickup_slot_start IN [window]` → Pending (Current Queue)
- `orders` WHERE `order_status = 'confirmed' AND payment_status = 'succeeded' AND pickup_date = today AND pickup_slot_start > window_end` → Upcoming
- Individual counts for accepted, preparing, ready_for_pickup, completed, cancelled

**List Orders (New Orders page):**
- `orders` JOIN `order_items` JOIN `branches` WHERE `order_status = 'confirmed' AND payment_status = 'succeeded' AND pickup_date = today AND pickup_slot_start IN [window]
- Then JOIN `profiles` for customer names
- Sorted by `pickup_slot_start ASC` (soonest pickup first)

### Indexed Columns Used
- `order_status` (idx_orders_order_status)
- `payment_status` (idx_orders_payment_status)
- `pickup_date` (via order_status + payment_status composite access)
- `pickup_slot_start` (filtered via gte/lte on TIME column)
- `created_at` (default PK index)

---

## Branch Contact Configuration

Managed in `src/lib/admin/branch-contacts.ts`:

| Branch | Manager Phone |
|--------|--------------|
| Danapur | +91 11223 34455 |
| Rajeev Nagar | +91 22334 45566 |
| Arrah | +91 33445 56677 |
| Ranchi | +91 44556 67788 |

**To update**: Edit ONLY `BRANCH_CONTACTS` in that file. All order cards read from it.

---

## Security

- Every endpoint protected by `validateAdminRequest` (session + rate limit)
- Rate limits from centralized config (DASHBOARD: 60/min, ORDERS_LIST: 120/min)
- Preparation window computed server-side — client timestamps never trusted
- No order IDs, statuses, or branch values accepted from client for visibility filtering
- Accept Order: validates payment_status, current order_status, race condition guard
- Error responses: generic messages, no stack traces or SQL errors

---

## Realtime Updates

- Dashboard: Subscribes to ALL changes on `orders` table → refetches stats
- New Orders: Subscribes to INSERT/UPDATE on `orders` → refetches list
- Auto-refresh every 60 seconds on New Orders page (catches preparation window advancement)

---

## Testing Checklist

### Order Visibility
- [ ] At 12:00 PM, order with 12:30 PM pickup slot IS visible
- [ ] At 12:00 PM, order with 2:00 PM pickup slot is NOT visible
- [ ] At 12:50 PM, order with 2:00 PM pickup slot becomes visible (within 1-hour window)
- [ ] Order with `payment_status = 'pending'` is NEVER visible regardless of slot
- [ ] Changing `PREPARATION_WINDOW_HOURS` from 1 to 2 immediately shows more orders

### Dashboard
- [ ] "Current Queue" shows only in-window confirmed + paid orders
- [ ] "Upcoming Orders" shows only after-window confirmed + paid orders
- [ ] "Current Queue + Upcoming" = total confirmed paid orders for today
- [ ] Stats update in real-time when order status changes
- [ ] Stats update when new order is placed

### New Orders Page
- [ ] Orders sorted by pickup time (soonest first)
- [ ] Each card shows: Order ID, Customer Name, WhatsApp, Branch, Manager Contact, Pickup Date/Time, Items, Total, Payment Status, Payment Method, Donations, Rewards
- [ ] Branch manager phone is clickable (tel: link)
- [ ] Clicking phone on mobile initiates a call
- [ ] Accept button works and removes order from list
- [ ] Dashboard refreshes after accept
- [ ] Search filters by order number and customer name
- [ ] Refresh button reloads orders

### Branch Contacts
- [ ] Danapur shows +91 11223 34455
- [ ] Rajeev Nagar shows +91 22334 45566
- [ ] Arrah shows +91 33445 56677
- [ ] Ranchi shows +91 44556 67788
- [ ] Unknown branch slug shows no manager contact row

### Responsive Design
- [ ] Dashboard: 4→2→1 column stat grid at 1024/768/480px
- [ ] Order cards: 2-column → 1-column at 768px
- [ ] Order card footer stacks vertically on mobile
- [ ] Branch contact text goes horizontal on small mobile
- [ ] Search bar goes full-width on mobile
- [ ] No horizontal scrolling at any breakpoint
- [ ] Touch-friendly button sizes on mobile

### Security
- [ ] Unauthenticated access to /admin/orders/new redirects to login
- [ ] /api/admin/orders/list returns 401 without session
- [ ] /api/admin/dashboard returns 401 without session
- [ ] Rate limiting blocks excessive requests
- [ ] No SQL errors or stack traces in API responses

### Error Handling
- [ ] Network error shows friendly message
- [ ] Failed API shows "Try Again" button
- [ ] Accept failure shows alert with server message

---

## Future Extension Notes

- **Ongoing Orders page**: Will use `status='accepted'|'preparing'|'ready_for_pickup'` from the same service
- **Preparation window per branch**: Config could become `Record<branchSlug, hours>` if needed
- **Branch contacts from DB**: Currently in code config; can migrate to `public.branches` columns when needed
- **Pickup PIN**: Reserved column `pickup_pin` already exists on orders table
