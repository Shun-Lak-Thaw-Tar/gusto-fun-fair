# Fun Fair Backend V1.4 API Contract

All JSON errors use `{ "error": { "message": "..." } }`. Protected endpoints require `Authorization: Bearer <JWT>`. IDs below are MongoDB IDs. Payment proof objects remain provider-neutral: `{ "url": "...", "storageKey": "...", "provider": "..." }`.

## Event and catalog

### `GET /api/health` — public

Returns `200` with API running status.

### `GET /api/event` — public

Returns `200` with `eventName`, event and preorder dates, `eventTimezone` (`Asia/Yangon`), `orderingEnabled`, derived `preorderStatus` (`UPCOMING`, `OPEN`, `CLOSED`, or `DISABLED`), reservation/grace durations, and safe `featureFlags` containing `memoriesEnabled`, `eventPageEnabled`, and `crushLettersEnabled`. Payment account details, audit fields, and internal IDs are not returned publicly.

### `GET /api/stalls` and `GET /api/stalls/:id` — public

Return active stalls.

### `GET /api/foods` and `GET /api/foods/:id` — public

Return available sellable `StallFood` entries enriched with `stallFoodId`, `stallId`, `foodId`, `stallName`, nested generic `food`, authoritative `eventDayPrice`, relationship-owned `discount`, calculated `preorderPrice`, `ticketLimit`, and `ticketsRemaining`. Internal `reservedTickets` and `soldTickets` are not exposed. Filters are `?stallId=<id>` and `?foodId=<id>`; the detail ID is a `stallFoodId`.

## Crush Letters

### `POST /api/crush-letters` — public

Accepts strict `{ "recipientName": "...", "message": "..." }` input without login. Recipient and message are trimmed, required, and limited to 100 and 1000 characters. Submission requires `featureFlags.crushLettersEnabled = true`; otherwise it returns `409`. New letters are always anonymous and `PENDING`. The safe `201` response confirms submission for review without returning the message, version field, or moderation audit data. The route permits 30 successful submissions per transient IP key per ten minutes and returns `429` when exceeded; failed/disabled requests do not consume quota and IP addresses are not persisted.

### `GET /api/crush-letters?page=1&limit=20` — public

Returns only `APPROVED` letters, newest first, with `id`, `recipientName`, `message`, and `createdAt`. `PENDING`, `REJECTED`, `HIDDEN`, version fields, update timestamps, and moderation metadata are excluded. Pagination defaults to 20 and is capped at 50. Listing remains available while new submissions are disabled.

## Orders

### `POST /api/orders` — authenticated

Request:

```json
{ "items": [{ "stallFoodId": "...", "quantity": 2 }] }
```

Duplicate StallFood IDs are consolidated. Unknown fields—including client prices, totals, names, discounts, and remaining counts—are rejected. Deprecated `foodItemId` may temporarily replace `stallFoodId` only when it maps to migrated data; clients must never send both. The event must be enabled and current time must satisfy `preorderOpenAt <= now < preorderCloseAt`. Each Food, Stall, and StallFood must be active/available.

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

Per-StallFood reservation uses an atomic conditional update requiring `reservedTickets + soldTickets + requestedQuantity <= ticketLimit`. For multi-item orders, reservations run deterministically and earlier successful holds are explicitly compensated if a later item fails. Release and reserved-to-sold conversion also compensate earlier items when a later item operation fails. Repeated lifecycle transitions first conditionally claim the order state, preventing normal double-release/double-sale behavior.

True multi-document ACID guarantees are unavailable on a standalone MongoDB deployment. A replica-set or sharded transaction-capable deployment is required to eliminate every possible process-crash window across multiple food documents and order/payment/ticket side effects.

## Admin System contract and ownership

All implemented Admin endpoints require the existing JWT plus `role = "admin"`.

### Implemented

- `GET /api/admin/dashboard` — returns `{ "dashboard": { ... } }` with frozen dashboard metrics
- `GET /api/admin/payments` — submitted payments awaiting manual review
- `PATCH /api/admin/payments/:id/review` — approve/reject through shared `paymentService`
- `GET /api/admin/statistics/best-selling-stall` — approved-quantity leader; approved revenue breaks quantity ties and `leaders` contains every exact tie
- `GET /api/tickets/:code` and `POST /api/tickets/:code/redeem` — existing Admin-only whole-order ticket lookup/redemption

The dashboard contains `totalOrders`, `awaitingPayment`, `paymentDeclared`, `pendingPaymentReview`, `approvedOrders`, `rejectedOrders`, combined `expiredOrders`, `cancelledOrders`, `approvedRevenue`, `foodTicketsSold`, `digitalTicketsIssued`, `digitalTicketsRedeemed`, `physicalTicketsIssued`, `activeStalls`, and `availableFoodItems`. Revenue and food-ticket quantities count approved orders only. Physical ticket quantities count only orders linked to redeemed digital tickets. Available foods must belong to active stalls.

### Planned, not implemented

No Admin or Stall Owner frontend is implemented. Memories and image-provider integration remain outside this milestone.

### Implemented Admin management routes

