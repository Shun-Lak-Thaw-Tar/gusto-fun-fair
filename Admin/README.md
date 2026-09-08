# Monitor — Gusto Event Admin

## Project location

The frontend is now located at `C:\fun fair\gusto-fun-fair-main\Admin` and uses the existing backend in `C:\fun fair\gusto-fun-fair-main\server`. The earlier frontend folder was moved from the other project copy, along with the ignored local database and admin configuration. Login, session refresh, and all 13 pages were verified after relocation. Run `npm run dev:full` from this `Admin` directory; the website remains at http://127.0.0.1:5173/admin/login.

React frontend for the existing Fun Fair backend. No backend files or business rules are changed.

## Run

For the configured local environment, run **`npm run dev:full`** from this directory. This starts the existing backend on port 5000, the frontend on port 5173, and a dedicated persistent MongoDB replica set on port 27018. It uses `funfair_monitor_local`, leaving the pre-existing standalone MongoDB on port 27017 untouched. The first launch uses the existing backend demo seed; subsequent launches retain data.

Open http://127.0.0.1:5173/admin/login. The generated local administrator name and password are in `../data/monitor-local/admin-credentials.txt`. Runtime secrets and database files are ignored by Git. Logs are in the same directory. This environment contains **fictional demo event/catalog information**, not production event settings. Live test fixtures are marked TEST; created test stalls and foods are deactivated, test owners are disabled, test letters are hidden, and test orders are cancelled after verification.

On another Windows installation, set `MONGOD_PATH` if MongoDB is not installed at the default 8.3 path. This launcher is local development tooling, not a deployment system. Services stay running in the background. The existing backend source, models, and services are unchanged.

**Image storage is still external configuration:** provide a local environment file containing the four existing `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` values using `MONITOR_MEDIA_ENV_FILE`. The launcher remembers the file path and loads only those storage keys. Restart the local API after changing storage configuration. No alternate storage backend or fake upload success is added; the backend returns its existing error until R2 is configured.

From this `Admin` directory, run `npm install`, then `npm run dev`. Open http://localhost:5173/admin/login and sign in with an existing admin account. The Vite proxy forwards `/api` to http://127.0.0.1:5000. Start the existing backend using its own documented setup; it needs its configured MongoDB replica set and environment. This client does not seed accounts or modify the database schema.

Use `API_PROXY_TARGET` to override the development backend target. For production, run `npm run build` and serve `dist` with history fallback to `index.html` and a same-origin `/api` reverse proxy. Alternatively set `VITE_API_BASE_URL` at build time to a trusted API origin that the backend already permits through CORS. Do not expose the Vite development server as production hosting.

## Verification

`npm test` checks timezone conversion, status compatibility, authenticated review payloads, and server error propagation. `npx playwright test` runs browser tests with isolated mocked API responses, using installed Microsoft Edge on Windows and Playwright Chromium elsewhere. `npm run build` checks the production bundle. Browser mocks are test-only; the shipped application never fabricates successful backend data.

Verified on 5 September 2026: production build passed, 3 focused tests passed, and 10 browser tests passed. Browser coverage includes all 13 routes, unauthenticated/non-admin access, payment approval/rejection with proof version, ticket lookup/redemption, error retry, stall creation, menu payload ownership, event timezone conversion, order search/filter/details, and tablet/mobile overflow checks. The dashboard screenshot was visually inspected. The local backend health endpoint on port 5000 was unreachable, so live login and database integration were not exercised. Git inspection confirmed no backend changes.

**Subsequent live verification:** the dedicated replica set and unchanged backend now run locally. `npm run test:live` passed four live browser workflows without mocked API responses: real admin login/session refresh and all 13 pages; catalog/menu creation and backend-calculated price/stock; owner creation and disabling; event settings/feature controls; anonymous letter submission/approval/hiding; and customer order creation, admin detail display, cancellation, and non-admin API rejection. The existing backend media/lifecycle suites also passed all 64 checks against isolated test databases on the replica set; these suites use the backend's existing test storage adapter, so they do not verify Cloudflare R2 connectivity. Real image storage remains unverified until credentials are provided.

