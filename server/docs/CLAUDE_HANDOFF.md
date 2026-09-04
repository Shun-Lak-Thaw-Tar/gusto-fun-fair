# Claude handoff: Fun Fair media backend

Prepared on 2026-09-03. This is a continuation brief for the next assistant, not a request to rebuild the feature.

## Start here

The user is working on a team project. Their responsibility is the **backend for payment screenshots, event snaps, reactions, Cloudflare R2 setup, and the related admin endpoints**. Other teammates own the frontend and other project areas.

The backend feature has been implemented locally. The next requested step is **MongoDB setup first**, followed by live R2 setup and end-to-end verification. The conversation paused before the user answered whether a teammate already has a shared MongoDB Atlas database.

Ask that question before creating a duplicate team database. Read the existing code and preserve the current implementation and uncommitted work.

## Repository and working state

- Workspace: `C:\Users\HP\Desktop\gusto-fun-fair`
- Shell: PowerShell on Windows.
- Active branch verified at handoff: `codex/r2-media-and-gallery`.
- The user explicitly requested a feature branch before continuing development. Stay on it unless they request otherwise.
- The feature changes, dependencies, tests, and docs are **uncommitted and unpushed**. There are both modified tracked files and new untracked files. Do not reset, clean, or discard them.
- Only `main` existed locally when the feature branch was created. The older ownership document describes a `develop` workflow; inspect actual remotes/branches and coordinate integration instead of blindly following that example.
- If Claude runs against the same local folder, it can see these changes. If it uses a fresh clone or remote repository, it will not see them until they are deliberately transferred or committed/pushed.
- No frontend exists in this checkout. Do not expand this user's backend assignment into frontend development without a request.

## Agreed product requirements

### Images and storage

- JPEG, PNG, and WebP.
- Maximum **7 MB per file**; implementation defines this as 7 × 1024 × 1024 bytes.
- One image per snap and one screenshot per payment submission.
- Files are validated from actual bytes, decoded, and re-encoded to remove EXIF/GPS metadata.
- Implementation additionally accepts only single-frame images and limits decoding to 40 megapixels.
- Images go into a **private R2 bucket**. The API serves image bytes after checking the relevant access rules.
- Clients submit multipart files under the field `image`; client-supplied URLs/storage keys are not accepted as uploads.

### Payments and replacement screenshots

- An existing order/payment system is already present; extend it rather than create another.
- Screenshots are visible only to the order owner and authorized administrators.
- The initial proof must follow payment declaration and its existing deadline. Demo defaults: 60-minute order reservation, then 30-minute first-proof grace period.
- A submitted proof is locked while awaiting review.
- An admin can explicitly request another screenshot and **must provide a reason visible to the user**.
- Each request grants **exactly one replacement upload**. If that image is still wrong, another admin request is required.
- Requested replacements have **no time limit for now**.
- Previous screenshots and review reasons are retained privately as history.
- Quantities remain **reserved** while awaiting review or replacement. They count as **sold only after approval**.
- Final rejection releases inventory and is separate from a request for corrected proof. There is no automated refund.
- Admin review supplies the current `proofVersion`, preventing review of a stale screenshot.

### Event snaps and gallery

- A logged-in user without an approved order may post **one snap per event**.
- At least one **admin-approved order for that event** increases the allowance to **two total**, not two per order.
- Unpaid orders do not qualify for the extra photo.
- Admins configure the opening and closing date/time. Use Myanmar time for display (`Asia/Yangon`), explicit offsets in API inputs, and UTC instants in storage.
- Uploads are allowed at the opening instant and blocked at/after closing.
- The gallery is public, and photos appear immediately without prior approval.
- Show the uploader's current account name and an optional caption. Existing 300-character caption limit was retained.
- Owners may delete their photos and upload replacements **while the window is open**. This frees their slot.
- Admins may remove photos at any time. **Admin-removed photos still consume a slot**, and owners cannot undo that moderation by deleting the tombstone.

### Reactions

- Anyone may view the gallery; reacting requires login.
- One active LIKE or DISLIKE per user/photo.
- Users can switch reactions or remove their reaction.
- The API uses an idempotent PUT: LIKE, DISLIKE, or null. The frontend sends null when toggling the selected button off.
- Closing the upload window does not close gallery viewing or reactions.

## What is implemented

