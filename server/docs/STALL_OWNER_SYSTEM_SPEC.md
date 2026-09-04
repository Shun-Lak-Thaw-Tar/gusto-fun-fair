# Stall Owner System Specification

## Purpose and account ownership

The Stall Owner subsystem gives each stall one read-only account for viewing its own catalog, approved sales, and shareable public-page data. Admin creates and manages these accounts; public registration always creates a normal `user`.

Stall owners use the existing login endpoint and User collection with `role = "stall_owner"`, one required `stallId`, and `isActive`. A partial unique database index permits only one owner account per stall. Names share the same global, case-insensitive login namespace as every other account.

Admin chooses the initial password and may reset it later. Passwords are immediately bcrypt-hashed and neither plaintext nor `passwordHash` is returned. Accounts are disabled/re-enabled rather than deleted. Deactivating a stall does not delete or automatically disable its owner.

## Private authorization boundary

All `/api/stall-owner/*` routes require existing JWT authentication, an active account, and the `stall_owner` role. Admin and normal users are not implicitly accepted. Controllers derive the private stall exclusively from `req.user.stallId`; no private endpoint accepts a caller-selected stall ID.

Owners cannot view customer details, payment proof, other stalls, other stalls' revenue, Admin orders, payment decisions, or Admin EventConfig. V1.3 permissions are read-only: owners cannot edit prices, discounts, limits, orders, payments, global event schedules, ordering controls, or event feature flags.

## Implemented endpoints

- `GET /api/stall-owner/dashboard` — safe owner identity, linked stall, approved revenue and sold quantity
- `GET /api/stall-owner/stall` — linked stall information and stable slug
- `GET /api/stall-owner/foods` — only linked-stall StallFood entries, populated with generic Food details and calculated preorder price/remaining tickets
- `GET /api/stall-owner/sales` — approved-only summary and food breakdown using historical OrderItem snapshots
- `GET /api/stall-owner/share` — event/stall/card data, food names, slug, and relative public path

The public `GET /api/stalls/by-slug/:slug` endpoint returns only an active stall and its currently available foods. It exposes no owner account or sales information.

## Share and invitation-card data

Slugs are readable, unique, generated at stall creation, and stable across stall-name edits. Duplicate names receive numeric suffixes. The share response supplies `/stalls/:slug`; it does not hard-code a deployment domain or generate a card image. The future React UI can render an invitation card from event name, stall name, batch, image reference, food names, and public path. Discounts are per StallFood, not stall-wide.

## Approved sales

Owner statistics count only `PAYMENT_APPROVED` OrderItem snapshots matching the authenticated owner's stall. Multi-stall orders are filtered item-by-item. Revenue uses stored subtotals, so later catalog edits cannot alter history.

## Future frontend

Planned pages are Owner Login, Owner Dashboard, My Stall, My Sales, Promote My Stall, and Invitation Card. No frontend is implemented in this backend milestone.

## Real launch workflow

Admin enters the real stall and foods, prices, discounts, and limits; creates one owner username/password; provides credentials privately; the owner logs in and automatically sees only the linked stall; the owner uses the generated public link. This workflow requires no source-code change.
