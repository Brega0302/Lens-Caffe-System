# LensOS — Caffe Lens

> **Work in progress — actively developing and improving.** This is an ongoing personal project for Caffe Lens. Features, design and workflows are still being refined; it is not a finished production release.

## Overview

LensOS is a full-stack café management application based on day-to-day hospitality workflows. It connects warehouse inventory, goods transferred to the café, purchasing and a daily sales ledger with two shifts.

The application interface is in Bosnian for local staff. Repository documentation is in English. Amounts use BAM/KM, and business dates follow Europe/Sarajevo.

## Implemented features

- Owner authentication with bcrypt password hashing and hashed sessions.
- Inventory items, categories, suppliers, purchase records and low-stock alerts.
- Separate warehouse and café stock, connected by transactional transfers.
- Opening counts, first-shift handover, second-shift replenishment and closing counts.
- Automatic calculation of quantities sold, shift revenue and daily revenue from stock counts.
- Historical selling prices, estimated purchase costs and estimated gross profit.
- Audit records, idempotent commands and protection against negative stock.
- A responsive interface with separate demo, development and test databases.

See the [warehouse and ledger guide](docs/magacin-knjiga-pazara.md) for the current workflow. The separate QR menu project has not yet been integrated.

## Technology and structure

- React 19, TypeScript, Vite, React Router, Tailwind CSS and custom CSS.
- Node.js 22.17+, Express 5, Zod, bcrypt and hashed bearer sessions.
- PostgreSQL and Prisma 6.19.3. Money uses NUMERIC(16,2); quantities use NUMERIC(16,3).
- src/lensos: active frontend screens and types; src/api: API client.
- server/lensos: active API, authorization, validation and transactional services.
- prisma/schema.prisma: relational model; prisma/migrations: versioned migrations and database constraints.
- scripts: isolated local PostgreSQL setup and browser-test helpers.
- docs: architecture, API, operations and workflow documentation.

Earlier QuattroDrive modules and game Socket.IO code are retained as legacy source. The active web server does not load them. Local SQLite databases are excluded from the repository and are not automatically imported into PostgreSQL. The legacy server can be started manually with npm run legacy:server; it uses the same port and must not run alongside the LensOS API.

## Run locally on Windows

Install Node.js 22.17+ and PostgreSQL. The local setup script expects PostgreSQL under C:\Program Files\PostgreSQL.

~~~powershell
git clone https://github.com/Brega0302/Lens-Caffe-System.git
cd Lens-Caffe-System
npm ci
npm run db:local
npm run db:generate
npm run db:migrate
npm run seed:demo
npm run dev:web
~~~

Open http://127.0.0.1:5173. The API listens on 127.0.0.1:3001, and Vite proxies /api requests. Startup reports an occupied port instead of silently choosing another one.

The db:local script creates an isolated cluster in the ignored .local/postgres directory on local port 55432. It does not change existing PostgreSQL installations or databases. Generated credentials are stored in .local/postgres-password and .env without printing them. An existing .env is never overwritten. The cluster is not installed as a Windows service; run npm run db:local again after restarting the computer.

The demo seed prints the generated password for lens-demo-owner only when first creating the account. Save that password. Re-running the seed does not change existing passwords or records. To choose your own initial password, set LENSOS_OWNER_PASSWORD locally before the first seed; it must have at least 12 characters. No default owner password is embedded in the source.

## Demo, development and test environments

The local workflow separates lensos_demo, lensos_dev and lensos_test. The generated local .env selects demo mode, and the interface displays a yellow DEMO indicator. Entries made in that environment remain in the demo database.

To start an empty database for your own records, set DATABASE_URL to your own database, such as lensos_dev, and APP_MODE=production, then run:

~~~powershell
npm run db:migrate
npm run db:owner
npm run dev:web
~~~

The owner-provisioning command creates the first owner and prints the generated password once. Demo seeding is rejected unless the database name ends in _demo, and is also rejected when NODE_ENV=production. Tests require a database name ending in _test and create isolated schemas that are removed afterward.

For an external PostgreSQL server, copy .env.example to .env and supply your connection string. URL-encode special characters in the password. Credentials, local clusters, database files and dumps are excluded from Git.

