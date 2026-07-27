# Checkout API Reference

All endpoints require an authenticated Supabase session (cookie-based). Requests without a session return `401 Unauthorized`.

All money values are **integer paise** (1 INR = 100 paise). Never use floats for money.

All request bodies are JSON. All responses are JSON with the shape `{ success, message, data? }`.

---

## Endpoints

### 1. `GET /api/checkout/config`

Returns client-side configuration: Stripe publishable key, reward rules, donation amounts, pickup hours, step names.

**Auth:** Not required (public).

**Response:**
```json
{
  "success": true,
  "message": "Checkout config loaded.",
  "data": {
    "stripePublishableKey": "pk_test_...",
    "reward": {
      "earnPointsPerQualifyingOrder": 5,
      "earnThresholdPaise": 50000,
      "earnRequiredDonationPaise": 500,
      "minRedeemPoints": 10,
      "redeemStepPoints": 10,
      "discountPerStepPaise": 500
    },
    "donation": {
      "plantationPaise": 500,
      "hungerPaise": 1000
    },
    "pickup": {
      "timezone": "Asia/Kolkata",
      "openingHour": 10,
      "closingHour": 22,
      "slotIntervalMinutes": 60
    },
    "checkout": {
      "totalSteps": 6,
      "stepNames": ["Review Plate", "Select Branch", "Select Pickup Time", "Donation & Rewards", "Payment", "Confirmation"],
      "maxCustomerNotesLength": 500,
      "currency": "inr"
    }
  }
}
```

---

### 2. `GET /api/branches`

List all active pickup branches.

**Auth:** Required.

**Response:**
```json
{
  "success": true,
  "message": "Branches loaded.",
  "data": {
    "branches": [
      {
        "id": "uuid",
        "slug": "danapur",
        "name": "Danapur Branch",
        "addressLine1": "Saguna Khagaul Road, Kaliket Nagar, Danapur",
        "addressLine2": "Patna, Bihar",
        "city": "Patna",
        "state": "Bihar",
        "pincode": "801105",
        "latitude": null,
        "longitude": null,
        "openingTime": "10:00:00",
        "closingTime": "22:00:00",
        "status": "active",
        "sortOrder": 1
      }
      // ... 3 more branches
    ]
  }
}
```

---

### 3. `GET /api/checkout/pickup-slots`

Returns today's available pickup time slots. Slots that have already passed are marked `disabled: true`.

**Auth:** Required.

**Response:**
```json
{
  "success": true,
  "message": "Pickup slots loaded.",
  "data": {
    "date": "2026-07-27",
    "isRestaurantOpen": true,
    "slots": [
      {
        "key": "10:00-11:00",
        "startTime": "10:00",
        "endTime": "11:00",
        "label": "10:00 AM – 11:00 AM",
        "shortLabel": "10:00 AM",
        "disabled": true,
        "disabledReason": "This slot has already passed"
      },
      {
        "key": "11:00-12:00",
        "startTime": "11:00",
        "endTime": "12:00",
        "label": "11:00 AM – 12:00 PM",
        "shortLabel": "11:00 AM",
        "disabled": false
      }
      // ... more slots up to 22:00
    ]
  }
}
```

---

### 4. `GET /api/rewards/balance`

Get the authenticated user's reward point balance.

**Auth:** Required.

**Response:**
```json
{
  "success": true,
  "message": "Reward balance loaded.",
  "data": {
    "balancePoints": 35,
    "totalEarned": 50,
    "totalRedeemed": 15
  }
}
```

---

### 5. `POST /api/rewards/preview-redemption`

Preview the discount a user would get for redeeming N points. Does NOT deduct points.

**Auth:** Required.

**Request Body:**
```json
{
  "points": 20
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Redemption preview loaded.",
  "data": {
    "points": 20,
    "discountPaise": 1000,
    "balanceAfter": 15
  }
}
```

**Response (invalid input):**
```json
{
  "success": false,
  "message": "Points must be a multiple of 10."
}
```

**Response (insufficient balance):**
```json
{
  "success": false,
  "message": "Insufficient points. You have 5 points."
}
```

