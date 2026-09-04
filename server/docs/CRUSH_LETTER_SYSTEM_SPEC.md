# Crush Letter System Specification V1.1

## Purpose and privacy

Crush Letters are short Event Day messages addressed to a recipient. Submission is public and requires no account. The backend stores `recipientName`, `message`, `isAnonymous`, moderation state, timestamps, and lightweight Admin review metadata. It never stores a sender user ID, sender name, email, phone, device identifier, or IP address. Rate limiting uses the request IP transiently in process memory only.

User content is plain text. Future React interfaces must render `recipientName` and `message` as ordinary text and must not use `dangerouslySetInnerHTML`.

## Event control

`EventConfig.featureFlags.crushLettersEnabled` defaults to `false`. When false, `POST /api/crush-letters` returns `409`; when true, anonymous submission is accepted. This switch controls only new submissions. `GET /api/crush-letters` remains available so previously approved visible letters can still be displayed.

Only authenticated Admins can change the flag through the existing `PATCH /api/admin/event`. Normal users and Stall Owners cannot control or moderate the feature.

## Data and moderation

Each letter has `recipientName` (trimmed, 1–100 characters), `message` (trimmed, 1–1000 characters), immutable `isAnonymous = true`, `status`, `reviewedAt`, `reviewedBy`, and Mongoose timestamps. Request objects reject unknown fields.

Statuses are explicit:

- `PENDING`: submitted and awaiting review; default for new and legacy status-less records
- `APPROVED`: visible through the public list
- `REJECTED`: rejected and never public
- `HIDDEN`: previously approved but removed from public display

Admin may review `PENDING → APPROVED|REJECTED`, hide `APPROVED → HIDDEN`, and restore `HIDDEN → APPROVED`. These changes update `reviewedAt` and `reviewedBy`. There is no public edit/delete and no ordinary Admin hard-delete workflow.

## API

- `POST /api/crush-letters` — public, flag-controlled submission; returns a safe pending acknowledgement
- `GET /api/crush-letters?page=1&limit=20` — public approved-only list, newest first
- `GET /api/admin/crush-letters?status=PENDING&page=1&limit=20` — protected moderation list
- `GET /api/admin/crush-letters/:id` — protected moderation detail
- `PATCH /api/admin/crush-letters/:id/review` — strict `APPROVED` or `REJECTED` decision
- `PATCH /api/admin/crush-letters/:id/visibility` — strict `{ "hidden": true|false }` hide/restore action

Public and Admin lists default to 20 records per page and allow at most 50. Public responses expose only `id`, `recipientName`, `message`, and `createdAt`; they omit versioning and moderation metadata.

## Abuse protection

The POST route permits at most 30 successful submissions per transient IP key in ten minutes. This shared-network-friendly threshold reduces false blocks when many visitors use the same college Wi-Fi address. Failed validation and feature-closed responses do not consume the allowance. Excess requests return `429`. No IP is persisted in MongoDB, and no Redis, queue, CAPTCHA, or moderation service is required for V1.1.

## Future frontend

The public frontend still needs the anonymous form, closed-state message, approved-letter board, pagination, and success/error presentation. The Admin frontend still needs pending/approved/rejected/hidden views, review actions, hide/restore controls, and a confirmation-protected Event Settings toggle.
