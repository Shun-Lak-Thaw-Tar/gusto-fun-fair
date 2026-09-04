# Fun Fair Backend V1.4

Node.js 24+, Express 5, MongoDB/Mongoose, and Cloudflare R2 backend for food preorders, digital tickets, payment proofs, and the event photo gallery.

## Setup

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env`; set a secure JWT_SECRET.
3. Configure MONGODB_URI_DEVELOPMENT/MONGODB_URI_PRODUCTION for MongoDB Atlas or a replica set. Standalone MongoDB is not supported because uploads and payment review use transactions.
4. Configure the private R2 bucket and credentials using [the media setup report](docs/MEDIA_BACKEND_REPORT.md#cloudflare-r2-setup).
5. Run `npm run seed:demo` for fictional demo event/catalog data. Optional seed admin credentials are supplied through SEED_ADMIN_NAME and SEED_ADMIN_PASSWORD.
6. Run `npm run dev` or `npm start`. The default health endpoint is http://localhost:5000/api/health.

An unconfigured R2 connection returns 503 for uploads. Configure the snap window through the authenticated admin API before uploading photos.

Database selection is environment-based: development reads `MONGODB_URI_DEVELOPMENT` (or uses the documented local default when omitted), production reads the private `MONGODB_URI_PRODUCTION` Atlas URI, and automated tests retain their explicitly isolated test databases. Missing `NODE_ENV` defaults to development. Production never falls back to a local database, and missing production configuration fails before connection without logging the URI. Real credentials belong only in an ignored `.env` file or deployment environment variables.

The seed is idempotent for its named demo catalog and does not wipe unrelated records. It uses the database selected by `NODE_ENV`; therefore running `npm run seed:demo` in production intentionally affects the shared Atlas database and must be done with care. It is never run automatically at application startup. Optional demo admin credentials can be supplied through `SEED_ADMIN_NAME` and `SEED_ADMIN_PASSWORD` and are never hard-coded.

## Architecture

- `src/models`: MongoDB schemas and validation
- `src/controllers`: HTTP request handling
- `src/controllers/admin`: isolated Admin developer controller boundary
- `src/services`: event rules, order lifecycle, pricing, ticket, payment, inventory, shared sales, stall, and media boundaries
- `src/routes`: REST route composition
- `src/routes/admin`: one protected admin entry router with module-specific subrouters
- `src/routes/stallOwner`: one protected, stall-linked owner entry router
- `src/middleware`: authentication, authorization, file upload (multipart), errors, and 404 handling
- `seed`: development/demo catalog data and safe upsert script
- `test`: unit and integration tests, including media/R2 and payment-proof coverage

Registration currently uses a unique name plus password; names are matched case-insensitively and passwords are hashed. Normal registration can only create a `user`. JWT-protected routes use a bearer token, and admin routes additionally enforce the `admin` role.

## Payments, media, and the event gallery

Orders contain server-calculated price snapshots and immediately reserve inventory. Users declare external KBZ payment before the reservation expires and upload their first screenshot within the configured grace period. Defaults are 60 minutes for reservations and 30 minutes for first proof.

Submitted proofs stay reserved for manual review. Admins can approve, finally reject, or request one replacement with a required reason; requested replacements have no deadline and submitting one locks the proof again. Only approval converts reserved quantities to sold and issues one digital ticket; final rejection releases stock without a refund. Earlier proofs and review reasons remain available privately as history.

The public gallery displays account names, captions, and reaction counts. Login is required to upload or react. Users get one photo per event, or two with an approved order. Admins set the upload window and can remove photos at any time; admin removal still consumes the slot.

All images (payment screenshots and event snaps) are stored in a private R2 bucket and served through authorization-aware API routes. Uploads accept JPEG, PNG, and WebP up to 7 MB, are decoded/re-encoded to strip EXIF/GPS metadata, and are limited to single-frame images up to 40 megapixels. Deleted snaps become inaccessible immediately; background cleanup retries R2 deletion. See [the media backend report](docs/MEDIA_BACKEND_REPORT.md) for the full API contract, setup steps, and verification results.

## Implemented API foundation

- `GET /api/health`
- `GET /api/event`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/stalls`, `GET /api/stalls/:id`
- `GET /api/foods`, `GET /api/foods/:id`
- `GET|POST /api/orders`, `GET /api/orders/:id`
- `POST /api/orders/:id/payment-declare`, `POST /api/orders/:id/cancel`
- `POST /api/payments/orders/:orderId` (multipart screenshot upload), `GET /api/payments/orders/:orderId`, `GET /api/payments/:id/proofs/:version`
- `GET /api/admin/payments`, `PATCH /api/admin/payments/:id/review`
- `GET /api/tickets/mine`; admin ticket lookup and redemption
- `GET|POST /api/memories` (multipart image upload; two-photo eligibility enforced), `GET /api/memories/window`, `GET /api/memories/allowance`, `GET /api/memories/mine`, `GET /api/memories/:id/image`, `DELETE /api/memories/:id`, `GET|PUT /api/memories/:id/reaction`
- `GET|PUT /api/admin/memories/window`, `DELETE /api/admin/memories/:id`
- Public anonymous Crush Letter submission and approved-only paginated listing
- Admin payment review, media moderation, and best-selling-stall statistics

