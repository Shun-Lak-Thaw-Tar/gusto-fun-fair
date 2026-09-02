# Fun Fair Backend V1.1 API Contract

All JSON errors use `{ "error": { "message": "..." } }`. Protected endpoints require `Authorization: Bearer <JWT>`. IDs below are MongoDB IDs. Payment proof objects remain provider-neutral: `{ "url": "...", "storageKey": "...", "provider": "..." }`.

## Event and catalog

### `GET /api/health` — public

Returns `200` with API running status.

### `GET /api/event` — public

Returns `200` with `eventName`, event and preorder dates, `orderingEnabled`, derived `preorderStatus` (`UPCOMING`, `OPEN`, `CLOSED`, or `DISABLED`), `orderReservationMinutes`, and `paymentProofGraceMinutes`. Payment account details are not returned publicly by this endpoint.

### `GET /api/stalls` and `GET /api/stalls/:id` — public

Return active stalls.

### `GET /api/foods` and `GET /api/foods/:id` — public

Return available foods, authoritative calculated `preorderPrice`, `ticketLimit`, and calculated `ticketsRemaining`. Internal `reservedTickets` and `soldTickets` counters are not exposed. `GET /api/foods?stallId=<id>` filters by stall.

## Orders

### `POST /api/orders` — authenticated

Request:

```json
{ "items": [{ "foodItemId": "...", "quantity": 2 }] }
```

Duplicate food IDs are consolidated. Client prices, totals, names, discounts, remaining counts, and roles are ignored. The event must be enabled and current time must satisfy `preorderOpenAt <= now < preorderCloseAt`. Each food and stall must be active/available.

Returns `201` with the stored order plus checkout information: exact amount, `FF-ORDER-XXXXXX` payment reference, KBZ details/instructions, and `reservationExpiresAt`. Order state is `AWAITING_PAYMENT + RESERVED`. The demo reservation duration is 60 minutes. Important errors: `400` malformed/missing items, `409` event unavailable or insufficient inventory, `401` unauthenticated, `503` missing current event configuration.

### `GET /api/orders` and `GET /api/orders/:id` — authenticated owner

Return the caller's immutable order price snapshots and lifecycle timestamps.

### `POST /api/orders/:id/payment-declare` — authenticated owner

Body: none. Requires `AWAITING_PAYMENT + RESERVED` before `reservationExpiresAt`. Returns `200` with `PAYMENT_DECLARED + RESERVED`, `paymentDeclaredAt`, and `paymentProofExpiresAt`. The proof deadline uses the configured grace period (30 demo minutes). Important errors: `404` not found/not owned, `409` already declared or invalid state, `410` reservation expired.

Declaration means the customer reports that external KBZ payment occurred. Cancellation is permanently unavailable afterward. No automatic KBZ verification occurs.

### `POST /api/orders/:id/cancel` — authenticated owner

Body: none. Allowed only for `AWAITING_PAYMENT + RESERVED`. Returns `200` with `CANCELLED + RELEASED`; all held quantities are returned. Important errors: `404` not found/not owned, `409` invalid state or repeat request. It is forbidden after declaration, proof submission, approval, rejection, or either expiry state.

## Payment proof and review

### `POST /api/payments/orders/:orderId` — authenticated owner

Request:

```json
{ "paymentProof": { "url": "/provider-neutral/reference.jpg", "storageKey": "", "provider": "" } }
```

Requires `PAYMENT_DECLARED + RESERVED` before `paymentProofExpiresAt`. Returns `201` with the payment and `PAYMENT_SUBMITTED + RESERVED` order. Submitted orders do not expire while awaiting admin review. Important errors: `400` missing proof reference, `404` not found/not owned, `409` invalid state, `410` grace period expired (which transitions to `PAYMENT_EVIDENCE_EXPIRED + RELEASED`).

### `GET /api/admin/payments` — admin

Returns submitted payments awaiting manual review.

### `PATCH /api/admin/payments/:id/review` — admin

Approval request: `{ "decision": "APPROVED" }`. Rejection request: `{ "decision": "REJECTED", "rejectionReason": "..." }`.

Only `Payment.SUBMITTED` with `Order.PAYMENT_SUBMITTED + RESERVED` is reviewable. Approval changes payment to `APPROVED`, order to `PAYMENT_APPROVED + SOLD`, converts reserved counters to sold, and idempotently creates exactly one digital ticket and notification. Rejection changes payment to `REJECTED`, order to `PAYMENT_REJECTED + RELEASED`, releases inventory, creates no ticket, and records reviewer/time/reason. Repeated same-decision calls do not repeat inventory or ticket effects; opposite decisions return `409`. Non-admin callers receive `403`.

Payment rejection means proof was not accepted. It does not automatically issue a refund. There are no refund endpoints or refund processing in V1.1.

## Expiry and inventory lifecycle

Business-sensitive operations run idempotent cleanup:

