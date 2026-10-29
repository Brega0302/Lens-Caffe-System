-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


BEGIN;
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'CAFE_SALE';
COMMIT;

BEGIN;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "cafeCost" DECIMAL(18,6),
ADD COLUMN     "cafeQuantity" DECIMAL(16,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sellable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warehouseCost" DECIMAL(18,6);

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "location" VARCHAR(20) NOT NULL DEFAULT 'WAREHOUSE';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "ledgerDayId" INTEGER,
ADD COLUMN     "shift" INTEGER;

-- CreateTable
CREATE TABLE "ledger_days" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "openedBy" INTEGER NOT NULL,
    "firstClosedBy" INTEGER,
    "closedBy" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstClosedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ledger_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_lines" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(120),
    "unit" VARCHAR(20) NOT NULL,
    "opening" DECIMAL(16,3) NOT NULL,
    "receivedFirst" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "receivedSecond" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "countFirst" DECIMAL(16,3),
    "countFinal" DECIMAL(16,3),
    "soldFirst" DECIMAL(16,3),
    "soldSecond" DECIMAL(16,3),
    "costFirst" DECIMAL(18,6),
    "costSecond" DECIMAL(18,6),
    "sellingPrice" DECIMAL(16,2) NOT NULL,
    "revenueFirst" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "revenueSecond" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "costTotalFirst" DECIMAL(16,2),
    "costTotalSecond" DECIMAL(16,2),

    CONSTRAINT "ledger_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER NOT NULL,
    "shift" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "note" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_items" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unitCost" DECIMAL(18,6),

    CONSTRAINT "transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_days_date_key" ON "ledger_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_lines_dayId_inventoryItemId_key" ON "ledger_lines"("dayId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_items_transferId_inventoryItemId_key" ON "transfer_items"("transferId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_ledgerDayId_shift_key" ON "sales"("ledgerDayId", "shift");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_ledgerDayId_fkey" FOREIGN KEY ("ledgerDayId") REFERENCES "ledger_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ledger_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ledger_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing stock remains warehouse stock; café stock starts at zero.
-- Legacy costs start from the last known purchase estimate, not an asserted FIFO valuation.
UPDATE "inventory_items" SET "sellable" = ("sellingPrice" > 0), "warehouseCost" = CASE WHEN "lastPurchasedAt" IS NOT NULL THEN "purchasePrice" ELSE NULL END;
ALTER TABLE "inventory_items" ADD CONSTRAINT "cafe_nonnegative" CHECK ("cafeQuantity" >= 0 AND ("cafeCost" IS NULL OR "cafeCost" >= 0) AND ("warehouseCost" IS NULL OR "warehouseCost" >= 0));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "movement_direction";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movement_direction" CHECK (("type" IN ('SALE','TRANSFER_OUT','CAFE_SALE') AND "quantity" < 0) OR ("type" IN ('PURCHASE','TRANSFER_IN') AND "quantity" > 0) OR "type" = 'MANUAL_ADJUSTMENT');
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movement_location" CHECK (("location" = 'WAREHOUSE' AND "type" IN ('PURCHASE','SALE','MANUAL_ADJUSTMENT','TRANSFER_OUT')) OR ("location" = 'CAFE' AND "type" IN ('TRANSFER_IN','CAFE_SALE')));
CREATE UNIQUE INDEX "ledger_one_open_day" ON "ledger_days" ((1)) WHERE "stage" < 3;
ALTER TABLE "ledger_days" ADD CONSTRAINT "ledger_stage" CHECK ("stage" BETWEEN 1 AND 3 AND "version" >= 0);
ALTER TABLE "ledger_days" ADD CONSTRAINT "ledger_owner_fk" FOREIGN KEY ("openedBy") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_days" ADD CONSTRAINT "ledger_first_actor_fk" FOREIGN KEY ("firstClosedBy") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "ledger_days" ADD CONSTRAINT "ledger_final_actor_fk" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "transfer_actor_fk" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "transfer_shift" CHECK ("shift" IN (1,2));
ALTER TABLE "transfer_items" ADD CONSTRAINT "transfer_positive" CHECK ("quantity" > 0 AND ("unitCost" IS NULL OR "unitCost" >= 0));
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_quantities" CHECK ("opening" >= 0 AND "receivedFirst" >= 0 AND "receivedSecond" >= 0 AND ("countFirst" IS NULL OR "countFirst" >= 0) AND ("countFinal" IS NULL OR "countFinal" >= 0) AND ("soldFirst" IS NULL OR ("soldFirst" >= 0 AND "soldFirst" = "opening" + "receivedFirst" - "countFirst")) AND ("soldSecond" IS NULL OR ("soldSecond" >= 0 AND "soldSecond" = "countFirst" + "receivedSecond" - "countFinal")));
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_prices" CHECK ("sellingPrice" >= 0 AND "revenueFirst" >= 0 AND "revenueSecond" >= 0 AND ("costFirst" IS NULL OR "costFirst" >= 0) AND ("costSecond" IS NULL OR "costSecond" >= 0));
COMMIT;
