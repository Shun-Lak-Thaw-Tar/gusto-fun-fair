# Fun Fair Backend V1.1

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
- `src/services`: event rules, order lifecycle, pricing, ticket, payment, inventory, and media boundaries
- `src/routes`: REST route composition
- `src/routes/admin`: one protected admin entry router with module-specific subrouters
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
- Admin payment review and best-selling-stall statistics

Order requests contain only food item IDs and quantities. Duplicate IDs are consolidated, the server calculates authoritative price snapshots, and conditional MongoDB updates immediately reserve tickets. Reservations last for the configurable 60-minute demo default. After external KBZ payment, the customer must declare payment before that deadline and then has the configurable 30-minute demo grace period to submit proof. Declaration permanently locks normal user cancellation because payments are non-refundable.

Expired undeclared orders become `EXPIRED`; declared orders without timely proof become `PAYMENT_EVIDENCE_EXPIRED`. Both release inventory exactly once. Submitted proofs remain reserved without timer expiry until an admin approves or rejects them. Approval converts reserved quantities to sold without changing remaining availability and creates one digital ticket. Rejection releases inventory, creates no ticket, and does not trigger or imply a refund. Only approved purchases count toward best-selling statistics.

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for request/response contracts and the complete lifecycle.

Parallel ownership and shared-logic rules are defined in [docs/TEAM_OWNERSHIP.md](docs/TEAM_OWNERSHIP.md). The future Admin System contract is defined in [docs/ADMIN_SYSTEM_SPEC.md](docs/ADMIN_SYSTEM_SPEC.md). The full Admin System is not implemented in V1.2; the folders are safe extension boundaries.

## Intentional V1 boundaries

Stall, food, and current-event records are demo data because final information is not available. MongoDB supports a dynamic number of stalls and foods, so real records can replace them without schema changes. Payment verification is manual KBZ verification; there is no gateway or refund integration. The media service intentionally has no selected provider and models store provider-neutral references. Website notifications are stored only in MongoDB; no external notification service is integrated.

Event configuration uses a unique `configKey: "current"` singleton. It stores ordering windows, reservation/grace durations, and KBZ instructions. The model enforces that pre-orders close at least one day before the event, and order creation enforces the enabled/open window server-side.

**Production readiness:** `DEMO Fun Fair 2030`, demo KBZ details, demo stalls, and demo foods must be replaced and verified before real pre-order sales open. Once customer orders exist, deactivate referenced stalls/foods instead of hard-deleting them.

Atomic conditional updates prevent any individual food item from exceeding its ticket limit. Multi-item orders compensate already-reserved items if a later reservation fails. A standalone MongoDB server cannot provide true multi-document ACID guarantees across several foods, the order, payment, notification, and ticket; transaction-capable replica-set or sharded deployment is required for that stronger guarantee.

## Scripts

- `npm run dev` — development server with automatic restart
- `npm start` — production-style server start
- `npm run seed:demo` — safe development demo upsert
- `npm test` — unit tests
