# GUSTO Fun Fair Backend Handoff

## Project Purpose

GUSTO Fun Fair is a Node.js/Express/MongoDB backend for a college fun fair platform.

It supports:

- Food pre-ordering

- Stall and food catalog management

- Manual KBZ payment verification

- Inventory reservation and ticket limits

- Digital ticket generation and redemption

- Customer event memories

- Anonymous Crush Letters

- Quiz participation using approved-order privilege codes

- Admin management

- Stall Owner dashboards

- Private Cloudflare R2 media storage

- Website notifications stored in MongoDB

The backend is implemented. The production React frontend is not part of the backend repository. A temporary React testing frontend exists in `frontend-test`.

## Technology

- Node.js 24+

- Express 5

- MongoDB

- Mongoose

- JWT authentication

- bcrypt password hashing

- Zod validation

- Helmet

- CORS

- Multer multipart uploads

- Sharp image validation/re-encoding

- Cloudflare R2 through AWS SDK v3

- MongoDB transactions

- Node.js test runner

- MongoDB Memory Server for automated tests

## Backend Location

```text

server/

```

Start commands:

```powershell

cd server

npm install

npm run dev

```

Or:

```powershell

npm start

```

Default server URL:

```text

http://localhost:5000

```

Health check:

```http

GET http://localhost:5000/api/health

```

Expected response:

```json
{
  "status": "ok",

  "message": "Fun Fair API is running"
}
```

## Environment Configuration

The backend reads `.env` using `dotenv`.

Important variables:

```env

NODE_ENV=development

PORT=5000

MONGODB_URI_DEVELOPMENT=<local replica-set URI>

MONGODB_URI_PRODUCTION=<private Atlas URI>

JWT_SECRET=<long secret>

JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:5173

SEED_ADMIN_NAME=<admin name>

SEED_ADMIN_PASSWORD=<admin password>

R2_ACCOUNT_ID=<Cloudflare account ID>

R2_ACCESS_KEY_ID=<R2 access key>

R2_SECRET_ACCESS_KEY=<R2 secret>

R2_BUCKET=<private bucket name>

```

Database selection:

- `NODE_ENV=development` uses `MONGODB_URI_DEVELOPMENT`.

- `NODE_ENV=production` uses `MONGODB_URI_PRODUCTION`.

- `NODE_ENV=test` uses the test URI supplied by the test runner.

- Production does not fall back to a local database.

- Missing production database configuration fails before startup.

MongoDB must be Atlas or a replica set. Standalone MongoDB is rejected because payment review and media workflows use transactions.

Never commit or expose `.env`.

## Project Architecture

### Models

Located in `models`:

- `User`

- `EventConfig`

- `Stall`

- `Food`

- `FoodItem` legacy migration model

- `StallFood`

- `Order`

- `Payment`

- `Ticket`

- `Redemption`

- `Notification`

- `Memory`

- `MemoryReaction`

- `MediaAsset`

- `SnapSettings`

- `CrushLetter`

- `PreorderPrivilegeUse`

- `QuizQuestion`

- `QuizAttempt`

### Services

Located in `services`:

- `eventService`

- `pricingService`

- `inventoryService`

- `orderLifecycleService`

- `paymentService`

- `ticketService`

- `mediaService`

- `memoryService`

- `preorderPrivilegeService`

- `quizService`

- `stallSalesService`

- `stallService`

- `foodMigrationService`

### Controllers

Controllers handle HTTP request and response behavior.

Admin controllers are isolated under:

```text

server/src/controllers/admin/

```

### Routes

Routes are organized by domain:

```text

server/src/routes/

server/src/routes/admin/

server/src/routes/stallOwner/

```

### Middleware

Important middleware includes:

- JWT authentication

- Admin authorization

- Stall Owner authorization

- Multipart upload handling

- Rate limiting

- Error formatting

- 404 handling

All JSON errors use approximately:

```json
{
  "error": {
    "message": "..."
  }
}
```

## Authentication and Roles

JWTs are supplied as:

```http

Authorization: Bearer <JWT>

```

Roles:

```text

user

admin

stall_owner

```

Public registration can only create a normal `user`.

Admin accounts are created through configured seed credentials.

Stall Owner accounts are created by admins and linked to exactly one stall.

Authentication endpoint:

```http

POST /api/auth/register

POST /api/auth/login

GET  /api/auth/me

```

Public registration body:

```json
{
  "name": "Test User",

  "password": "Password123!"
}
```

## Catalog Data Model

The current catalog uses:

```text

Stall ───< StallFood >─── Food

```

`Food` is reusable food identity.

`Stall` is a vendor/stall.