---

### 6. `POST /api/checkout/validate`

Validate the entire checkout payload and return the server-computed final amount. Does NOT create an order or charge the user.

**Auth:** Required.

**Request Body:**
```json
{
  "branchSlug": "danapur",
  "pickupSlotKey": "14:00-15:00",
  "donations": {
    "plantation": true,
    "hunger": false
  },
  "rewardPointsToRedeem": 20
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Checkout validated.",
  "data": {
    "subtotalPaise": 165000,
    "donationPlantationPaise": 500,
    "donationHungerPaise": 0,
    "rewardPointsRedeemed": 20,
    "rewardDiscountPaise": 1000,
    "finalAmountPaise": 164500,
    "potentialPointsToEarn": 5,
    "rewardBalance": 30,
    "branch": {
      "id": "uuid",
      "slug": "danapur",
      "name": "Danapur Branch",
      "addressLine1": "Saguna Khagaul Road, Kaliket Nagar, Danapur",
      "addressLine2": "Patna, Bihar",
      "city": "Patna",
      "state": "Bihar"
    },
    "pickupSlot": {
      "key": "14:00-15:00",
      "startTime": "14:00",
      "endTime": "15:00",
      "label": "2:00 PM – 3:00 PM",
      "shortLabel": "2:00 PM",
      "disabled": false
    }
  }
}
```

**Response (validation failure):**
```json
{
  "success": false,
  "message": "This time slot has already passed. Please choose a later time."
}
```

---

### 7. `POST /api/checkout/create-order`

Create a draft order + Stripe PaymentIntent. Atomic: order creation + reward point deduction happen in a single DB transaction.

**Auth:** Required.

**Rate limit:** 5 requests per minute per user+IP (stricter than validate).

**Request Body:**
```json
{
  "branchSlug": "danapur",
  "pickupSlotKey": "14:00-15:00",
  "donations": {
    "plantation": true,
    "hunger": false
  },
  "rewardPointsToRedeem": 20,
  "customerNotes": "Please pack the curry separately.",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Order created. Please complete payment.",
  "data": {
    "orderId": "uuid",
    "orderNumber": "DHM-20260727-00001",
    "clientSecret": "pi_xxx_secret_xxx",
    "amountPaise": 164500,
    "currency": "inr",
    "finalAmountPaise": 164500,
    "orderStatus": "awaiting_payment"
  }
}
```

**Response (idempotency conflict — same key, fresh attempt):**
```json
{
  "success": true,
  "message": "Checkout already in progress.",
  "data": {
    "orderId": "uuid",
    "orderNumber": "DHM-20260727-00001",
    "clientSecret": null,
    "amountPaise": 164500,
    "currency": "inr",
    "finalAmountPaise": 164500,
    "orderStatus": "awaiting_payment",
    "stripePaymentIntentId": "pi_xxx"
  }
}
```

**Response (idempotency conflict — order already confirmed):**
```json
{
  "success": true,
  "message": "Order already completed.",
  "data": {
    "orderId": "uuid",
    "orderNumber": "DHM-20260727-00001",
    "clientSecret": null,
    "amountPaise": 164500,
    "currency": "inr",
    "finalAmountPaise": 164500,
    "orderStatus": "confirmed"
  }
}
```

**Response (previous attempt failed):**
```json
{
  "success": false,
  "message": "Previous checkout attempt failed. Please start a new checkout."
}
```

---

### 8. `GET /api/checkout/order/[id]`

Get the full order (header + items + branch snapshot). Used by the confirmation page to poll for payment status.

**Auth:** Required. Only the order's owner can fetch it.

**Rate limit:** 60 requests per minute per IP (generous — polling endpoint).

