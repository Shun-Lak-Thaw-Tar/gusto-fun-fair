# Parallel Development Ownership

Both developers work from `develop`. `main` remains the stable/release branch and must not be used for normal development. Before starting:

```bash
git checkout develop
git pull origin develop
```

## Developer A — Customer/User System

Primary ownership covers customer authentication, browsing stalls/foods, cart and checkout integration, order creation/history, payment declaration and proof submission, permitted cancellation, customer ticket retrieval and notifications, customer routes/controllers, and customer-facing React pages.

## Developer B — Admin System

Primary ownership covers the Admin Dashboard; stall, food, order, pending-payment, and event management; payment approval/rejection; ticket lookup, verification, and whole-order redemption; statistics and best-selling stall; `controllers/admin/*`, `routes/admin/*`, admin-specific services where genuinely needed, admin tests, and admin-facing React pages.

## Shared — coordinate before editing

The following are shared contracts and must not be casually renamed or restructured:

- Models: `User`, `Stall`, `FoodItem`, `Order`, `Payment`, `Ticket`, `Redemption`, `Notification`, `EventConfig`
- Services: `pricingService`, `inventoryService`, `orderLifecycleService`, `paymentService`, `ticketService`, `eventService`
- Authentication/admin middleware, lifecycle enums, ticket statuses, EventConfig rules, and API contracts

Controllers must call shared services instead of duplicating price, inventory, approval, rejection, ticket, or expiry logic. Coordinate before editing shared files and avoid editing the same shared files simultaneously.

Admin work should stay primarily in `controllers/admin/*`, `routes/admin/*`, admin tests, and admin frontend. Customer work should stay primarily in customer-facing controllers/routes and customer frontend.

Before pushing:

```bash
git status
git add .
git commit -m "..."
git pull origin develop
npm test
git push origin develop
```

Resolve pull conflicts before pushing. Never force-push shared `develop`.
