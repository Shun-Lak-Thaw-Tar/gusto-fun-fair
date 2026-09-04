# Fun Fair Backend V1.4

Node.js 24, Express, MongoDB, and Mongoose REST API foundation for the college Fun Fair food pre-order and digital ticketing system.

## Local setup

1. Install Node.js 24 LTS and MongoDB, then start MongoDB locally.
2. Enter this directory and run `npm install`.
3. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long local secret.
4. Run `npm run seed:demo` to add/update the clearly fictional demo catalog.
5. Run `npm run dev` (or `npm start`).
6. Visit `http://localhost:5000/api/health`.
7. Retrieve demo data from `GET /api/stalls` and `GET /api/foods`. Filter foods with `GET /api/foods?stallId=<id>`.

The default local database is `mongodb://127.0.0.1:27017/funfair`. The seed is idempotent for its named demo catalog and refuses to run when `NODE_ENV=production`; it does not wipe unrelated records. Optional demo admin credentials can be supplied through `SEED_ADMIN_NAME` and `SEED_ADMIN_PASSWORD` and are never hard-coded.

## Architecture

- `src/models`: MongoDB schemas and validation
- `src/controllers`: HTTP request handling
- `src/controllers/admin`: isolated Admin developer controller boundary
- `src/services`: event rules, order lifecycle, pricing, ticket, payment, inventory, shared sales, stall, and media boundaries
- `src/routes`: REST route composition
- `src/routes/admin`: one protected admin entry router with module-specific subrouters
- `src/routes/stallOwner`: one protected, stall-linked owner entry router
- `src/middleware`: authentication, authorization, errors, and 404 handling
- `seed`: development/demo catalog data and safe upsert script
- `test`: focused unit tests for pricing and ticket-code generation

Registration currently uses a unique name plus password; names are matched case-insensitively and passwords are hashed. Normal registration can only create a `user`. JWT-protected routes use a bearer token, and admin routes additionally enforce the `admin` role.

## Implemented API foundation

- `GET /api/health`
- `GET /api/event`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/stalls`, `GET /api/stalls/:id`
- `GET /api/foods`, `GET /api/foods/:id`
- `GET|POST /api/orders`, `GET /api/orders/:id`
- `POST /api/orders/:id/payment-declare`, `POST /api/orders/:id/cancel`
- `POST /api/payments/orders/:orderId`
- `GET /api/tickets/mine`; admin ticket lookup and redemption
- `GET|POST /api/memories` (upload references only; two-photo eligibility enforced)
- Public anonymous Crush Letter submission and approved-only paginated listing
- Admin payment review and best-selling-stall statistics

Order requests contain only canonical `stallFoodId` values and quantities. Duplicate IDs are consolidated, the server calculates authoritative price snapshots from the selected `StallFood`, and conditional MongoDB updates immediately reserve that stall-specific inventory. Deprecated `foodItemId` input is accepted only when it maps unambiguously to migrated data. Reservations last for the configurable 60-minute demo default. After external KBZ payment, the customer must declare payment before that deadline and then has the configurable 30-minute demo grace period to submit proof. Declaration permanently locks normal user cancellation because payments are non-refundable.

Expired undeclared orders become `EXPIRED`; declared orders without timely proof become `PAYMENT_EVIDENCE_EXPIRED`. Both release inventory exactly once. Submitted proofs remain reserved without timer expiry until an admin approves or rejects them. Approval converts reserved quantities to sold without changing remaining availability and creates one digital ticket. Rejection releases inventory, creates no ticket, and does not trigger or imply a refund. Only approved purchases count toward best-selling statistics.

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for request/response contracts and the complete lifecycle.

Parallel ownership and shared-logic rules are defined in [docs/TEAM_OWNERSHIP.md](docs/TEAM_OWNERSHIP.md). The Admin roadmap is defined in [docs/ADMIN_SYSTEM_SPEC.md](docs/ADMIN_SYSTEM_SPEC.md). The dashboard and existing payment/statistics routes are implemented; remaining Admin modules are safe future extension boundaries.

Backend V1.3 implements Admin stall/food/order/statistics/event/ticket management and Admin-controlled Stall Owner accounts. Stall Owners use the existing login, are linked to exactly one stall, and receive read-only private dashboard, stall, food, approved-sales, and share-card APIs. Backend V1.3.1 adds independent event schedule and feature controls. See [docs/STALL_OWNER_SYSTEM_SPEC.md](docs/STALL_OWNER_SYSTEM_SPEC.md).

## Intentional V1 boundaries

Stall, food, and current-event records are demo data because final information is not available. MongoDB supports a dynamic number of stalls and foods, so real records can replace them without schema changes. Payment verification is manual KBZ verification; there is no gateway or refund integration. The media service intentionally has no selected provider and models store provider-neutral references. Website notifications are stored only in MongoDB; no external notification service is integrated.

Event configuration uses a unique `configKey: "current"` singleton and `eventTimezone: "Asia/Yangon"`. New orders require both `orderingEnabled` and `preorderOpenAt <= now < preorderCloseAt`; the manual switch never overrides the authoritative schedule. Validation requires opening before closing and closing before the event, without an exact 24-hour rule. Independent `featureFlags.memoriesEnabled`, `featureFlags.eventPageEnabled`, and `featureFlags.crushLettersEnabled` default to `false`. Payment review/approval/rejection and ticket redemption intentionally have no feature switches.

Crush Letter V1.1 preserves anonymous no-login submission while adding EventConfig control, pending Admin moderation, approved-only public visibility, pagination, safe response fields, and a shared-network-friendly 30-successful-submissions-per-ten-minutes in-memory IP rate limit. Sender identity and IP addresses are never stored. See [docs/CRUSH_LETTER_SYSTEM_SPEC.md](docs/CRUSH_LETTER_SYSTEM_SPEC.md).

Launch preparation confirms preorder dates of 8 September 2026 through 10 September 2026 and an event date of 11 September 2026 in Myanmar Time. Exact opening and closing times remain unconfirmed and must be entered by an Admin when known; development data must not guess them. Two additional event-day controls are expected later, but their names and rules must be added explicitly only after requirements are confirmed.

**Production readiness:** `DEMO Fun Fair 2030`, demo KBZ details, demo stalls, and demo foods must be replaced and verified before real pre-order sales open. Once customer orders exist, deactivate referenced stalls/foods instead of hard-deleting them.

V1.4 separates reusable `Food` identity from the `StallFood` sellable relationship. Each relationship owns its price, discount, availability, and ticket inventory, so one Food can be offered by multiple stalls independently. See [docs/FOOD_STALLFOOD_DATA_MODEL.md](docs/FOOD_STALLFOOD_DATA_MODEL.md).

Atomic conditional updates prevent any individual StallFood entry from exceeding its ticket limit. Multi-item orders compensate already-reserved items if a later reservation fails. A standalone MongoDB server cannot provide true multi-document ACID guarantees across several menu entries, the order, payment, notification, and ticket; transaction-capable replica-set or sharded deployment is required for that stronger guarantee.

## Scripts

- `npm run dev` — development server with automatic restart
- `npm start` — production-style server start
- `npm run seed:demo` — safe development demo upsert
- `npm run migrate:foods` — idempotently migrate legacy FoodItem data (production requires `ALLOW_FOOD_MIGRATION=true`)
- `npm test` — unit tests
