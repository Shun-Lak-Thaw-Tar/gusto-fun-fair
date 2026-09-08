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

Every figure comes from the backend. Only `PAYMENT_APPROVED` orders count, and
each endpoint filters order items to the signed-in owner's stall, so a
multi-stall order shows only that owner's foods.

One approved order creates exactly one digital ticket; food quantities are
labelled separately as "food items ordered" so the two are never confused.

## Files

    index.html            entry document
    vite.config.js        dev server on 5174, /api proxy to the backend
    src/main.jsx          sign in, session handling, routes
    src/stall-owner.jsx   layout, sidebar, header and the six pages
    src/stall-owner.css   portal styling
    src/base.css          palette and shared element styles
    src/api.js            fetch wrapper, token storage, formatting
    src/ui.jsx            loading/error state, table, toolbar, modal, badge, form
    src/icons.jsx         navigation icons
