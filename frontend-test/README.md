# GUSTO Fun Fair backend test frontend

Temporary React/Vite client for manually exercising the real GUSTO Fun Fair API as a customer, administrator, or Stall Owner. It contains no mock data and intentionally exposes raw responses and backend errors.

## Run

```powershell
cd frontend-test
Copy-Item .env.example .env
npm install
npm run dev
```

The default API is `http://localhost:5000/api`. Change `VITE_API_BASE_URL` in `.env` when needed. Run the backend separately:

```powershell
cd server
npm install
npm run dev
```

## Testing order

Health -> register/login -> catalog -> cart/order -> payment declaration -> proof upload -> admin review -> ticket -> memories -> Crush Letters -> Stall Owner.

Use the Developer page for the API base URL, current role, session presence, connection test, and raw debugging context. Admin and owner routes are intentionally reachable even with the wrong role so the backend's 401/403 responses remain visible.

## Implemented screens

Customer: Home, Login/Register, Catalog, Cart, Orders, payment proof/re-upload, Tickets, Memories/camera upload/reactions, Crush Letters.

Admin: Dashboard, Orders, Payments, Catalog (Stalls/Foods/StallFoods creation), Tickets, Memories window, Crush Letter moderation, Event settings, and statistics routes.

Stall Owner: Dashboard, My Stall, Foods, Sales, Share.

The frontend follows the backend's current contracts: `StallFood` is the purchasable catalog relationship; payment and memory uploads use multipart field `image`; admin review uses `proofVersion`; admin visibility uses `{ hidden: boolean }`.