- `AWAITING_PAYMENT + RESERVED` at/after `reservationExpiresAt` becomes `EXPIRED + RELEASED`.
- `PAYMENT_DECLARED + RESERVED` at/after `paymentProofExpiresAt` becomes `PAYMENT_EVIDENCE_EXPIRED + RELEASED`.
- `PAYMENT_SUBMITTED` is excluded from timer cleanup.

Per-food reservation uses an atomic conditional update requiring `reservedTickets + soldTickets + requestedQuantity <= ticketLimit`. For multi-item orders, reservations run deterministically and earlier successful holds are explicitly compensated if a later item fails. Release and reserved-to-sold conversion also compensate earlier items when a later item operation fails. Repeated lifecycle transitions first conditionally claim the order state, preventing normal double-release/double-sale behavior.

True multi-document ACID guarantees are unavailable on a standalone MongoDB deployment. A replica-set or sharded transaction-capable deployment is required to eliminate every possible process-crash window across multiple food documents and order/payment/ticket side effects.

## Admin System future contract and ownership

### Implemented Admin endpoints

All require existing JWT authentication plus `role = "admin"`:

- `GET /api/admin/payments` — submitted payments awaiting manual review
- `PATCH /api/admin/payments/:id/review` — approve/reject through shared `paymentService`
- `GET /api/admin/statistics/best-selling-stall` — approved-quantity leader; approved revenue breaks quantity ties, and `leaders` returns every exact tie
- Existing ticket verification/redemption remains implemented at `GET /api/tickets/:code` and `POST /api/tickets/:code/redeem`, also admin-only

### Planned, not implemented

The protected router reserves `/api/admin/dashboard`, `/stalls`, `/foods`, `/orders`, `/tickets`, and `/event`. These subrouters currently expose no business endpoints. They must not be documented or treated as working CRUD APIs.

Future work reuses the existing authentication and shared services. `pricingService`, `inventoryService`, `orderLifecycleService`, `paymentService`, `ticketService`, and `eventService` are shared business logic; Admin controllers must call them rather than duplicate transitions. `User`, `Stall`, `FoodItem`, `Order`, `Payment`, `Ticket`, `Redemption`, `Notification`, and `EventConfig` are coordinated shared contracts.

Frozen order states are `AWAITING_PAYMENT`, `PAYMENT_DECLARED`, `PAYMENT_SUBMITTED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `PAYMENT_EVIDENCE_EXPIRED`, `CANCELLED`, and `EXPIRED`. Frozen inventory states are `RESERVED`, `SOLD`, and `RELEASED`. Admin payment review accepts only `PAYMENT_SUBMITTED + RESERVED` orders and a `SUBMITTED` payment. Statuses change only through real approve/reject/cancel/expiry/redemption actions—never arbitrary status editing.

### Whole-order redemption

One approved multi-item/multi-stall order has one digital ticket. Redeeming it marks the whole order's physical food-ticket quantities as issued. V1 has no partial item redemption, and repeated redemption remains blocked.

### Frozen dashboard/statistics definitions

- Total Orders: all statuses
- Awaiting Payment, Payment Declared, Pending Review, Approved, Rejected, and Cancelled: their exact matching statuses
- Expired Orders: combined `EXPIRED + PAYMENT_EVIDENCE_EXPIRED` (separate cards are also permitted)
- Approved Revenue: sum approved `Order.totalAmount`
- Food Tickets Sold: sum item quantities in approved orders
- Digital Tickets Issued: Ticket records for approved orders
- Digital Tickets Redeemed: `REDEEMED` Ticket records
- Physical Tickets Issued: order-item quantities associated with redeemed tickets

Best-Selling Stall means greatest total item quantity in `PAYMENT_APPROVED` orders. Approved stall revenue is the first tie-breaker; return every leader if both remain tied. Stall/food history comes from OrderItem snapshots.

### Admin data safety

After orders exist, deactivate stalls (`isActive = false`) and foods (`isAvailable = false`) rather than hard-delete referenced records. A ticket-limit update must enforce `newTicketLimit >= reservedTickets + soldTickets` server-side. Price and discount edits affect future orders only; historical order snapshots are never recalculated.

Event settings retain the `current` singleton, 60/30 defaults, `preorderOpenAt < preorderCloseAt`, and closing one day before the event. Updates affect future operations and never rewrite old order/payment/ticket timestamps or amounts. Canonical website notification types are `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `ORDER_EXPIRED`, and `PAYMENT_EVIDENCE_EXPIRED`.

## Customer-facing wording for the future frontend

- Before payment: “Your food tickets are reserved for 1 hour.” “Only cancel this order if you have NOT completed the KBZ payment.” “Payments are non-refundable.”
- After external payment: “After completing your KBZ payment, click ‘I Have Made Payment’ before your reservation expires.”
- After declaration: “Payment reported. Upload your KBZ payment proof within 30 minutes.” “Cancellation is no longer available.”
- Initial expiry: “Your reservation expired and the food tickets were released.”
- Evidence expiry: “Your payment-proof upload period expired. Your reserved food tickets were released. Please contact the event administrators if you already made a payment.”
