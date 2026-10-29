# Warehouse inventory and daily sales ledger

## Workflow

The application uses Bosnian labels. This guide gives their English meanings so the interface can be followed without mixing documentation languages.

1. In the warehouse screen, add an item with its name, unit, category, minimum stock and prices. Mark whether it is sellable. Leave cleaning products, glassware and other supplies unmarked.
2. Record incoming stock and its purchase cost through a purchase. This increases warehouse stock only.
3. Create a warehouse-to-café transfer with the items and quantities being issued. Confirmation reduces the warehouse, increases café stock and adds replenishment to the current ledger shift. Sellable items are sorted by category and name; non-sellable supplies are excluded from revenue.
4. The daily ledger opens with the stock remaining in the café. At the first-shift handover, physically count every item and enter its remaining quantity, including zeros. Saving a draft preserves the entry; confirming the handover posts the shift's sales.
5. Transfers after the first handover belong to the second shift. At closing, enter the final counts and confirm the daily close. The next ledger starts with that remaining stock.
6. A reorder alert appears in the application header and overview when warehouse stock is at or below its minimum, including zero. Alerts refresh after changes, when returning to the application and every 60 seconds. Notifications are in-app only; email and SMS are not implemented.

## Example

| Step | Warehouse | Café | Calculation |
| --- | ---: | ---: | --- |
| Purchase 10 bottles | 10 | 0 | Purchase only; no sale |
| Transfer 6 bottles | 4 | 6 | First-shift replenishment +6 |
| First handover: 2 remain | 4 | 2 | 4 sold × 2.50 = 10.00 KM |
| Second-shift transfer: 2 bottles | 2 | 4 | Second-shift replenishment +2 |
| Closing count: 1 remains | 2 | 1 | 3 sold × 2.50 = 7.50 KM |
| Total | 2 | 1 | 7 sold; revenue 17.50 KM |

At an estimated purchase cost of 1.20 KM, estimated gross profit for seven bottles is 9.10 KM. Wages, rent, taxes and other expenses are excluded.

Quantities support three decimal places, but the same unit must be used when receiving, transferring and counting stock. Box-to-bottle conversion and recipes are not automated.

## Calculation rules

First shift: opening stock + first-shift replenishment − handover count = first-shift quantity sold.

Second shift: first-shift handover count + second-shift replenishment − closing count = second-shift quantity sold.

Every difference is treated as a sale. Check physical stock, shortages, damage and entry errors before confirmation. This version has no separate café write-off or closed-shift reversal workflow. Warehouse adjustments still require a reason and do not change café stock.

A count cannot exceed the stock assigned to the shift; record any missing transfer first. Every item needs a count. Confirmed shifts are immutable. The earlier manual POST /api/sales endpoint is disabled to prevent double posting, while historical sales remain available.

During an open shift, the café quantity represents stock assigned after the previous handover and subsequent transfers. Actual remaining stock is confirmed by a physical count. The system does not know live sales between counts.

Warehouse purchase-cost estimates are weighted across new purchases. Transfers carry the estimate into the café, where replenishment is weighted with remaining stock. Each shift stores its own cost estimate, and each daily ledger preserves its selling prices. Catalog price changes apply to a new ledger without rewriting an earlier one. Unknown purchase costs produce unknown gross profit rather than an invented value.

## Database and authorization

Migration 202610230002_warehouse_ledger adds separate café quantities, cost estimates, a sellable-item flag, ledger_days, ledger_lines, stock_transfers and transfer_items.

Existing quantities remain in the warehouse; café stock starts at zero. Items with an earlier positive selling price are initially classified as sellable. Existing items with known purchases receive an initial estimate from the latest purchase price; this is not a retroactive FIFO calculation. The owner can review and correct the classification.

PostgreSQL enum values are added in their own committed transaction before the remaining schema changes are applied together. Constraints protect nonnegative stock, balanced transfer movements and a single open ledger.

Transfers and shift closing use serializable transactions with idempotency keys. Ledger version checks reject stale counts if another transfer changed the ledger. Transfers, opening, draft saves and closing produce audit records identifying the responsible user.

Active endpoints:

- GET /api/ledger?date=YYYY-MM-DD
- POST /api/ledger/open
- POST /api/ledger/:id/draft
- POST /api/ledger/:id/close
- GET/POST /api/stock-transfers

Writes require the existing owner/manager permission and an Idempotency-Key. Dedicated waiter access is planned.

## Validation recorded for this upgrade

The upgrade was checked with 20 PostgreSQL tests covering receipt, transfer, replay, concurrency, both shifts, prices, unknown costs, overnight carry-forward, alerts and permissions; 50 regression tests; and a browser flow covering warehouse operations, both shifts and mobile layout.

Apply migrations with npm run db:migrate and start the application with npm run dev:web. The upgrade does not change the existing demo user's password.