**Response:**
```json
{
  "success": true,
  "message": "Order loaded.",
  "data": {
    "order": {
      "id": "uuid",
      "orderNumber": "DHM-20260727-00001",
      "userId": "uuid",
      "branchId": "uuid",
      "pickupDate": "2026-07-27",
      "pickupSlotStart": "14:00:00",
      "pickupSlotEnd": "15:00:00",
      "subtotalPaise": 165000,
      "donationPlantationPaise": 500,
      "donationHungerPaise": 0,
      "rewardPointsRedeemed": 20,
      "rewardDiscountPaise": 1000,
      "finalAmountPaise": 164500,
      "rewardPointsEarned": 5,
      "paymentStatus": "succeeded",
      "orderStatus": "confirmed",
      "stripePaymentIntentId": "pi_xxx",
      "customerNotes": "Please pack the curry separately.",
      "createdAt": "2026-07-27T08:30:00.000Z",
      "updatedAt": "2026-07-27T08:31:15.000Z",
      "items": [
        {
          "lineKey": "handi-mutton--handi-mutton--500gm",
          "itemId": "handi-mutton",
          "variantId": "handi-mutton--500gm",
          "itemName": "Handi Mutton",
          "itemEmoji": "🍲",
          "itemType": "weight",
          "variantLabel": "500 gm",
          "weightGrams": 500,
          "pieceCount": null,
          "unitPricePaise": 55000,
          "quantity": 3,
          "lineTotalPaise": 165000
        }
      ],
      "branch": {
        "id": "uuid",
        "slug": "danapur",
        "name": "Danapur Branch",
        "addressLine1": "Saguna Khagaul Road, Kaliket Nagar, Danapur",
        "addressLine2": "Patna, Bihar",
        "city": "Patna",
        "state": "Bihar"
      }
    }
  }
}
```

---

### 9. `POST /api/checkout/cancel`

Cancel a draft or awaiting_payment order. Restores redeemed reward points. Once an order is `confirmed` or `failed`, it cannot be cancelled.

**Auth:** Required.

**Request Body:**
```json
{
  "orderId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled."
}
```

---

### 10. `POST /api/stripe/webhook`

Receives Stripe webhook events. Verifies the signature using `STRIPE_WEBHOOK_SECRET`.

**Auth:** None (uses Stripe signature verification instead).

**Request:** Raw body (not pre-parsed JSON). The `stripe-signature` header is required.

**Events handled:**

| Event | Action |
|---|---|
| `payment_intent.succeeded` | Marks order as `confirmed`, awards reward points (if eligible), clears the user's cart |
| `payment_intent.payment_failed` | Marks order as `failed`, restores redeemed reward points |
| `payment_intent.created` | Acknowledged (no-op) |
| `payment_intent.processing` | Acknowledged (no-op) |
| `payment_intent.canceled` | Acknowledged (no-op) |
| `charge.refunded` | Acknowledged (no-op — refund module is future work) |

**Response:** Always `200 OK` with `{ received: true }` (to prevent Stripe retries). Errors return `400` (signature failure) or `500` (internal error).

**Idempotency:** The `processed_webhook_events` table deduplicates by Stripe event ID. Duplicate deliveries are silently ignored.

---

## Error Response Format

All error responses follow this shape:

```json
{
  "success": false,
  "message": "Human-readable error message (no internal details)"
}
```

**HTTP status codes:**

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request (validation failed) |
| 401 | Unauthorized (no session) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate idempotency key) |
| 429 | Rate limited |
| 500 | Internal server error |
| 502 | Payment provider error (Stripe) |

**Security:** Error messages never expose Stripe errors, database errors, stack traces, internal paths, or server IDs. Detailed errors are logged server-side only.

---

## Rate Limits

| Endpoint | Limit | Window | Block Duration |
|---|---|---|---|
| `POST /api/checkout/validate` | 20 | 1 min | 1 min |
| `POST /api/checkout/create-order` | 5 | 1 min | 5 min |
| `POST /api/checkout/cancel` | 10 | 1 min | 1 min |
| `GET /api/checkout/order/[id]` | 60 | 1 min | 30 sec |
| `GET /api/rewards/balance` | 30 | 1 min | 30 sec |
| `POST /api/rewards/preview-redemption` | 30 | 1 min | 30 sec |
| `GET /api/branches` | 30 | 1 min | 30 sec |
| `GET /api/checkout/pickup-slots` | 30 | 1 min | 30 sec |

Rate limits are per-user AND per-IP (whichever is exceeded first triggers the block).
