# Stall Owner Portal

A standalone React/Vite site for stall owners. It is separate from the `Admin`
workspace and uses the same existing backend in `server` through the `/api`
proxy. No backend business logic lives here.

## Run it

Double-click `Open Stall Owner Portal.cmd` in the project root. It starts the
database and backend (through the existing `Admin/scripts/start-local.mjs`),
installs this site's dependencies the first time, then opens the portal.

From a terminal instead:

    cd "stall owner"
    npm install
    npm run dev

The backend must be running on port 5000; the main launcher starts it.

- Portal: http://127.0.0.1:5174/login
- Admin workspace: http://127.0.0.1:5173/admin/login

## Sign in

Only `stall_owner` accounts are accepted; administrators are rejected with a
message and use their own workspace. Accounts are created by an administrator
under Stall Owners, one per stall.

## Pages

| Route | Backend endpoint |
| --- | --- |
| `/stall-owner/dashboard` | `GET /api/stall-owner/dashboard`, `/sales`, `/orders` |
| `/stall-owner/stall` | `GET /api/stall-owner/stall` |
| `/stall-owner/menu` | `GET /api/stall-owner/foods` + `/sales` |
| `/stall-owner/orders` | `GET /api/stall-owner/orders` |
| `/stall-owner/sales` | `GET /api/stall-owner/sales` |
| `/stall-owner/share` | `GET /api/stall-owner/share` |
| `/invite/:slug` | `GET /api/stalls/by-slug/:slug`, `GET /api/event` (public — no login) |

Every figure comes from the backend. Only `PAYMENT_APPROVED` orders count, and
each endpoint filters order items to the signed-in owner's stall, so a
multi-stall order shows only that owner's foods.

One approved order creates exactly one digital ticket; food quantities are
labelled separately as "food items ordered" so the two are never confused.

## Public invitation (`/invite/:slug`)

An animated, unauthenticated invitation page for anyone with the link — no
sign-in, and it never calls any `/api/stall-owner/*` route. It reads only the
already-public `GET /api/stalls/by-slug/:slug` and `GET /api/event`. The
authenticated Share page (`/stall-owner/share`) generates and shares this
page's own URL (`<this portal's origin>/invite/:slug`), which is distinct
from the final customer destination.

The "Enter the Stall" button and "View Public Stall" link both go to the
customer site, which is a separate, already-hosted repository this project
never modifies:

    https://funfair.gustocollegeprojects.com/stalls/:slug

That destination is controlled by `VITE_PUBLIC_SITE_URL` (a build-time Vite
env var), defaulting to the URL above when unset — it is never derived from
`window.location`, since the customer site is not this app.

### Deployment note

`/invite/:slug` is a client-side route with no matching static file, so
whatever serves this portal's production build **must** fall back to
`index.html` for it (and for direct navigation/refresh on any other route).
For Nginx this typically means the frontend's `location` block needs:

    try_files $uri $uri/ /index.html;

Whoever manages the EC2/Nginx configuration for this portal should confirm
this is in place before relying on `/invite/:slug` links in production —
this repository does not manage or verify that configuration.

## Files

    index.html            entry document
    vite.config.js        dev server on 5174, /api proxy to the backend
    src/main.jsx           sign in, session handling, routes (incl. the public /invite/:slug route)
    src/stall-owner.jsx    layout, sidebar, header and the six authenticated pages
    src/stall-owner.css    authenticated-portal styling
    src/invite.jsx          public PublicInvitation page
    src/invite.css          invitation styling and animation, isolated from stall-owner.css
    src/base.css           palette and shared element styles
    src/api.js             fetch wrapper, token storage, formatting, PUBLIC_SITE_URL
    src/ui.jsx             loading/error state, table, toolbar, modal, badge, form
    src/icons.jsx          navigation icons
    test/invite.test.js    unit test for the customer-destination URL logic (`npm test`)