- `GET|POST /api/admin/stalls` — list/create stalls
- `GET|PATCH /api/admin/stalls/:id` — details/edit without changing the stable slug
- `PATCH /api/admin/stalls/:id/status` — activate/deactivate
- `GET|POST /api/admin/stalls/:stallId/owner` — view/create the one linked owner
- `PATCH /api/admin/stalls/:stallId/owner/password` — reset owner password
- `PATCH /api/admin/stalls/:stallId/owner/status` — enable/disable owner
- `GET|POST /api/admin/foods` and `GET|PATCH /api/admin/foods/:id` — generic Food catalog only
- `GET|POST /api/admin/stall-foods` and `GET|PATCH /api/admin/stall-foods/:id` — assignment, price, per-entry discount, ticket limit, and availability; list filters support `stallId` and `foodId`
- `GET /api/admin/orders?status=...` and `GET /api/admin/orders/:id` — safe listing/filter/details; no arbitrary status endpoint
- `GET /api/admin/statistics/overview|stalls|foods|best-selling-stall`
- `GET|PATCH /api/admin/event` — singleton schedule, manual ordering switch, payment settings, and explicit feature flags
- `GET /api/admin/crush-letters` — paginated moderation list with optional exact status filter
- `GET /api/admin/crush-letters/:id` — moderation detail
- `PATCH /api/admin/crush-letters/:id/review` — `PENDING → APPROVED|REJECTED`
- `PATCH /api/admin/crush-letters/:id/visibility` — `APPROVED ↔ HIDDEN`
- `GET /api/admin/tickets/:code` and `POST /api/admin/tickets/:code/redeem` — dedicated namespace reusing shared behavior

All write bodies are allow-listed and reject unknown fields. Food catalog input cannot contain selling fields. StallFood input never accepts `preorderPrice`, `reservedTickets`, `soldTickets`, or `ticketsRemaining`; historical order snapshots are not updated.

### Implemented Stall Owner routes

All require an active authenticated `stall_owner`; the linked stall comes from the database-backed user identity, never a request stall ID.

- `GET /api/stall-owner/dashboard` — owner, linked stall, approved-sales summary
- `GET /api/stall-owner/stall` — linked stall
- `GET /api/stall-owner/foods` — linked-stall StallFood entries populated with Food details and calculated prices/remaining counts
- `GET /api/stall-owner/sales` — approved-only summary and item breakdown
- `GET /api/stall-owner/share` — event/stall/food names, slug, and relative public path

### Implemented public stall link

`GET /api/stalls/by-slug/:slug` returns an active stall and available foods with server-calculated preorder prices and remaining tickets. Owner accounts and sales are never included.

Admin controllers must reuse `pricingService`, `inventoryService`, `orderLifecycleService`, `paymentService`, `ticketService`, and `eventService` rather than duplicate transitions. Shared models and lifecycle enums require coordination.

Frozen order states remain `AWAITING_PAYMENT`, `PAYMENT_DECLARED`, `PAYMENT_SUBMITTED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `PAYMENT_EVIDENCE_EXPIRED`, `CANCELLED`, and `EXPIRED`; inventory states remain `RESERVED`, `SOLD`, and `RELEASED`. Statuses change only through valid lifecycle actions, never arbitrary editing.

One approved multi-item/multi-stall order has one digital ticket. Redeeming it represents issuance of every physical food-ticket quantity in that order. Partial redemption is not supported and repeat redemption remains blocked.

Best-Selling Stall means greatest total item quantity in `PAYMENT_APPROVED` orders. Approved stall revenue is the first tie-breaker; every leader is returned when quantity and revenue remain tied. The compatibility response is `{ stall, leaders, isTie }`.

After orders exist, deactivate Stalls/Foods or make StallFood entries unavailable instead of hard-deleting referenced data. StallFood ticket-limit updates must enforce `newTicketLimit >= reservedTickets + soldTickets`. Price and discount edits affect future orders only; historical order snapshots are never recalculated.

Event settings retain the `current` singleton, `Asia/Yangon` timezone, and 60/30 defaults. Validation requires `preorderOpenAt < preorderCloseAt < eventDate`; there is no exact 24-hour constraint. Ordering is allowed only inside the schedule while `orderingEnabled` is true. `featureFlags.memoriesEnabled`, `featureFlags.eventPageEnabled`, and `featureFlags.crushLettersEnabled` are independently patchable, default false, preserve omitted siblings, and reject unknown keys. The Crush Letter flag controls new submissions only, not approved public listing. Payment review/approval/rejection and ticket redemption have no EventConfig switch. Updates affect future operations and never rewrite historical orders. Canonical notification types are `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `ORDER_EXPIRED`, and `PAYMENT_EVIDENCE_EXPIRED`.

Admin clients should show confirmation dialogs before changing operational switches, but the API requires no confirmation flag. Confirmed launch dates are 8 September 2026 opening, 10 September 2026 closing, and 11 September 2026 event date in Myanmar Time; exact opening/closing times remain TBD. Two more explicit event-day flags are expected later, with names and behavior not yet defined.

## Customer-facing wording for the future frontend

- Before payment: “Your food tickets are reserved for 1 hour.” “Only cancel this order if you have NOT completed the KBZ payment.” “Payments are non-refundable.”
- After external payment: “After completing your KBZ payment, click ‘I Have Made Payment’ before your reservation expires.”
- After declaration: “Payment reported. Upload your KBZ payment proof within 30 minutes.” “Cancellation is no longer available.”
- Initial expiry: “Your reservation expired and the food tickets were released.”
- Evidence expiry: “Your payment-proof upload period expired. Your reserved food tickets were released. Please contact the event administrators if you already made a payment.”
