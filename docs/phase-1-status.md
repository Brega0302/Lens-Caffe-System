# Phase 1 delivery report — October 23, 2026

This is a historical record of the initial Phase 1 delivery. The later warehouse and two-shift ledger upgrade is documented in [the ledger guide](magacin-knjiga-pazara.md). Test counts and dependency-audit results below describe the checks recorded on the delivery date, not a new audit.

## Delivered functionality

The active LensOS application uses React/TypeScript, Express/TypeScript and PostgreSQL through Prisma. The interface is in Bosnian, amounts use BAM/KM, and business dates follow Sarajevo time. Existing café screens and CSS were reused and improved. Legacy source and local SQLite data were kept separate from the active server; local databases are not included in the public repository.

Owner login uses bcrypt and hashed sessions. The initial delivery included inventory items/categories, search/filter/sort, activation/deactivation, minimum quantities, notes, suppliers, latest purchase dates, movement history, adjustments with a required reason, invoices with historical unit costs, sales-history date filters, atomic stock updates and a dashboard. Stock cannot become negative, and historical selling prices are preserved.

Stock commands use idempotency keys. Repeated and concurrent requests do not deduct stock twice. Audit records store the actor, timestamp and change details. Low-stock alerts are computed dynamically. Demo, development and tests use separate PostgreSQL databases.

## Database

Migration 202610230001_phase_one was applied for this delivery. It created 12 business tables: users, sessions, inventory_categories, suppliers, inventory_items, purchases, purchase_items, sales, sale_items, inventory_movements, audit_logs and commands. Prisma maintains its own migration history. Money uses NUMERIC(16,2), quantities use NUMERIC(16,3), and foreign-key/CHECK constraints protect history, amounts and movement balances.

## Recorded validation

| Check | Result |
| --- | --- |
| Frontend and backend TypeScript | Passed |
| Vite production build | Passed |
| Existing unit/regression tests | 50/50 |
| Initial PostgreSQL integration tests | 19/19 |
| Playwright/Edge: login, item, purchase, sale, history, mobile layout and focus | 1/1 |
| Prisma generation and migration status | Passed; database up to date |
| Frontend and API health | HTTP 200; PostgreSQL connected |
| npm audit --omit=dev | No reported vulnerabilities at the time |

Tests were repeated after compatible dependency patches. Desktop/mobile screenshots were saved locally in .local/screenshots. Integration and browser tests created and removed isolated schemas within the _test database without writing to demo or business records.

## Security notes and limitations at delivery

Compatible patches addressed reported production advisories. The Prisma configuration CLI used a narrow deepmerge-ts=8.0.2 override for a [reported recursive-graph issue](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). The project merges ordinary static configuration; client generation, migrations and integration tests were repeated with that override. Remove it after a verified Prisma CLI upgrade includes the relevant fix.

The full dependency audit at delivery still reported five development/legacy-tool issues: one high-severity brace-expansion issue and four moderate issues in the Vitest dependency chain and old Electron wrapper. Electron is not part of the active web server. Those tools need a separate upgrade. These results do not constitute an independent security certification.

The application ran locally in demo mode. Remote business use requires a separate business database, an HTTPS reverse proxy, restricted database permissions and an operational backup schedule. [Operations documentation](operations.md) describes backup and restore checks; backup automation and a restore exercise were not completed in this phase.

Lists were limited to 1,000 records, and sales to 5,000 records per period with a warning. Financial documents had no edit/reversal interface; an audited reversal workflow remained unimplemented.

Recipes, write-offs, stocktaking, employees, QR integration, expenses, charts, exports and public deployment remained planned work. See the README and later ledger guide for the current workflow and startup commands.
