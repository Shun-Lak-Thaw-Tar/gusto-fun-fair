# Fun Fair Backend V1.4 API Contract

All JSON errors use `{ "error": { "message": "..." } }`. Protected endpoints require `Authorization: Bearer <JWT>`. IDs below are MongoDB IDs. Uploads now require multipart image bytes. See [the media API report](MEDIA_BACKEND_REPORT.md) for the full upload/gallery contract.

## Event and catalog

### `GET /api/health` — public

Returns `200` with API running status.

### `GET /api/event` — public

Returns `200` with `eventName`, event and preorder dates, `eventTimezone` (`Asia/Yangon`), `orderingEnabled`, derived `preorderStatus` (`UPCOMING`, `OPEN`, `CLOSED`, or `DISABLED`), reservation/grace durations, and safe `featureFlags` containing `memoriesEnabled`, `eventPageEnabled`, `crushLettersEnabled`, and `quizEnabled`. Payment account details, audit fields, and internal IDs are not returned publicly.

### `GET /api/stalls` and `GET /api/stalls/:id` — public

Return active stalls.

### `GET /api/foods` and `GET /api/foods/:id` — public

Return available sellable `StallFood` entries enriched with `stallFoodId`, `stallId`, `foodId`, `stallName`, nested generic `food`, authoritative `eventDayPrice`, relationship-owned `discount`, calculated `preorderPrice`, `ticketLimit`, and `ticketsRemaining`. Internal `reservedTickets` and `soldTickets` are not exposed. Filters are `?stallId=<id>` and `?foodId=<id>`; the detail ID is a `stallFoodId`.

## Crush Letters

### `POST /api/crush-letters` — authenticated, event day

Accepts strict `{ "recipientName": "...", "message": "...", "privilegeCode": "..." }` input; `privilegeCode` is optional and only needed from the second letter onward. Recipient and message are trimmed, required, and limited to 100 and 1000 characters. Submission requires `featureFlags.crushLettersEnabled = true` and the configured event day; otherwise it returns `409`. New letters are always anonymous and `PENDING`. The safe `201` response confirms submission for review without returning the message, version field, or moderation audit data. The route permits 30 successful submissions per transient IP key per ten minutes and returns `429` when exceeded; failed/disabled requests do not consume quota and IP addresses are not persisted.

Each user gets one free letter per event. A second and third letter require `privilegeCode` containing the authenticated owner's approved order `preorderPrivilegeCode`; that privilege is consumed once for `CRUSH_LETTER` and then covers both extra letters (raising the allowance to 3 total). `GET /api/crush-letters/allowance` (authenticated) returns `{ "letters": { "allowance", "used", "remaining" } }` for the current user.

### `GET /api/crush-letters?page=1&limit=20` — public

Returns only `APPROVED` letters, newest first, with `id`, `recipientName`, `message`, and `createdAt`. `PENDING`, `REJECTED`, `HIDDEN`, version fields, update timestamps, and moderation metadata are excluded. Pagination defaults to 20 and is capped at 50. Listing remains available while new submissions are disabled.

## Orders

### `POST /api/orders` — authenticated

Request:

```json
{ "items": [{ "stallFoodId": "...", "quantity": 2 }] }
```

Duplicate StallFood IDs are consolidated. Unknown fields—including client prices, totals, names, discounts, and remaining counts—are rejected. Deprecated `foodItemId` may temporarily replace `stallFoodId` only when it maps to migrated data; clients must never send both. The event must be enabled and current time must satisfy `preorderOpenAt <= now < preorderCloseAt`. Each Food, Stall, and StallFood must be active/available.

Returns `201` with the stored order plus checkout information: exact amount, `FF-ORDER-XXXXXX` payment reference, KBZ details/instructions, and `reservationExpiresAt`. Order state is `AWAITING_PAYMENT + RESERVED`. New reservations last at most 30 minutes (older saved event values such as 60 are capped); existing orders retain their original deadline. The payment note shown to customers is `fun fair`; `paymentReference` remains a unique internal order identifier. Important errors: `400` malformed/missing items, `409` event unavailable, insufficient inventory or per-item limit exceeded, `429` three orders already placed in the rolling hour, `401` unauthenticated, `503` missing current event configuration.