## Architecture and inspection findings

The Git checkout contained only `server`; there was no existing React frontend, client router, styling library, icon library, or auth client to reuse. `client` adds a small React/Vite application with React Router, a shared API adapter, reusable UI, and grouped page modules. Navigation uses monochrome text symbols styled in the five requested colors.

Authentication uses the existing `/api/auth/login` name/password endpoint and `/api/auth/me`. The returned JWT is kept in session storage, validated on reload, attached to requests, and cleared on unauthorized responses or sign out. The server continues to enforce database-backed admin role checks. There is no registration page or alternate login service.

All 13 routes are under `/admin`. Shared loading, error/retry, empty, table pagination, modal, action, and form components are used throughout. Tables scroll horizontally; navigation collapses on tablets. Dates are explicitly displayed and edited in Asia/Yangon, independent of the operator's computer timezone.

## API mapping and boundaries

- Dashboard/statistics use `/admin/dashboard`, `/admin/statistics/overview`, `/stalls`, `/foods`, and `/best-selling-stall`. The bar chart compares server-approved revenue by stall. No frontend sales or inventory calculation is substituted.
- Orders use `/admin/orders` and `/:id`; exact backend status values are preserved, including `PAYMENT_REUPLOAD_REQUESTED`.
- Payments use `/admin/payments` and `/:id/review`, including mandatory current `proofVersion`, a reason for rejection/reupload, authenticated proof bytes, and confirmation. Backend conflicts are surfaced without optimistic approval.
- Tickets use `/admin/tickets/:code` and `/:code/redeem`. Required physical quantities come directly from `order.totalQuantity`.
- Catalog CRUD uses `/admin/foods`; stall CRUD uses `/admin/stalls`. The V1.4 backend owns selling fields on `/admin/stall-foods`, so price, discounts, limits, stock, and availability are in Stall Menus. Preorder price and remaining stock are read-only server values.
- Owners are retrieved per stall using `/admin/stalls/:stallId/owner`, with existing create, password, and status endpoints.
- Event and switches patch the existing `/admin/event` singleton and its supported featureFlags. No new flags are invented.
- Memories use the active public gallery `/memories`, cursor pagination, `/admin/memories/window`, and admin removal. Window and feature flag remain separate backend concepts. Eligibility text reflects the current backend: one photo, two with an approved purchase.
- Letters use paginated `/admin/crush-letters` plus review and visibility endpoints. The review API accepts only a decision, so there is no unsupported rejection reason field.

## Missing APIs / unsupported requested operations

These are proposals for later backend discussion only; no calls to them are made and no backend files are modified.

| Missing API | Expected / suggested endpoint | Frontend need and current behavior |
| --- | --- | --- |
| Hard removal of a stall-food assignment | `DELETE /api/admin/stall-foods/:id` | No route exists. The UI offers supported availability disabling to preserve historical references. |
| Reassign an existing owner to another stall | `PATCH /api/admin/stall-owners/:id/stall` | Existing APIs create one owner for the chosen stall. Reassignment is not exposed. |
| Unified owner listing | `GET /api/admin/stall-owners` | The client currently joins the stall list with each supported owner lookup; a single list endpoint would scale better. |
| Historical / removed memory moderation list | `GET /api/admin/memories?status=...` | The existing gallery exposes active submissions only. Search is explicitly scoped to the current gallery page. |
| Revenue time series | `GET /api/admin/statistics/sales?interval=day` | Sales overview uses supported aggregate revenue by stall, without inventing daily figures. |

Stall-wide discounts and food-catalog selling fields are intentionally not suggested as duplicate systems: the existing StallFood API already supports the requested functionality at its authoritative ownership boundary.