- R2 adapter using `@aws-sdk/client-s3`.
- Multipart handling with `multer`, validation/sanitization with `sharp`.
- Payment uploads, versioned private image access, required reupload reasons, and proof/review history.
- Transactional payment review, including inventory settlement, ticket creation, and notifications.
- Gallery pagination, account names/captions, photo allowances, admin windows, owner/admin deletion, and reactions.
- Database-enforced photo slots and reaction uniqueness, including concurrency coverage.
- Durable asset records: STAGED → ATTACHED or DELETE_PENDING.
- Deleted snaps become inaccessible through the API immediately. R2 deletion is retried by a server timer once per minute, in batches of 100; unattached assets older than one hour are also cleaned up.
- Setup, cleanup, migration, and isolated test scripts.
- API documentation and a detailed implementation report.

## Important files

All paths below are relative to the repository root.

| Area | Files |
| --- | --- |
| Full requirements/API/setup report | `server/docs/MEDIA_BACKEND_REPORT.md` |
| General API and team contracts | `server/docs/API_CONTRACT.md`, `server/docs/TEAM_OWNERSHIP.md`, `server/docs/ADMIN_SYSTEM_SPEC.md` |
| Runtime setup | `server/README.md`, `server/package.json`, `server/.env.example` |
| Database/environment | `server/src/config/db.js`, `server/src/config/env.js` |
| Image handling | `server/src/services/mediaService.js`, `server/src/middleware/uploadMiddleware.js`, `server/src/models/MediaAsset.js` |
| Photo rules | `server/src/services/memoryService.js`, `server/src/controllers/memoryController.js` |
| Photo models | `server/src/models/Memory.js`, `server/src/models/MemoryReaction.js`, `server/src/models/SnapSettings.js` |
| Photo routes | `server/src/routes/memoryRoutes.js`, `server/src/routes/admin/memoryRoutes.js` |
| Proof submission/access | `server/src/controllers/paymentController.js`, `server/src/routes/paymentRoutes.js` |
| Admin review | `server/src/controllers/admin/adminPaymentController.js`, `server/src/services/paymentService.js` |
| Shared changes | `server/src/models/Order.js`, `server/src/models/Payment.js`, `server/src/controllers/orderController.js`, `server/src/services/inventoryService.js` |
| New tests | `server/test/mediaIntegration.test.js`, `server/test/mediaValidation.test.js` |
| Existing lifecycle regression tests | `server/test/v11Lifecycle.test.js` |

## Main API routes

All protected requests require `Authorization: Bearer <JWT>`.

- `POST /api/payments/orders/:orderId`: owner submits an initial or granted replacement screenshot, multipart `image`.
- `GET /api/payments/orders/:orderId`: owner gets status, replacement reason, versions, and review history.
- `GET /api/payments/:id/proofs/:version`: private screenshot bytes for owner/admin.
- `GET /api/admin/payments`: admin lists submitted/replacement-requested payments.
- `PATCH /api/admin/payments/:id/review`: admin sends `decision`, `proofVersion`, and a reason where required.
- `GET /api/memories`: public current-event gallery; `limit` and `before` pagination.
- `POST /api/memories`: authenticated multipart `image` and optional `caption`.
- `GET /api/memories/window`: public window status.
- `GET /api/memories/allowance`: authenticated allowance/usage.
- `GET /api/memories/mine`: authenticated user's active/moderated photos.
- `GET /api/memories/:id/image`: public active photo.
- `DELETE /api/memories/:id`: owner deletion within the window.
- `GET|PUT /api/memories/:id/reaction`: authenticated reaction lookup/update.
- `GET|PUT /api/admin/memories/window`: admin window configuration.
- `DELETE /api/admin/memories/:id`: admin removal, slot retained.

Review decision values: `APPROVED`, `REJECTED`, `REUPLOAD_REQUESTED`. Both rejection and replacement requests require a reason of at most 500 characters. See the main report for examples and response shapes.

## MongoDB: current state and next action

MongoDB integration exists, but no permanent project database has been connected in this session.