### `GET /api/orders` and `GET /api/orders/:id` — authenticated owner

Return the caller's immutable order price snapshots and lifecycle timestamps. New orders also snapshot each item's `foodImage` (`url`, `storageKey`, `provider`). `GET /api/orders/:id` returns `items[].foodImage` for the detail view: saved image references take precedence, and older items are enriched by their Food ID (or StallFood ID), including inactive foods. Missing/deleted food images return `null`. This read does not write to the database or change historical names, quantities or prices. The order list and lifecycle action responses remain stored snapshots; refresh the detail endpoint after an action to obtain legacy image enrichment.

### `POST /api/orders/:id/payment-declare` — authenticated owner

Body: none. Requires `AWAITING_PAYMENT + RESERVED` before `reservationExpiresAt`. Returns `200` with `PAYMENT_DECLARED + RESERVED`, `paymentDeclaredAt`, and `paymentProofExpiresAt`. The proof deadline uses the configured grace period (30 demo minutes). Important errors: `404` not found/not owned, `409` already declared or invalid state, `410` reservation expired.

Declaration means the customer reports that external KBZ payment occurred. Cancellation is permanently unavailable afterward. No automatic KBZ verification occurs.

### `POST /api/orders/:id/cancel` — authenticated owner

Body: none. Allowed only for `AWAITING_PAYMENT + RESERVED`. Returns `200` with `CANCELLED + RELEASED`; all held quantities are returned. Important errors: `404` not found/not owned, `409` invalid state or repeat request. It is forbidden after declaration, proof submission, approval, rejection, or either expiry state.

## Payment proof, gallery, and review