Order requests contain only canonical `stallFoodId` values and quantities. Duplicate IDs are consolidated, the server calculates authoritative price snapshots from the selected `StallFood`, and conditional MongoDB updates immediately reserve that stall-specific inventory. Deprecated `foodItemId` input is accepted only when it maps unambiguously to migrated data. Reservations last for the configurable 60-minute demo default. After external KBZ payment, the customer must declare payment before that deadline and then has the configurable 30-minute demo grace period to submit proof. Declaration permanently locks normal user cancellation because payments are non-refundable.

Expired undeclared orders become `EXPIRED`; declared orders without timely proof become `PAYMENT_EVIDENCE_EXPIRED`. Both release inventory exactly once. Submitted and replacement-requested proofs remain reserved without timer expiry until an admin approves or rejects them. Approval converts reserved quantities to sold without changing remaining availability and creates one digital ticket. Rejection releases inventory, creates no ticket, and does not trigger or imply a refund. Only approved purchases count toward best-selling statistics.

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for request/response contracts and the complete lifecycle, and [docs/MEDIA_BACKEND_REPORT.md](docs/MEDIA_BACKEND_REPORT.md) for the media/payment-proof contract specifically.

Parallel ownership and shared-logic rules are defined in [docs/TEAM_OWNERSHIP.md](docs/TEAM_OWNERSHIP.md). The Admin roadmap is defined in [docs/ADMIN_SYSTEM_SPEC.md](docs/ADMIN_SYSTEM_SPEC.md). Backend V1.3 implements Admin stall/food/order/statistics/event/ticket management and Admin-controlled Stall Owner accounts; media administration and payment review (including replacement requests) are also implemented. Stall Owners use the existing login, are linked to exactly one stall, and receive read-only private dashboard, stall, food, approved-sales, and share-card APIs. Backend V1.3.1 adds independent event schedule and feature controls. See [docs/STALL_OWNER_SYSTEM_SPEC.md](docs/STALL_OWNER_SYSTEM_SPEC.md).

## Intentional V1 boundaries

Stall, food, and current-event records are demo data because final information is not available. MongoDB supports a dynamic number of stalls and foods, so real records can replace them without schema changes. Payment verification is manual KBZ verification; there is no gateway or refund integration. Media (payment screenshots and event snaps) is stored in a private Cloudflare R2 bucket; models store provider-neutral references so the storage backend could still be swapped without a schema change. Website notifications are stored only in MongoDB; no external notification service is integrated.

Event configuration uses a unique `configKey: "current"` singleton and `eventTimezone: "Asia/Yangon"`. New orders require both `orderingEnabled` and `preorderOpenAt <= now < preorderCloseAt`; the manual switch never overrides the authoritative schedule. Validation requires opening before closing and closing before the event, without an exact 24-hour rule. Independent `featureFlags.memoriesEnabled`, `featureFlags.eventPageEnabled`, and `featureFlags.crushLettersEnabled` default to `false`. Payment review/approval/rejection and ticket redemption intentionally have no feature switches.

