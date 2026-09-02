# Fun Fair Backend Architecture V1

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
- `src/services`: pricing, ticket, payment, inventory, and media boundaries
- `src/routes`: REST route composition
- `src/middleware`: authentication, authorization, errors, and 404 handling
- `seed`: development/demo catalog data and safe upsert script
- `test`: focused unit tests for pricing and ticket-code generation

Registration currently uses a unique name plus password; names are matched case-insensitively and passwords are hashed. Normal registration can only create a `user`. JWT-protected routes use a bearer token, and admin routes additionally enforce the `admin` role.

## Implemented API foundation

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/stalls`, `GET /api/stalls/:id`
- `GET /api/foods`, `GET /api/foods/:id`
- `GET|POST /api/orders`, `GET /api/orders/:id`
- `POST /api/payments/orders/:orderId`
- `GET /api/tickets/mine`; admin ticket lookup and redemption
- `GET|POST /api/memories` (upload references only; two-photo eligibility enforced)
- Admin payment review and best-selling-stall statistics

Order requests contain food item IDs and quantities. The server loads current prices and stall discounts and stores the calculated price snapshot. Only approved payments count toward best-selling statistics. Manual admin payment approval creates exactly one ticket for the whole order; ticket codes are random and uniquely indexed. Redemption keeps both the ticket and an audit record and prevents reuse.

## Intentional V1 boundaries

Stall and food records are demo data because final stall information is not available. MongoDB supports a dynamic number of stalls and foods, so real records can replace them without schema changes. Payment verification is manual KBZ verification; there is no gateway integration. The media service intentionally has no selected provider and models store provider-neutral references. Inventory reservation policy remains a documented placeholder until the team approves its rules. Website notifications are stored only in MongoDB; no external notification service is integrated.

Event configuration stores ordering windows and KBZ instructions. Its model enforces that pre-orders close at least one day before the event; final administration endpoints and ordering-window enforcement should be added when the team confirms the event-management workflow.

## Scripts

- `npm run dev` — development server with automatic restart
- `npm start` — production-style server start
- `npm run seed:demo` — safe development demo upsert
- `npm test` — unit tests