See [MEDIA_BACKEND_REPORT.md](MEDIA_BACKEND_REPORT.md#api-contract) for the complete request/response contract.

- `POST /api/payments/orders/:orderId`: authenticated owner sends multipart field `image`, not a JSON URL. JPEG, PNG, or WebP, at most 7 MB.
- Initial proof requires `PAYMENT_DECLARED + RESERVED` before `paymentProofExpiresAt`. Admin-granted replacement requires `PAYMENT_REUPLOAD_REQUESTED + RESERVED`, without a deadline.
- Each granted replacement accepts one upload and returns to `PAYMENT_SUBMITTED`. Earlier screenshots remain privately accessible.
- `GET /api/payments/orders/:orderId`: owner retrieves payment status, reason, proof versions, and review history.
- `GET /api/payments/:id/proofs/:version`: image bytes, accessible only to owner/admin.
- `GET /api/admin/payments`: submitted and replacement-requested payments.
- `PATCH /api/admin/payments/:id/review`: requires `decision` and the current numeric `proofVersion`. Decisions are `APPROVED`, `REJECTED`, or `REUPLOAD_REQUESTED`. Rejection/reupload require `reason` (maximum 500 characters); `rejectionReason` remains an alias.
- Stale proofVersion returns 409. Final rejection may also close a pending replacement request. Approval requires a submitted proof.
- Approval transactionally sells reserved stock and creates one ticket/notification. Final rejection releases stock without a refund. Reupload keeps quantities reserved and stores the required reason.
- Proof uploads use two concurrent slots per backend process, one per account. The slot covers preflight, multipart reception, Sharp, R2 and the database transaction. Extra requests are rejected before multipart parsing; no in-memory waiting queue is created.
- Per-account proof limits: 12 attempts/minute and 60 attempts/15 minutes. Invalid attempts count; busy and already-in-progress responses are refunded. These limits do not aggregate students behind one campus IP.
- `429` reports `error.details.code = PROOF_UPLOAD_RATE_LIMITED` or `PROOF_UPLOAD_IN_PROGRESS`; `503` capacity responses report `PROOF_UPLOAD_BUSY`. All include numeric `Retry-After` seconds and `error.details.retryAfterSeconds`. Keep the selected file and retry manually after that delay; do not automatically resubmit payments.
- Ownership, state and initial-proof deadline are checked before accepting the file, and the transaction still rechecks state/version. File reception is capped at 180 seconds; interrupted clients keep their local file and should refresh status before retrying. R2 PUT operations have a 45-second deadline.
- Limits are in `src/middleware/proofUploadMiddleware.js`, sized for one Node process on a 2 GiB instance. Multiple workers/instances would need shared admission/rate state. Memory-photo request limits are unchanged; this is payment-proof protection, not a site-wide DDoS guarantee. During EC2 setup, configure proxy body limits/timeouts and preserve the retry response.
- `GET /api/memories`: public gallery with cursor pagination.
- `POST /api/memories`: authenticated multipart image and optional caption; one per event, or two total with an approved event order.
- `GET /api/memories/window`, `GET /api/memories/allowance`, `GET /api/memories/mine`: window and authenticated user context.
- `GET /api/memories/:id/image`: public active image.
- `DELETE /api/memories/:id`: owner deletion within the window frees a slot.
- `GET|PUT /api/memories/:id/reaction`: authenticated reaction lookup/update; body `{ "reaction": "LIKE" }`, `"DISLIKE"`, or null.
- `GET|PUT /api/admin/memories/window`: admin reads/sets opening and closing instants.
- `DELETE /api/admin/memories/:id`: admin removal keeps the slot occupied.

## Stall and Food images

Stall and Food images use the same private-R2 `MediaAsset` pipeline as payment proofs and Snaps (see [MEDIA_BACKEND_REPORT.md](MEDIA_BACKEND_REPORT.md)), but are streamed publicly. See `server/src/services/mediaService.js` and `server/src/middleware/uploadMiddleware.js` for the implementation referenced below.

- A Stall image belongs to `Stall.image`; a Food image belongs to `Food.image`. `StallFood` does not own an image field — it references its assigned Food (which carries the image) through `foodId`.
- `POST /api/admin/stalls`, `PATCH /api/admin/stalls/:id`, `POST /api/admin/foods`, `PATCH /api/admin/foods/:id` — admin-only, accept `multipart/form-data`. Existing text fields (`stallName`, `batch`, `description`, `name`, `category`, `isActive`, etc.) are sent as ordinary form fields; the image is an **optional** file field named `image`. There is no JSON `image` object on these routes — the client must never send `image.url`, `image.storageKey`, `image.provider`, or `image.assetId`; the server generates and owns all storage metadata. Omitting the `image` field leaves an existing image untouched on update, or creates the record with no image on create.
- Accepted image types: JPEG, PNG, or WebP only, single-frame, verified by decoding the file with Sharp — not just trusting the client's `Content-Type`. Maximum upload size is 7 MB (`MAX_IMAGE_BYTES`); maximum decoded pixel count is 40 megapixels (`limitInputPixels: 40_000_000`). EXIF/GPS metadata is stripped by decoding and re-encoding the image before storage.
- On success the stored `image` field is `{ url, storageKey, provider: "r2", assetId }`, where `url` is the app-relative streaming path below — never a raw R2 URL. Replacing an image on update moves the previous `MediaAsset` to `DELETE_PENDING`; it is not deleted synchronously.
- `GET /api/stalls/:id/image` and `GET /api/foods/:id/image` — public, unauthenticated. Stream the current image's bytes from R2 with `Cache-Control: no-store` and `Cross-Origin-Resource-Policy: cross-origin` (unlike private payment-proof/Snap streaming, these are meant to be embedded by either frontend without a bearer token). Return `404` when the Stall/Food has no image or its referenced asset is not `ATTACHED`.

## Expiry and inventory lifecycle

Business-sensitive operations run idempotent cleanup:

- `AWAITING_PAYMENT + RESERVED` at/after `reservationExpiresAt` becomes `EXPIRED + RELEASED`.
- `PAYMENT_DECLARED + RESERVED` at/after `paymentProofExpiresAt` becomes `PAYMENT_EVIDENCE_EXPIRED + RELEASED`.
- `PAYMENT_SUBMITTED` and `PAYMENT_REUPLOAD_REQUESTED` are excluded from timer cleanup.

New order creation, cancellation, expiry and final payment review use MongoDB transactions: the order state and all stock changes commit or roll back together. A replica set or sharded deployment is required and checked on startup. Cleanup also runs every 30 seconds and on menu/order reads, so expired holds are restored without another checkout. Submitted proofs and requested replacements stay reserved for organiser review.

Each distinct StallFood is limited to **2 per order when more than 5 tickets remain**, or **1 when 1–5 remain**. Duplicate lines and legacy aliases are consolidated before validation. Current stock is checked inside the transaction; concurrent stock changes trigger a retry and revalidation. A `409 ORDER_QUANTITY_LIMIT` includes `stallFoodId`, `maxQuantity`, and `ticketsRemaining` in `error.details` so clients can correct the cart.

Each authenticated account may place **3 orders in a rolling 60 minutes**. All placed orders count regardless of later status; failed checkouts do not count. A transactional write on the User document serializes simultaneous checkouts before querying order history. This limit survives restarts and works across API processes. A `429 ORDER_RATE_LIMITED` includes `Retry-After` and `error.details.retryAfterSeconds`.


## Admin System contract and ownership

All implemented Admin endpoints require the existing JWT plus `role = "admin"`.

### Implemented

- `GET /api/admin/dashboard` — returns `{ "dashboard": { ... } }` with frozen dashboard metrics
- `GET /api/admin/payments` — submitted payments awaiting manual review
- `PATCH /api/admin/payments/:id/review` — approve/request replacement/reject through shared `paymentService`
- `GET /api/admin/statistics/best-selling-stall` — approved-quantity leader; approved revenue breaks quantity ties, and `leaders` returns every exact tie
- `GET /api/tickets/:code` and `POST /api/tickets/:code/redeem` — existing Admin-only whole-order ticket lookup/redemption

The dashboard contains `totalOrders`, `awaitingPayment`, `paymentDeclared`, `pendingPaymentReview`, `approvedOrders`, `rejectedOrders`, combined `expiredOrders`, `cancelledOrders`, `approvedRevenue`, `foodTicketsSold`, `digitalTicketsIssued`, `digitalTicketsRedeemed`, `physicalTicketsIssued`, `activeStalls`, and `availableFoodItems`. Revenue and food-ticket quantities count approved orders only. Physical ticket quantities count only orders linked to redeemed digital tickets. Available foods must belong to active stalls.

### Frontend status

The `Admin/` and `stall owner/` React frontends are implemented and consume the routes documented in this file; see `Admin/README.md` and `stall owner/README.md` for the full page-to-route mapping.

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
- `GET|PUT /api/admin/memories/window` and `DELETE /api/admin/memories/:id` — snap-window configuration and admin photo removal (slot retained)

All write bodies are allow-listed and reject unknown fields. Food catalog input cannot contain selling fields. StallFood input never accepts `preorderPrice`, `reservedTickets`, `soldTickets`, or `ticketsRemaining`; historical order snapshots are not updated.

### Implemented Stall Owner routes

All require an active authenticated `stall_owner`; the linked stall comes from the database-backed user identity, never a request stall ID.

- `GET /api/stall-owner/dashboard` — owner, linked stall, approved-sales summary
- `GET /api/stall-owner/stall` — linked stall
- `GET /api/stall-owner/foods` — linked-stall StallFood entries populated with Food details and calculated prices/remaining counts
- `GET /api/stall-owner/sales` — approved-only summary and item breakdown
- `GET /api/stall-owner/orders` — approved (`PAYMENT_APPROVED` only) orders that contain the linked stall's items; each order's `items` are filtered to that stall's own line items only, plus `stallQuantity`/`stallSubtotal` totals for those items and an `approvedOrderCount` summary. Newest first, not paginated.
- `GET /api/stall-owner/share` — event/stall/food names, slug, and relative public path

### Implemented public stall link

`GET /api/stalls/by-slug/:slug` returns an active stall and available foods with server-calculated preorder prices and remaining tickets. Owner accounts and sales are never included.

Admin controllers must reuse `pricingService`, `inventoryService`, `orderLifecycleService`, `paymentService`, `ticketService`, and `eventService` rather than duplicate transitions. Shared models and lifecycle enums require coordination.

Frozen order states are `AWAITING_PAYMENT`, `PAYMENT_DECLARED`, `PAYMENT_SUBMITTED`, `PAYMENT_REUPLOAD_REQUESTED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `PAYMENT_EVIDENCE_EXPIRED`, `CANCELLED`, and `EXPIRED`; inventory states remain `RESERVED`, `SOLD`, and `RELEASED`. Approval or a replacement request requires a submitted payment; final rejection also accepts a replacement-requested payment. All reviews require the current proofVersion. Statuses change only through valid lifecycle actions — approve/reject/cancel/expiry/redemption — never arbitrary status editing.

One approved multi-item/multi-stall order has one digital ticket. Redeeming it represents issuance of every physical food-ticket quantity in that order. Partial redemption is not supported and repeat redemption remains blocked.

Best-Selling Stall means greatest total item quantity in `PAYMENT_APPROVED` orders. Approved stall revenue is the first tie-breaker; every leader is returned when quantity and revenue remain tied. The compatibility response is `{ stall, leaders, isTie }`.

After orders exist, deactivate Stalls/Foods or make StallFood entries unavailable instead of hard-deleting referenced data. StallFood ticket-limit updates must enforce `newTicketLimit >= reservedTickets + soldTickets`. Price and discount edits affect future orders only; historical order snapshots are never recalculated.

Event settings retain the `current` singleton, `Asia/Yangon` timezone, and 30/30 defaults (reservation/proof grace). Validation requires `preorderOpenAt < preorderCloseAt < eventDate`; there is no exact 24-hour constraint. Ordering is allowed only inside the schedule while `orderingEnabled` is true. `featureFlags.memoriesEnabled`, `featureFlags.eventPageEnabled`, `featureFlags.crushLettersEnabled`, and `featureFlags.quizEnabled` are independently patchable, default false, preserve omitted siblings, and reject unknown keys. The Crush Letter flag controls new submissions only, not approved public listing. Payment review/approval/rejection and ticket redemption have no EventConfig switch. Updates affect future operations and never rewrite historical orders. Canonical website notification types are `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `PAYMENT_REUPLOAD_REQUESTED`, `ORDER_EXPIRED`, and `PAYMENT_EVIDENCE_EXPIRED`.

Admin clients should show confirmation dialogs before changing operational switches, but the API requires no confirmation flag. Confirmed launch dates are 8 September 2026 opening, 10 September 2026 closing, and 11 September 2026 event date in Myanmar Time; exact opening/closing times remain TBD. Two more explicit event-day flags are expected later, with names and behavior not yet defined.

## Letters, memories, and quiz

### Letters

`POST /api/crush-letters` now requires authentication and is allowed only on the configured event day. Body: `{ "recipientName": "...", "message": "...", "privilegeCode": "..." }`. The authenticated user is stored privately as `authorUserId`; public responses never expose it. New letters are `PENDING` and only `APPROVED` letters appear in `GET /api/crush-letters`. The first letter is free; a second and third require the owner's approved order `preorderPrivilegeCode`, consumed once for `CRUSH_LETTER` (same pattern as Memories' `MEMORY_UPLOAD`). Admin moderation uses `GET /api/admin/crush-letters`, `GET /api/admin/crush-letters/:id`, and `PATCH /api/admin/crush-letters/:id/review` with `{ "decision": "APPROVED" }` or `{ "decision": "REJECTED", "reason": "..." }`.

