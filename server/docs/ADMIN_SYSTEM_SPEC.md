# Admin System Specification (Future Work)

This document describes the implemented V1.3 Admin backend and the future Admin UI. No Admin frontend is implemented yet.

## Security and module boundary

Admins use the existing name/password login, JWT authentication, `User.role = "admin"`, `requireAuth`, and `requireAdmin`. There is no separate Admin collection or password system. All admin routes live behind the single `/api/admin` router. New work belongs in `controllers/admin/*` and `routes/admin/*` without repeated changes to application bootstrap.

The Admin developer must reuse shared `pricingService`, `inventoryService`, `orderLifecycleService`, `paymentService`, `ticketService`, and `eventService`. Controllers must never independently reproduce inventory counters, lifecycle transitions, ticket generation, or pricing.

## Planned modules

- Dashboard: implemented backend metrics endpoint
- Stall Management: implemented create/edit/deactivate, details/sales, and owner-account management; no hard-delete route
- Food Management: implemented create/edit/deactivate and atomic ticket-limit validation
- Order Management: implemented inspect/filter only; no arbitrary status endpoint
- Pending Payment Management and Payment Review: call the existing shared review lifecycle
- Ticket Verification and Redemption: implemented whole-order lookup/redemption in shared and Admin namespaces
- Statistics: implemented overview, approved sales per stall/food, and best-selling leaders
- Event Settings: implemented safe singleton reads/updates
- Crush Letter moderation: implemented pending review, rejection, public approval, hide, and restore

Event memories and all customer/admin frontend pages are excluded. Images and proofs retain provider-neutral `{ url, storageKey, provider }` references; no provider is selected.

## Frozen lifecycle and no-refund policy

Order statuses remain `AWAITING_PAYMENT`, `PAYMENT_DECLARED`, `PAYMENT_SUBMITTED`, `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `PAYMENT_EVIDENCE_EXPIRED`, `CANCELLED`, and `EXPIRED`. Inventory remains `RESERVED`, `SOLD`, or `RELEASED`.

Only a `PAYMENT_SUBMITTED + RESERVED` order with a `SUBMITTED` payment can be reviewed. Approval changes order/payment/inventory to `PAYMENT_APPROVED`/`APPROVED`/`SOLD`, creates exactly one ticket, and notifies the user. Rejection requires a reason, changes them to `PAYMENT_REJECTED`/`REJECTED`/`RELEASED`, creates no ticket, and performs no refund. Both actions remain idempotent. Admins must invoke these actions, never directly assign a chosen status.

## Whole-order ticket redemption

One approved order receives one digital ticket even when it contains several foods/stalls. Redeeming `ACTIVE → REDEEMED` means every associated food-ticket quantity was physically issued. V1 has no partial or per-item redemption. A redeemed ticket cannot be redeemed again; lookup should show `ACTIVE`, `REDEEMED`, or `CANCELLED`.

## Dashboard metrics

- Total Orders: every order
- Awaiting Payment: `AWAITING_PAYMENT`
- Payment Declared: `PAYMENT_DECLARED`
- Pending Payment Review: `PAYMENT_SUBMITTED`
- Approved Orders: `PAYMENT_APPROVED`
- Rejected Orders: `PAYMENT_REJECTED`
- Expired Orders: combined `EXPIRED + PAYMENT_EVIDENCE_EXPIRED`
- Cancelled Orders: `CANCELLED`
- Approved Revenue: sum `Order.totalAmount` only for approved orders
- Food Tickets Sold: sum all item quantities only in approved orders
- Digital Tickets Issued: number of Ticket records
- Digital Tickets Redeemed: Ticket records with `status = REDEEMED`
- Physical Tickets Issued: sum associated order quantities for redeemed tickets
- Active Stalls: `isActive = true`
- Available Food Items: available foods belonging to active stalls

Digital ticket count and physical food-ticket quantity are different metrics.

## Statistics definitions

Sales per stall/food use immutable OrderItem snapshots from `PAYMENT_APPROVED` orders only. The Best-Selling Stall is the stall with the greatest approved item quantity. Ties use approved stall revenue first. If quantity and revenue both tie, return all tied leaders. Never use order count, pending reservations, revenue alone, views, or carts.

## Data-management safety

Before real orders exist, demo stalls/foods may be removed when preparing the real catalog. After orders exist, normally set `Stall.isActive = false` or `FoodItem.isAvailable = false`; do not hard-delete referenced records. Hard deletion, if ever offered, is limited to demonstrably unused development records.

Food ticket limits must satisfy `newTicketLimit >= reservedTickets + soldTickets`, enforced server-side. Price/discount changes affect future orders only; existing `unitPrice`, `subtotal`, and `totalAmount` snapshots must never be recalculated.

## Event settings

Keep the singleton `configKey = "current"` and explicit `eventTimezone = "Asia/Yangon"`. Admin may update event name/date, preorder opening/closing timestamps, KBZ information, instructions, reservation/grace durations, `orderingEnabled`, and the approved nested feature flags. Enforce `preorderOpenAt < preorderCloseAt < eventDate`; closing is not required to be exactly 24 hours before the event. New orders require both the scheduled window and the manual `orderingEnabled` switch.

Current independent event-day controls are `featureFlags.memoriesEnabled`, `featureFlags.eventPageEnabled`, and `featureFlags.crushLettersEnabled`, all defaulting to `false`. The Crush Letter flag controls new anonymous submissions; approved listing remains readable when it is off. Partial flag updates preserve other flag values, and unknown flag names are rejected. One more explicit flag may be added later when its requirements are known; arbitrary client-defined flags are not accepted. Payment review/approval/rejection and ticket redemption have no feature switch and remain available under their existing authorization and lifecycle rules.

Crush Letter moderation is Admin-owned. Admin can list/filter letters, inspect details, review pending letters as approved or rejected, and hide/restore approved content. Normal users and Stall Owners have no moderation access. Status-based moderation is the normal workflow; no hard-delete endpoint is provided.

The future Admin interface must confirm consequential switch changes before sending the validated update. Confirmation is a frontend safeguard; the API does not accept or require a `confirmed` field.

Launch dates are confirmed as preorder opening on 8 September 2026, preorder closing on 10 September 2026, and the event on 11 September 2026 in Myanmar Time. Exact opening and closing times remain TBD and must not be guessed or written into development configuration.

Event changes never alter old totals, deadlines, declaration/proof timestamps, payments, tickets, or redemptions. `DEMO Fun Fair 2030` and all demo KBZ/event values must be replaced and verified before production launch.

## Canonical website notifications

Use `PAYMENT_APPROVED`, `PAYMENT_REJECTED`, `ORDER_EXPIRED`, and `PAYMENT_EVIDENCE_EXPIRED`. Website notifications only—no SMS, email, or push integration.

## Production data readiness

Obtain and verify final stalls, foods, prices, discounts, ticket limits, event dates, and KBZ details; enter real data; remove/deactivate demo data; test the real catalog; then enable ordering. No schema change should be required.
