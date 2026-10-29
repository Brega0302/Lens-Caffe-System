# LensOS API, migrations and recovery

## API access

Business endpoints require an Authorization: Bearer <session> header. Owner and manager roles have operational permissions. EMPLOYEE has no assigned permissions yet; employee administration is planned. Only the owner can read the audit log.

| Method | Endpoint | Purpose or request fields |
| --- | --- | --- |
| POST | /api/auth/login | username, password; returns token, expiresAt and user |
| POST | /api/auth/logout | Revoke the current session |
| GET | /api/session | Current user and demo-environment indicator |
| GET | /api/inventory | search, categoryId, lowStock, sort, direction |
| GET | /api/inventory/:id | Inventory item |
| POST | /api/inventory | Item details, classification, supplier, minimum quantity and prices |
| PATCH | /api/inventory/:id | Complete item update; currentQuantity is not directly writable |
| PATCH | /api/inventory/:id/status | active: boolean |
| GET | /api/inventory/:id/movements | Movement history with actor and timestamp |
| POST | /api/inventory/:id/adjustments | Signed quantity, required note, type=MANUAL_ADJUSTMENT |
| GET/POST | /api/purchases | purchaseDate, supplier, invoiceReference, note and purchase items |
| GET | /api/purchases/:id | Purchase with historical prices |
| GET | /api/sales | Sales history filtered by from/to |
| GET | /api/sales/:id | Stored sale |
| GET | /api/ledger | Daily ledger; date=YYYY-MM-DD |
| POST | /api/ledger/open | Open the daily ledger |
| POST | /api/ledger/:id/draft | Save stock-count entries |
| POST | /api/ledger/:id/close | Confirm a shift or daily close |
| GET/POST | /api/stock-transfers | List or create warehouse-to-café transfers |
| GET | /api/dashboard/summary | Summary for date=YYYY-MM-DD; defaults to today |
| GET | /api/audit | Latest 200 audit entries; OWNER only |
| GET | /api/health | API and database health |

Manual POST /api/sales is disabled in the current ledger workflow. Sales are posted from shift counts. See the [ledger guide](magacin-knjiga-pazara.md).

Write commands require a unique Idempotency-Key of 16–80 characters; a UUID is recommended. Retry a failed network request with the same body and key. Changing the body or user while reusing a key returns 409. A successful replay returns the original record ID. Use a new key for a genuinely new transaction. Duplicate item IDs within a document are rejected.

Send money as decimal strings, such as "2.50", and quantities as strings such as "1.250". The server calculates with Decimal, and database constraints reject negative prices/stock and unbalanced movements. Documents allow at most 100 items. Date-only values use YYYY-MM-DD; timestamps such as soldAt must include a time zone or offset.

Error status codes: 400 validation, 401 authentication, 403 permission, 404 missing record, 409 stock or concurrency conflict, and 429 request limit.

## Migrations

The initial migration creates 12 related tables: users, sessions, inventory_categories, suppliers, inventory_items, purchases, purchase_items, sales, sale_items, inventory_movements, audit_logs and commands. Prisma also maintains _prisma_migrations. SQL constraints cover foreign keys, units of measure, positive line quantities, amount calculations and movement balances.

The warehouse/ledger migration adds separate café stock and transfer/ledger tables. See the ledger guide for its transaction boundaries and migration behavior.

Run npm run db:generate, then npm run db:migrate. Migration deployment does not delete existing records or automatically seed data. Make and verify a backup before production migrations. Never use migrate reset on a real business database. Schema changes require new migrations; do not edit SQL files that have already been applied.

Legacy SQLite data is not imported automatically. Before an explicit import, separate business, demo and legacy records; map users; verify stock and price totals; import into an empty staging database; and reconcile reports. Never overwrite the original file during an import.

## Backup and restore checks

Use pg_dump from the same PostgreSQL major version as the server, or a newer compatible version. Replace the host, port, roles and database names below with your own:

~~~powershell
pg_dump -h 127.0.0.1 -p 5432 -U lensos_backup -d lensos -W -Fc -f lensos-2026-10-23.dump
createdb -h 127.0.0.1 -p 5432 -U lensos_restore -W lensos_restore_check
pg_restore -h 127.0.0.1 -p 5432 -U lensos_restore -d lensos_restore_check -W --no-owner --no-acl lensos-2026-10-23.dump
~~~

The -W option prompts for a password. Do not put passwords in Git or command-line arguments. For the isolated local development cluster, use port 55432 and the appropriate local database name.

For real business operation, plan automated daily backups, multiple retained versions, an encrypted off-site copy, failure notifications and a monthly restore exercise. Record the acceptable data-loss window and recovery time. Add PostgreSQL WAL/PITR if required. These procedures are documented; this application does not automatically configure a backup schedule.

Restore into a new database first. Check migration status, document counts, daily revenue, line-item totals and stock-movement balances against current quantities. Run the application against the restored database in isolation. Change DATABASE_URL only after verification, and retain the previous database. Do not use --clean against the active business database.