### Memories

Memory uploads remain authenticated multipart requests with field `image` and optional `caption`. They are allowed only when `EventConfig.featureFlags.memoriesEnabled` is true and on the configured event day/snap window. A new upload is `PENDING`; only admin-approved memories are public or reactable. Admins use `GET /api/admin/memories?status=PENDING` and `PATCH /api/admin/memories/:id/review` with `{ "decision": "APPROVED" }` or `{ "decision": "REJECTED", "reason": "..." }`. The first upload is normal; a second requires multipart field `privilegeCode` containing the authenticated owner's approved order `preorderPrivilegeCode`. This high-entropy code is generated on payment approval and returned only by authenticated owner order reads; `paymentReference` remains the human-readable KBZ reconciliation reference. That privilege is consumed once for `MEMORY_UPLOAD`.

### Quiz

All Quiz routes except the leaderboard require authentication, the configured event day, **and** `featureFlags.quizEnabled = true`; disabling the flag returns `409` from `validate-code` and `start` without affecting existing attempts, results, or the leaderboard. An approved order `preorderPrivilegeCode` must belong to the authenticated user. Use `POST /api/quiz/validate-code` with `{ "code": "FF-PRIV-..." }`, then `POST /api/quiz/start` with the same body; starting consumes the QUIZ privilege and begins the 50-second timer server-side (`startedAt`). Five questions are chosen at random (`$sample`) from the active question bank each attempt; the start response contains exactly five question IDs, versions, question text, and options — correct answers are never returned. Submit with `POST /api/quiz/:attemptId/submit` and `{ "answers": [0, 1, 2, 3, -1] }` (one index per question, in order; use `-1` for a question the 50s timer ran out on before the client recorded an answer); the backend calculates the score, the elapsed time in milliseconds (`elapsedMs = submittedAt - startedAt`, computed server-side from the transaction's own clock so it cannot be spoofed by the client), and requires 5/5 correct **and** finishing within 50 seconds (plus a small server-side grace for network latency) to pass — a late submission is scored but `passed` is forced `false` and `timedOut` is `true`. The submit response and `GET /api/quiz/result/:attemptId` both include `results`, a per-question breakdown (`{ questionId, question, options, correctOption, yourAnswer, correct }`) generated only after submission, safe to show the user which questions they got right. Each approved order code can independently be consumed once for Quiz and once for Memory upload. A passing result currently reports a non-issued reward placeholder because the real prize has not been finalized.

`GET /api/quiz/leaderboard` — public, no authentication required. Returns `{ "leaderboard": [{ "rank": 1, "name": "...", "elapsedMs": 12345, "submittedAt": "..." }] }` for the fastest ten passing (5/5, within the time limit) attempts, fastest first.

`GET /api/admin/quiz/leaderboard` — admin-only. Same ranking as the public leaderboard but with no ten-entry cap and each row includes `attemptId` and `score`, so an admin can see (and act on) every qualifying attempt, not just the visible top ten. `DELETE /api/admin/quiz/attempts/:attemptId` removes one attempt (`204` on success, `404` if it doesn't exist). This only removes the attempt/result record — the underlying order's QUIZ privilege stays consumed, so the same pre-order code cannot be replayed; it is a disqualification, not a free retry.

Question bank: `npm run seed:quiz` (from `backend/server`) parses `backend/questions.txt` (numbered `N.`/`(A)`-`(D)`/`Ans:` blocks, Ans either a letter A-D or the exact option text) and upserts each into `QuizQuestion` by question text, so it is safe to rerun after editing the source file.

## Production proxy and authentication throttling

See [EC2 networking](EC2_NETWORKING.md) for localhost binding, trusted Nginx headers and auth limits. Login/register may return `429` with `Retry-After` and a user-facing message. Limits run before credential verification; successful login does not consume the name/IP failure allowance.

## Customer-facing wording for the future frontend

- Before payment: “Your food tickets are reserved for 1 hour.” “Only cancel this order if you have NOT completed the KBZ payment.” “Payments are non-refundable.”
- After external payment: “After completing your KBZ payment, click ‘I Have Made Payment’ before your reservation expires.”
- After declaration: “Payment reported. Upload your KBZ payment proof within 30 minutes.” “Cancellation is no longer available.”
- Initial expiry: “Your reservation expired and the food tickets were released.”
- Evidence expiry: “Your payment-proof upload period expired. Your reserved food tickets were released. Please contact the event administrators if you already made a payment.”
