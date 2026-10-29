-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'SALE', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(120) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "categoryId" INTEGER,
    "supplierId" INTEGER,
    "unit" VARCHAR(20) NOT NULL,
    "currentQuantity" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "minimumQuantity" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "lastPurchasedAt" DATE,
    "notes" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER,
    "purchaseDate" DATE NOT NULL,
    "invoiceReference" VARCHAR(120),
    "note" VARCHAR(1000),
    "totalCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" SERIAL NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "productName" VARCHAR(160) NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unitCost" DECIMAL(16,2) NOT NULL,
    "totalCost" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" SERIAL NOT NULL,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdById" INTEGER NOT NULL,
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "productName" VARCHAR(160) NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "sellingPrice" DECIMAL(16,2) NOT NULL,
    "unitCost" DECIMAL(16,2),
    "total" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" SERIAL NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "previousQuantity" DECIMAL(16,3) NOT NULL,
    "newQuantity" DECIMAL(16,3) NOT NULL,
    "unitCost" DECIMAL(16,2),
    "referenceId" INTEGER,
    "note" VARCHAR(1000),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commands" (
    "key" VARCHAR(80) NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "bodyHash" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_name_key" ON "inventory_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "inventory_items_name_idx" ON "inventory_items"("name");

-- CreateIndex
CREATE INDEX "inventory_items_categoryId_active_idx" ON "inventory_items"("categoryId", "active");

-- CreateIndex
CREATE INDEX "purchases_purchaseDate_idx" ON "purchases"("purchaseDate");

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "sales_soldAt_idx" ON "sales"("soldAt");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_inventoryItemId_idx" ON "sale_items"("inventoryItemId");

-- CreateIndex
CREATE INDEX "inventory_movements_inventoryItemId_createdAt_idx" ON "inventory_movements"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_inventoryItemId_type_referenceId_key" ON "inventory_movements"("inventoryItemId", "type", "referenceId");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_createdAt_idx" ON "audit_logs"("entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants are enforced even for writes outside the API.
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_nonnegative" CHECK ("currentQuantity" >= 0 AND "minimumQuantity" >= 0 AND "purchasePrice" >= 0 AND "sellingPrice" >= 0);
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_supported_unit" CHECK ("unit" IN ('piece','bottle','can','kg','g','litre','ml','package','box'));
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_line_positive" CHECK ("quantity" > 0 AND "unitCost" >= 0 AND "totalCost" = round("quantity" * "unitCost", 2));
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_line_positive" CHECK ("quantity" > 0 AND "sellingPrice" >= 0 AND ("unitCost" IS NULL OR "unitCost" >= 0) AND "total" = round("quantity" * "sellingPrice", 2));
ALTER TABLE "purchases" ADD CONSTRAINT "purchase_total_nonnegative" CHECK ("totalCost" >= 0);
ALTER TABLE "sales" ADD CONSTRAINT "sale_total_nonnegative" CHECK ("total" >= 0);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movement_balance" CHECK ("quantity" <> 0 AND "previousQuantity" >= 0 AND "newQuantity" >= 0 AND "previousQuantity" + "quantity" = "newQuantity" AND ("unitCost" IS NULL OR "unitCost" >= 0));
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movement_direction" CHECK (("type" = 'SALE' AND "quantity" < 0) OR ("type" = 'PURCHASE' AND "quantity" > 0) OR "type" = 'MANUAL_ADJUSTMENT');
CREATE INDEX "sales_sarajevo_date" ON "sales" ((("soldAt" AT TIME ZONE 'Europe/Sarajevo')::date));
