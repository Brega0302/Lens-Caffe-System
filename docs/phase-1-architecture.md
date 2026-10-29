# LensOS: Phase 1 decisions

## Repository findings

The repository has React/Vite, Express, session authentication, inventory, purchases, sales and dashboard screens. Its old SQLite implementation shares a database with driving-school records and includes unused game Socket.IO code. Existing café screens and CSS are reusable; the SQLite controllers are synchronous and unsuitable for reuse with PostgreSQL. Legacy source and databases remain available, but the active café API is isolated in `server/lensos` and imports none of the legacy modules.

## Implementation plan

1. Define a PostgreSQL schema, reviewed migration and isolated local databases.
2. Add a typed Express API, Prisma repositories, validated inputs and hashed sessions.
3. Reuse the café screens, translate the interface to Bosnian and connect the persisted API.
4. Implement atomic, repeatable purchase, sale and stock adjustment commands with audit records.
5. Verify PostgreSQL integration, concurrent sales, rollback, price history, permissions and production builds.

## Architecture and data model

React/TypeScript and React Router retain the existing UI. Express handles REST, Zod validates boundaries, services enforce inventory rules, and Prisma handles PostgreSQL. Prisma 6 is pinned for compatibility with the existing Node 22 runtime. Money uses PostgreSQL NUMERIC(16,2), quantities NUMERIC(16,3), and Prisma Decimal for all calculations; monetary values cross the API as strings.

User has Sessions, Sales, Purchases, StockMovements, Commands and AuditLogs. InventoryItem belongs to Category and optionally Supplier. Purchase has PurchaseItems; Sale has SaleItems. Both item tables reference InventoryItem and snapshot historical prices and product names. StockMovement preserves quantity before/after, reason, actor, time and document reference. Foreign keys restrict removal of business history. No business-record deletion endpoints exist.

## Transaction rules

Purchase, sale and manual adjustment each use a serializable PostgreSQL transaction, with bounded retries for serialization conflicts. Items are processed in ID order. An atomic conditional update prevents a negative stock balance. Document, line items, quantity update, movement, audit and idempotency result either commit together or roll back together. Duplicate product IDs are rejected within one document. Every write command supplies an idempotency key; replaying the same user/body returns the original result, while changing the body for an existing key returns conflict. DB constraints also require nonnegative prices/stock and movement balance equality.

Low-stock indicators are computed from current active inventory. No persistent notification/read workflow is introduced in Phase 1. Revenue is never labelled profit. Recipes, expenses, QR integration, employees and charts are later phases. The QR repository has not been integrated; inspect it before Phase 4.

## Environments and migration safety

The old SQLite file is not automatically imported: it contains mixed legacy/demo records. PostgreSQL `lensos_demo`, `lensos_test`, and `lensos_dev` are separate databases. Demo seed requires APP_MODE=demo and a database name ending in `_demo`; tests require `_test`. Production never calls demo seed. Explicit reviewed data migration is needed to import any real SQLite records. Local development setup generates credentials into ignored `.env` and `.local`; no existing PostgreSQL installation settings are altered.

## Security

Passwords are bcrypt hashes; 256-bit bearer sessions are stored in the database only as SHA-256 hashes and expire after 12 hours. Tokens are held in browser session storage; TLS and protection from script injection are required for remote deployment. Login is rate limited. Centralized permissions protect routes. Helmet, strict request size limits, same-origin API calls, validation and generic server errors are enforced. Metadata changes and stock commands produce audit records. Owner provisioning is a CLI operation, with no public registration or default password.

## Reference

Transaction isolation and serialization retry follow [Prisma's PostgreSQL transaction documentation](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions).