Crush Letter V1.1 preserves anonymous no-login submission while adding EventConfig control, pending Admin moderation, approved-only public visibility, pagination, safe response fields, and a shared-network-friendly 30-successful-submissions-per-ten-minutes in-memory IP rate limit. Sender identity and IP addresses are never stored. See [docs/CRUSH_LETTER_SYSTEM_SPEC.md](docs/CRUSH_LETTER_SYSTEM_SPEC.md).

Launch preparation confirms preorder dates of 8 September 2026 through 10 September 2026 and an event date of 11 September 2026 in Myanmar Time. Exact opening and closing times remain unconfirmed and must be entered by an Admin when known; development data must not guess them. Two additional event-day controls are expected later, but their names and rules must be added explicitly only after requirements are confirmed.

**Production readiness:** `DEMO Fun Fair 2030`, demo KBZ details, demo stalls, and demo foods must be replaced and verified before real pre-order sales open. Once customer orders exist, deactivate referenced stalls/foods instead of hard-deleting them.

V1.4 separates reusable `Food` identity from the `StallFood` sellable relationship. Each relationship owns its price, discount, availability, and ticket inventory, so one Food can be offered by multiple stalls independently. See [docs/FOOD_STALLFOOD_DATA_MODEL.md](docs/FOOD_STALLFOOD_DATA_MODEL.md).

Atomic conditional updates prevent any individual StallFood entry from exceeding its ticket limit. Multi-item orders compensate already-reserved items if a later reservation fails. A standalone MongoDB server cannot provide true multi-document ACID guarantees across several menu entries, the order, payment, notification, and ticket; transaction-capable replica-set or sharded deployment is required for that stronger guarantee. Media uploads and payment review use the same transactional guarantee for their own multi-document updates (asset attachment, order/payment state, inventory settlement, and photo-slot claims).

## Scripts

- `npm run dev` — development server with automatic restart
- `npm start` — production-style server start
- `npm test` — full suite with an isolated temporary MongoDB replica set
- `npm run test:unit` — checks that do not need a database
- `npm run seed:demo` — idempotent fictional demo catalog upsert; refuses production without explicit confirmation
- `npm run migrate:foods` — idempotently migrate legacy FoodItem data (production requires `ALLOW_FOOD_MIGRATION=true`)
- `npm run migrate:media` — dry-run legacy order/event migration for the two-photo allowance; pass `-- --apply` to apply after review
- `npm run r2:setup` — create/check the private R2 bucket using configured credentials
- `npm run media:cleanup` — retry queued R2 object deletions

## Database environments

For normal local work use `NODE_ENV=development` with `MONGODB_URI_DEVELOPMENT` (must be a replica set — standalone MongoDB is rejected because uploads and payment review use transactions). Hosted production uses `NODE_ENV=production` with a privately supplied `MONGODB_URI_PRODUCTION`. Tests connect directly to their own isolated test databases and never select the production variable. Mongoose supports both normal `mongodb://` and Atlas `mongodb+srv://` connection strings without an Atlas-specific SDK.

## Contracts and team boundaries

- [Core API contract](docs/API_CONTRACT.md)
- [Media requirements, API examples, setup, migration, and verification](docs/MEDIA_BACKEND_REPORT.md)
- [Team ownership](docs/TEAM_OWNERSHIP.md)
- [Admin system specification](docs/ADMIN_SYSTEM_SPEC.md)
- [Stall Owner system specification](docs/STALL_OWNER_SYSTEM_SPEC.md)
- [Food/StallFood data model](docs/FOOD_STALLFOOD_DATA_MODEL.md)
- [Crush Letter system specification](docs/CRUSH_LETTER_SYSTEM_SPEC.md)

The React frontend is not implemented. General admin dashboard, stall/food/order/statistics/event/ticket management, Stall Owner accounts, media administration (R2 uploads and the event gallery), and payment review (including replacement requests) are all implemented on the backend.

Replace and verify all demo event, food, stall, and KBZ values before real sales. Deactivate referenced catalog records instead of deleting them. Payment review and media operations use transactions; legacy order creation/cancellation/expiry retain their existing compensation-based implementation.