## Environment variables

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Database used by the active application |
| TEST_DATABASE_URL | Dedicated database whose name ends in _test |
| APP_MODE | demo for the demo database; production for non-demo records |
| PORT | API port; defaults to 3001 |
| LENSOS_CORS_ORIGINS | Comma-separated allowed frontend origins |
| LENSOS_OWNER_USERNAME | Username used for initial owner provisioning |
| LENSOS_OWNER_PASSWORD | Optional local initial password; otherwise generated |
| PLAYWRIGHT_CHANNEL | Browser used for E2E tests; defaults to installed msedge |

Business dates follow Europe/Sarajevo regardless of the computer's time zone. Backdated sales use noon Sarajevo time while preserving their actual creation timestamp for the audit trail.

## Inventory and ledger rules

New items start with zero stock. Purchases increase warehouse stock; manual adjustments require a reason. Purchase records retain their original unit costs and invoice references. An older invoice does not overwrite a newer catalog purchase price.

Transfers reduce warehouse stock and increase café stock together. Sellable items appear in the ledger; cleaning supplies, glassware and other non-sellable materials do not contribute to sales revenue.

- First shift: opening stock + first-shift transfers − handover count = quantity sold.
- Second shift: handover count + second-shift transfers − closing count = quantity sold.
- Closing stock carries forward into the next daily ledger.

Every difference is treated as a sale. Check shortages, damage and entry mistakes before confirming a shift. This version does not have a separate café write-off workflow or reversal of a closed shift. Between physical counts, café quantities represent assigned stock rather than live remaining stock.

Transfers and shift closing use serializable transactions, idempotency keys and ledger version checks. Stock movements, document lines, audit records and command results commit together or roll back together. Replaying the same request does not post it twice.

Historical records are preserved. Items can be deactivated; a unit of measure with recorded history cannot be changed. Low-stock and out-of-stock indicators are computed from current inventory.

Purchase-cost estimates use weighted averages. Transfers carry the estimated cost into the café, and each shift keeps its own cost snapshot. Daily ledgers retain their selling prices. Unknown costs remain unknown rather than producing an invented profit figure. Estimated gross profit excludes wages, rent, taxes and other operating expenses.

## Validation

~~~powershell
npm run typecheck
npm run test:unit
npm run test:postgres
npm run test:e2e
npm run build
~~~

The unit/regression suite includes retained legacy modules. PostgreSQL integration tests cover transfers, both shifts, rollback, concurrent commands, idempotency, historical prices, permissions, rounding and business dates. They create and remove isolated schemas in the _test database.

Playwright uses installed Edge, separate ports 3301/5175 and its own test schema. It generates temporary credentials and removes the schema afterward. For Chromium in CI, run npx playwright install chromium and set PLAYWRIGHT_CHANNEL=chromium.

The browser flow covers login, inventory, purchasing, warehouse transfers, both shifts and mobile layout. Local screenshots are stored in .local/screenshots, and reports in playwright-report.

## Run a production build

~~~powershell
npm run build
$env:NODE_ENV='production'
npm start
~~~

The server serves dist and the API from the same origin. Production requires a non-demo database and APP_MODE=production; demo databases are rejected. The Node server binds to 127.0.0.1. Remote deployment requires an HTTPS reverse proxy, a restricted application database role, a separate migration role and an operational backup plan. The local cluster and role created by db:local are intended for development.

## In progress and limitations

Planned work includes dedicated waiter permissions, café write-offs, stocktaking, recipes, employee administration, schedules, expenses, reporting/exports and deployment hardening. QR ordering and online payments are not implemented in this system.

Closed financial documents cannot be edited or reversed through the current interface. A future reversal workflow must preserve the audit trail. Alerts do not have an inbox or read/unread state.

Inventory, purchase and history lists are limited to 1,000 records; sales are limited to 5,000 records per period, with a prompt to narrow the range. Larger datasets need pagination and server-side report aggregation.

Sessions use browser sessionStorage. Remote deployment requires HTTPS and protection against script injection. Login rate limits are per process; multiple instances require a shared store. Load testing, an independent security review and public application deployment have not been completed.

## Further documentation

- [Architecture and data model](docs/phase-1-architecture.md)
- [Warehouse and two-shift ledger](docs/magacin-knjiga-pazara.md)
- [API, migrations, backup and recovery](docs/operations.md)
- [Historical Phase 1 validation report](docs/phase-1-status.md)
