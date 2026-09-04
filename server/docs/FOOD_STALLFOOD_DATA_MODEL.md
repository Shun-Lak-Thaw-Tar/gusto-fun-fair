# Food and StallFood Data Model

## Why it changed

The former `FoodItem` mixed reusable food identity with the way one stall sells that food. V1.4 separates those responsibilities so the same food can appear at several stalls with independent price, discount, availability, and inventory.

```text
Stall 1 ───< StallFood >─── 1 Food
```

`StallFood` is the sellable menu entry. The compound `(stallId, foodId)` unique index prevents duplicate assignment within one stall while allowing reuse across different stalls. Stall does not store a duplicated food-ID array.

## Responsibilities

- `Food`: name, description, category, provider-neutral image, active state.
- `Stall`: stall name, batch, description, provider-neutral image, stable slug, active state.
- `StallFood`: Stall/Food references, event-day price, percentage or fixed preorder discount, ticket limit, reserved/sold counters, and availability.

`preorderPrice` is calculated by the server from `StallFood.eventDayPrice` and `StallFood.discount`. `ticketsRemaining` is derived as `ticketLimit - reservedTickets - soldTickets`. Neither derived value is client-editable. A ticket limit cannot be set below reserved plus sold quantities.

## Orders and inventory

New orders submit only `stallFoodId` and `quantity`. Reservation, release, reserved-to-sold conversion, rollback, cancellation, expiry, rejection, and approval all update the selected StallFood atomically. An OrderItem stores `stallFoodId`, `stallId`, `foodId`, stall/food names, quantity, unit price, and subtotal. These snapshots are never recalculated after catalog edits.

Legacy `foodItemId` input is deprecated and accepted only when an explicit migration mapping exists. Historical orders may retain it alongside backfilled canonical IDs.

## Migration

`npm run migrate:foods` performs a non-destructive, idempotent migration. Each legacy FoodItem becomes one Food—names are not automatically deduplicated—and one StallFood. Price, limits, counters, and availability are copied; the legacy Stall discount is copied into that StallFood to preserve pricing. Existing order snapshots keep their original monetary values while canonical IDs are backfilled where possible. FoodItem remains as an explicitly deprecated migration source.

## Admin workflow

```text
Create Food
    ↓
Create or edit Stall
    ↓
Assign Food to Stall
    ↓
Set that StallFood's price, discount, ticket limit, and availability
```

`/api/admin/foods` manages only generic identity. `/api/admin/stall-foods` manages selling relationships and supports `stallId` and `foodId` filters. No source-code change is needed to enter real stall data.

## Public and Stall Owner usage

Public `/api/foods` and stall-by-slug responses query StallFood and populate active Food and Stall display data. They expose calculated price and remaining inventory, not raw reserved/sold counters. `/api/stall-owner/foods` derives the stall from the authenticated owner, returns only that stall's populated menu entries, and remains read-only. Approved sales reporting continues to use immutable OrderItem snapshots.