`StallFood` is the actual sellable relationship and owns:

- Stall reference

- Food reference

- Event-day price

- Discount

- Ticket limit

- Availability

- Reserved ticket count

- Sold ticket count

One Food can be sold by multiple stalls with different prices and discounts.

`FoodItem` remains only for legacy migration compatibility.

## Event Configuration

There is one singleton event:

```text

EventConfig.configKey = "current"

```

It stores:

- Event name

- Event date

- Event timezone

- Preorder opening

- Preorder closing

- Ordering switch

- KBZ information

- Reservation duration

- Payment-proof grace duration

- Feature flags

Supported feature flags:

```text

memoriesEnabled

eventPageEnabled

crushLettersEnabled

```

The timezone is:

```text

Asia/Yangon

```

Preorder is allowed only when:

```text

orderingEnabled === true

preorderOpenAt <= current time < preorderCloseAt

```

Event-feature actions use the configured event calendar day in Myanmar time.

Memory uploads also require the configured snap window.

## Orders

Create order:

```http

POST /api/orders

```

Requires authentication.

Body:

```json
{
  "items": [
    {
      "stallFoodId": "<STALL_FOOD_ID>",

      "quantity": 2
    }
  ]
}
```

The client must not send:

- Price

- Total

- Food name

- Discount

- Remaining quantity

- Inventory counters

The backend calculates all financial and inventory values.

Duplicate `stallFoodId` values are consolidated.

Order states:

```text

AWAITING_PAYMENT

PAYMENT_DECLARED

PAYMENT_SUBMITTED

PAYMENT_REUPLOAD_REQUESTED

PAYMENT_APPROVED

PAYMENT_REJECTED

PAYMENT_EVIDENCE_EXPIRED

CANCELLED

EXPIRED

```

Inventory states:

```text

RESERVED

SOLD

RELEASED

```

Order flow:

```text

Create order

  -> AWAITING_PAYMENT + RESERVED

Declare KBZ payment

  -> PAYMENT_DECLARED + RESERVED

Upload proof

  -> PAYMENT_SUBMITTED + RESERVED

Admin approves

  -> PAYMENT_APPROVED + SOLD

```

Alternative outcomes:

- Cancellation before payment declaration

- Reservation expiry

- Payment-proof expiry

- Admin rejection

- Admin replacement request

Orders reserve inventory immediately with conditional MongoDB updates.

Multi-item reservations compensate earlier reservations if a later item fails.

## Payment Workflow

Payment is manual KBZ verification.

There is no payment gateway, automatic verification, or refund integration.

Customer endpoints:

```http

POST /api/orders/:id/payment-declare

POST /api/payments/orders/:orderId

GET  /api/payments/orders/:orderId

GET  /api/payments/:id/proofs/:version

```

Payment proof upload requires multipart form data:

```text

image = JPEG, PNG, or WebP

```

The first proof must be submitted within the configured grace period.

Admin payment endpoint:

```http

GET   /api/admin/payments

PATCH /api/admin/payments/:id/review

```

Review decisions:

```text

APPROVED

REJECTED

REUPLOAD_REQUESTED

```

Approval body:

```json
{
  "decision": "APPROVED",

  "proofVersion": 1
}
```

Replacement request:

```json
{
  "decision": "REUPLOAD_REQUESTED",

  "proofVersion": 1,

  "reason": "The screenshot is unreadable."
}
```

Rejection:

```json
{
  "decision": "REJECTED",

  "proofVersion": 1,

  "reason": "The payment could not be verified."
}
```

Approval:

- Converts inventory from reserved to sold

- Changes order/payment state

- Creates one digital ticket

- Creates notification

- Generates a dedicated preorder privilege code

Rejection:

- Releases inventory

- Creates no ticket

- Does not refund the customer

## Digital Tickets

One approved order receives one digital ticket, regardless of the number of foods or stalls.

Customer:

```http

GET /api/tickets/mine

```

Admin:

```http

GET  /api/admin/tickets/:code

POST /api/admin/tickets/:code/redeem

```

Legacy admin-compatible routes also exist:

```http

GET  /api/tickets/:code

POST /api/tickets/:code/redeem

```

Ticket statuses include:

```text

ACTIVE

REDEEMED

CANCELLED

```

Redemption is whole-order based and cannot be repeated.

## Preorder Privilege Codes

`paymentReference` is the readable KBZ reference:

```text

FF-ORDER-XXXXXX

```

It is not used as the security-sensitive privilege code.

Approved orders receive:

```text

preorderPrivilegeCode

```

This is a high-entropy cryptographic code.

It is returned only through authenticated order-owner responses:

```http

GET /api/orders/:id

Authorization: Bearer USER_TOKEN

```

The code can independently be consumed once for:

```text

MEMORY_UPLOAD

QUIZ

```

The same code can therefore support one Memory privilege and one Quiz attempt.

It cannot be:

- Used by another user

- Used for an unapproved order

- Used for another event

- Reused for the same privilege

- Used after its privilege record is consumed

Consumption is tracked in:

```text

PreorderPrivilegeUse

```

with a unique index on:

```text

userId + orderId + privilege

```

## Crush Letters

Current implementation:

- Authentication required

- Event-day restriction

- Feature flag required

- Strict recipient/message validation

- New status is `PENDING`

- Admin moderation required

- Only approved letters are public

- Author identity is stored privately

- Public responses never expose author identity

- Approved letters remain visible after submissions close

- Rate limit applies to submissions

Customer:

```http

POST /api/crush-letters

GET  /api/crush-letters

```

Submission body:

```json
{
  "recipientName": "Alice",

  "message": "Hope you enjoy the fair!"
}
```

Admin:

```http

GET   /api/admin/crush-letters

GET   /api/admin/crush-letters/:id

PATCH /api/admin/crush-letters/:id/review

PATCH /api/admin/crush-letters/:id/visibility

```

Letter statuses:

```text

PENDING

APPROVED

REJECTED

HIDDEN

```

Public fields:

```text

id

recipientName

message

createdAt

```

The public API never exposes:

- `authorUserId`

- Username

- Email

- Reviewer

- Rejection reason

- Internal moderation metadata

Note: older README text may describe anonymous no-login submission, but the current implementation and updated tests require authentication.

## Memories

Memories use private Cloudflare R2 storage.

Features:

- Authenticated upload

- Camera-oriented frontend support

- Event-day restriction

- Snap-window restriction

- `memoriesEnabled` flag

- Pending moderation

- Public approved gallery

- Reactions

- Owner deletion

- Admin removal

- Upload allowance

- R2 cleanup

Memory statuses:

```text

PENDING

APPROVED

REJECTED

OWNER_DELETED

ADMIN_REMOVED

```

Customer endpoints:

```http

GET    /api/memories

GET    /api/memories/window

GET    /api/memories/allowance

GET    /api/memories/mine

GET    /api/memories/:id/image

POST   /api/memories

DELETE /api/memories/:id

GET    /api/memories/:id/reaction

PUT    /api/memories/:id/reaction

```

Admin endpoints:

```http

GET    /api/admin/memories?status=PENDING

GET    /api/admin/memories/:id/image

PATCH  /api/admin/memories/:id/review

DELETE /api/admin/memories/:id

GET    /api/admin/memories/window

PUT    /api/admin/memories/window

```

Memory upload form data:

```text

image

caption

privilegeCode

```

The first upload uses the normal allowance.

The second upload requires a valid approved-order `preorderPrivilegeCode`.

Deleting a Memory does not restore its consumed slot.

Only approved Memories appear publicly or can receive reactions.

Public Memory responses do not expose uploader identity.

## Media and R2

Runtime uploads use real Cloudflare R2.

Automated tests replace the R2 adapter with an in-memory test adapter.

Runtime R2 requires:

```env

R2_ACCOUNT_ID

R2_ACCESS_KEY_ID

R2_SECRET_ACCESS_KEY

R2_BUCKET

```

Images are:

- JPEG, PNG, or WebP

- Maximum 7 MB

- Maximum 40 megapixels

- Single-frame only

- Decoded with Sharp

- Re-encoded

- EXIF/GPS metadata removed

- Stored with server-generated keys

Storage keys are generated from:

```text

purpose/userId/randomUUID.extension

```

Users cannot provide arbitrary storage keys.

Media statuses include:

```text

STAGED

ATTACHED

DELETE_PENDING

```

Failed or rejected objects are queued for cleanup.

Cleanup commands:

```powershell

npm run media:cleanup

```

The server also runs periodic cleanup while active.

## Quiz

Quiz endpoints:

```http

POST /api/quiz/validate-code

POST /api/quiz/start

POST /api/quiz/:attemptId/submit

GET  /api/quiz/result/:attemptId

```

All require authentication and event-day availability.

Quiz flow:

```text

Validate privilege code

  -> Start Quiz

  -> Receive exactly five questions

  -> Submit exactly five answers

  -> Server calculates score

  -> Retrieve result

```

Question responses include:

```text

questionId

version

question

options

```

They never include:

```text

correctOption

answer key

score metadata

```

Attempts snapshot the questions and answer keys at start time.

Question-bank edits do not alter existing attempts.

The server ignores client-supplied:

```text

score

passed

reward

```

Passing requires:

```text

5 / 5

```

A Quiz privilege can only be consumed once per approved order code.

The reward is currently:

```text

NOT_ISSUED

```

There is no final prize-generation or redeemable reward system yet.

Questions are seeded through:

```powershell

npm run seed:demo

```

There is no Quiz question-admin API yet.

## Admin APIs

Admin authentication uses the normal JWT system plus:

```text

role = admin

```

Implemented admin areas:

- Dashboard

- Event configuration

- Stall management

- Food management

- StallFood management

- Stall Owner account management

- Order inspection

- Payment review

- Ticket lookup/redemption

- Statistics

- Letter moderation

- Memory moderation

- Memory snap-window management

Dashboard:

```http

GET /api/admin/dashboard

```

Statistics:

```http

GET /api/admin/statistics/overview

GET /api/admin/statistics/stalls

GET /api/admin/statistics/foods

GET /api/admin/statistics/best-selling-stall

```

Stalls:

```http

GET   /api/admin/stalls

POST  /api/admin/stalls

GET   /api/admin/stalls/:id

PATCH /api/admin/stalls/:id

PATCH /api/admin/stalls/:id/status

```

Foods:

```http

GET   /api/admin/foods

POST  /api/admin/foods

GET   /api/admin/foods/:id

PATCH /api/admin/foods/:id

```

StallFoods:

```http

GET   /api/admin/stall-foods

POST  /api/admin/stall-foods

GET   /api/admin/stall-foods/:id

PATCH /api/admin/stall-foods/:id

```

Orders:

```http

GET /api/admin/orders

GET /api/admin/orders/:id

```

Admin cannot arbitrarily edit order status.

## Stall Owner APIs

Stall Owner accounts are created by admins.

They use the normal login endpoint and receive:

```text

role = stall_owner

stallId = linked stall

```

Owner APIs:

```http

GET /api/stall-owner/dashboard

GET /api/stall-owner/stall

GET /api/stall-owner/foods

GET /api/stall-owner/sales

GET /api/stall-owner/share

```

All owner data is derived from the authenticated account’s linked stall.

Stall Owners can see:

- Their stall

- Their foods

- Calculated prices

- Remaining inventory

- Approved sales

- Revenue summary

- Public share information

They cannot:

- Edit catalog data

- Review payments

- See payment proofs

- See customer information

- Access other stalls

- Modify global event settings

## Scripts

```powershell

npm run dev

npm start

npm test

npm run test:unit

npm run seed:demo

npm run migrate:foods

npm run migrate:media

npm run media:cleanup

npm run r2:setup

```

`npm test` starts an isolated MongoDB replica set and runs the complete suite.

Latest verified result:

```text

242 tests

242 passing

0 failing

0 skipped

```

The temporary frontend also builds successfully.

## Migrations

Food migration:

```powershell

npm run migrate:foods

```

Media migration:

```powershell

npm run migrate:media

```

Apply reviewed media migration:

```powershell

npm run migrate:media -- --apply

```

Do not run production migrations casually. Verify the selected database and environment first.

## Current Limitations

- No production React frontend in the backend repository.

- Temporary frontend is for API testing only.

- No automatic KBZ payment verification.

- No refund integration.

- No external notifications.

- No final Quiz reward system.

- No Quiz question-admin API.

- One current-event singleton only.

- Exact production preorder times still need confirmation.

- Some old order operations use compensation instead of full multi-document transactions.

- Full transaction support requires Atlas or a replica-set deployment.

- No generic audit-log model.

- Demo event/catalog/KBZ values must be replaced before launch.

- Existing referenced catalog records should be deactivated rather than deleted.

## Recommended Next Work

Another AI agent should preserve these boundaries:

1. Do not duplicate pricing, inventory, payment, ticket, event, media, or Quiz privilege logic.

2. Use the existing services.

3. Keep the API server as the authorization boundary.

4. Treat all frontend input as untrusted.

5. Keep payment proofs private.

6. Never expose Letter authors publicly.

7. Never expose Quiz answer keys.

8. Preserve immutable order snapshots.

9. Preserve transaction and unique-index protections.

10. Add frontend features against the current API contract rather than changing backend behavior casually.

The most important reference files are:

- `README.md`

- `API_CONTRACT.md`

- `MEDIA_BACKEND_REPORT.md`

- `ADMIN_SYSTEM_SPEC.md`

- `STALL_OWNER_SYSTEM_SPEC.md`

- `TEAM_OWNERSHIP.md`

- `eventService.js`

- `orderLifecycleService.js`

- `paymentService.js`

- `memoryService.js`

- `quizService.js`
