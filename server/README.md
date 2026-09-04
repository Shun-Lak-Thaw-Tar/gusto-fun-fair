# Fun Fair backend

Node.js 24+, Express 5, MongoDB/Mongoose, and Cloudflare R2 backend for food preorders, digital tickets, payment proofs, and the event photo gallery.

## Setup

1. Run `npm ci` in this directory.
2. Copy `.env.example` to `.env`; set a secure JWT_SECRET.
3. Configure MONGODB_URI for MongoDB Atlas or a replica set. Standalone MongoDB is not supported because uploads and payment review use transactions.
4. Configure the private R2 bucket and credentials using [the media setup report](docs/MEDIA_BACKEND_REPORT.md#cloudflare-r2-setup).
5. Run `npm run seed:demo` for fictional demo event/catalog data. Optional seed admin credentials are supplied through SEED_ADMIN_NAME and SEED_ADMIN_PASSWORD.
6. Run `npm run dev` or `npm start`. The default health endpoint is http://localhost:5000/api/health.

An unconfigured R2 connection returns 503 for uploads. Configure the snap window through the authenticated admin API before uploading photos.

## Scripts

- `npm run dev`: development server
- `npm start`: server
- `npm test`: full suite with isolated temporary MongoDB replica set
- `npm run test:unit`: checks that do not need a database
- `npm run seed:demo`: idempotent fictional demo catalog; refuses production
- `npm run r2:setup`: create/check the private bucket using configured credentials
- `npm run media:cleanup`: retry queued object deletions
- `npm run migrate:media`: dry-run legacy order/event migration; pass `-- --apply` to apply after review

## Features and architecture

Routes call controllers and shared services; MongoDB models define persistence and validation. JWT registration/login uses case-insensitive account names and hashed passwords. Normal registration creates users; admin routes additionally enforce the admin role.

Orders contain server-calculated price snapshots and immediately reserve inventory. Users declare external KBZ payment before the reservation expires and upload their first screenshot within the configured grace period. Defaults are 60 minutes for reservations and 30 minutes for first proof.

Submitted proofs stay reserved for manual review. Admins can approve, finally reject, or request one replacement with a required reason. Requested replacements have no deadline. Only approval converts reserved quantities to sold and issues one digital ticket; final rejection releases stock without a refund.

The public gallery displays account names, captions, and reaction counts. Login is required to upload or react. Users get one photo per event, or two with an approved order. Admins set the upload window and can remove photos.

All images are stored in a private R2 bucket and served through authorization-aware API routes. Uploads accept JPEG, PNG, and WebP up to 7 MB. Deleted snaps become inaccessible immediately; background cleanup retries R2 deletion.

## Contracts and team boundaries

- [Core API contract](docs/API_CONTRACT.md)
- [Media requirements, API examples, setup, migration, and verification](docs/MEDIA_BACKEND_REPORT.md)
- [Team ownership](docs/TEAM_OWNERSHIP.md)
- [Admin system specification](docs/ADMIN_SYSTEM_SPEC.md)

The React frontend is not implemented. General admin dashboard and catalog/event CRUD remain extension boundaries; media administration, payment review, statistics, and existing ticket verification are implemented.

Replace and verify all demo event, food, stall, and KBZ values before real sales. Deactivate referenced catalog records instead of deleting them. Payment review and media operations use transactions; legacy order creation/cancellation/expiry retain their existing compensation-based implementation.