- At the last check, no local listener existed on port 27017.
- `mongod`, `mongosh`, and Docker were not found on PATH, and no MongoDB Windows service was found.
- The downloaded test binary exists at `server/.mongodb-binaries/mongod-x64-win32-8.2.6.exe`. It is not a running permanent database or an installed Windows service.
- Ignored local `server/.env` exists with a generated JWT secret, blank R2 credentials, and this local database target:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/funfair?replicaSet=rs0
```

- **Replica-set or sharded MongoDB is required.** `connectDatabase()` checks this and initializes model indexes. Standalone MongoDB is rejected.
- The 84-test run used an isolated temporary replica set; this is not a shared development database and its test data was deleted.
- The user's immediate request was: “let's do mongo db first, there's already a thing for mongo db for the project right?”
- The unanswered question was: **“Has a teammate already created a shared MongoDB Atlas database for this project?”**

Once that is resolved, configure the appropriate connection privately in `.env`, check connectivity and transaction support, and start the backend. Do not seed, migrate, or wipe an existing shared database without first establishing what it contains and the intended changes. A connection check should not print credentials.

## R2: remaining work

- No live bucket was created or verified.
- No live Cloudflare credentials were available.
- `server/scripts/setup-r2.js` and `npm run r2:setup` can check/create a bucket using suitable credentials.
- Runtime variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- Runtime credentials should be scoped to Object Read & Write for the selected private bucket. Bucket creation requires stronger setup credentials or dashboard creation.
- Keep r2.dev public access/custom-domain access disabled. Payment proofs share the private storage design.
- Browsers upload to Express, so direct browser R2 CORS is not used.
- Run real upload/download/private-access/replacement/deletion checks after configuration. The automated tests mocked R2 object operations.

## Tests and commands

Run commands from `server/`; there is no root package.json.

```powershell
cd C:\Users\HP\Desktop\gusto-fun-fair\server
npm ci
npm test
npm run test:unit
npm run dev
```

Dependencies are already installed in this local checkout. `npm ci` is for a fresh checkout or deliberate dependency reinstall.

- Last full run: **84 passed, 0 failed**, on 2026-09-03.
- Node.js version: 24.11.1; temporary MongoDB version: 8.2.6.
- `npm test` runs `scripts/run-tests.js`, provisions an isolated temporary replica set, runs Node's test runner, and shuts down the replica set.
- Tests cover authorization, formats/size/captions, windows, one/two-photo allowances, concurrent uploads/reactions, owner/admin deletion, proof privacy, repeated replacement requests, stale reviews, inventory settlement/rollback, and cleanup retries, plus the original lifecycle tests.
- The first test run may need a large MongoDB binary download. It is already cached locally in the ignored `.mongodb-binaries` directory.
- These results establish local behavior with simulated storage; they do not prove a live R2 deployment works.

Other scripts:

```powershell
npm run seed:demo
npm run r2:setup
npm run media:cleanup
npm run migrate:media
```

The migration defaults to a dry run. `npm run migrate:media -- --apply` writes changes and should only be used after confirming the legacy orders belong to the current event.

## Compatibility and remaining limitations

- New orders have `eventId`. Legacy approved orders without it will not qualify for the extra photo until deliberately migrated.
- `migrate:media` refuses to proceed when legacy URL-only memories exist; importing those needs explicit asset/slot mapping.
- Old `paymentProof` references remain in the model, but only new uploads have private versioned image routes.
- New order state: `PAYMENT_REUPLOAD_REQUESTED`; corresponding payment state: `REUPLOAD_REQUESTED`. Both submitted and replacement-requested orders remain reserved and do not expire.
- Frontend/admin callers must use multipart files and supply `proofVersion` on reviews. Teammates' status filters must accommodate the new state.
- EventConfig remains a singleton. Do not recycle the same event ID for a new fair without designing rollover/migration.
- New media operations and payment settlement use transactions. Existing order creation/cancellation/expiry still use their original compensation logic; do not claim all backend operations are transaction-safe.
- General admin management modules and the entire frontend are still unfinished team work. This handoff covers the user's media backend assignment.
- Demo catalog, event, and KBZ details need replacement before real sales.
- Historical payment proofs have no automatic retention policy in this version.

## Collaboration preferences

- The user prefers discussing unclear product behavior before implementation; the rules above are already agreed and do not need to be asked again.
- Work on the feature branch. Preserve teammates' shared models and services when integrating.
- Continue necessary local work without repeatedly asking for permission already given. Ask concise questions for genuinely missing account/team information.
- Keep secrets in ignored local environment files. Do not paste `.env` contents, database passwords, or R2 keys into chat, documentation, or commits.
- Inspect the current code/diff before editing. These notes capture the last known state, not a substitute for checking changes made after this handoff.

## Suggested first message to Claude

> Continue this team project's backend from server/docs/CLAUDE_HANDOFF.md. Read server/docs/MEDIA_BACKEND_REPORT.md and inspect the uncommitted changes on codex/r2-media-and-gallery. The implementation passed 84 tests. Start with MongoDB setup: determine whether my team already has a shared Atlas database before provisioning anything new. Keep existing work and secrets safe; do not rebuild the feature from scratch.
