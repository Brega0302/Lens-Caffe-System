import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, isDemo } from "./db.js";
import { hash } from "./auth.js";
import {
  D,
  HttpError,
  lineTotal,
  money,
  localTimestamp,
  purchaseSchema,
  saleSchema,
  adjustmentSchema,
  itemSchema,
  today,
} from "./validation.js";

type Tx = Prisma.TransactionClient;
export const itemInclude = { category: true, supplier: true } as const;
type LoadedItem = Prisma.InventoryItemGetPayload<{
  include: typeof itemInclude;
}>;
const snapshot = (data: unknown) =>
  JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
export async function audit(
  tx: Tx,
  userId: number,
  action: string,
  entityId: number,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entityId,
      ...(before == null ? {} : { before: snapshot(before) }),
      after: snapshot(after),
    },
  });
}
export function publicItem(item: LoadedItem) {
  return {
    ...item,
    category: item.category?.name || null,
    supplier: item.supplier?.name || null,
    currentQuantity: item.currentQuantity.toNumber(),
    cafeQuantity: item.cafeQuantity.toNumber(),
    warehouseCost: item.warehouseCost?.toFixed(6) ?? null,
    cafeCost: item.cafeCost?.toFixed(6) ?? null,
    minimumQuantity: item.minimumQuantity.toNumber(),
    purchasePrice: money(item.purchasePrice),
    sellingPrice: money(item.sellingPrice),
    status: item.currentQuantity.eq(0)
      ? "OUT_OF_STOCK"
      : item.currentQuantity.lte(item.minimumQuantity)
        ? "LOW_STOCK"
        : "NORMAL",
    lastPurchasedAt: item.lastPurchasedAt?.toISOString().slice(0, 10) || null,
    demo: isDemo,
  };
}
async function lookup(tx: Tx, table: "category" | "supplier", name?: string) {
  if (!name) return null;
  if (table === "category")
    return (
      await tx.category.upsert({
        where: { name },
        create: { name },
        update: {},
      })
    ).id;
  return (
    await tx.supplier.upsert({ where: { name }, create: { name }, update: {} })
  ).id;
}
export async function saveItem(
  userId: number,
  input: z.infer<typeof itemSchema>,
  id?: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const before = id
        ? await tx.inventoryItem.findUnique({ where: { id } })
        : null;
      if (id && !before) throw new HttpError(404, "Artikal nije pronađen.");
      if (
        before?.cafeQuantity.gt(0) &&
        input.sellable !== undefined &&
        input.sellable !== before.sellable
      )
        throw new HttpError(
          409,
          "Vrstu artikla ne možete mijenjati dok ima zalihe u kafiću.",
        );
      if (
        before?.lastPurchasedAt &&
        !before.purchasePrice.eq(input.purchasePrice)
      )
        throw new HttpError(
          409,
          "Nabavna cijena se mijenja evidentiranjem nove nabavke.",
        );
      if (before && before.unit !== input.unit) {
        const hasHistory = await tx.stockMovement.count({
          where: { inventoryItemId: id },
        });
        if (hasHistory)
          throw new HttpError(
            409,
            "Jedinica mjere se ne može mijenjati nakon prvog kretanja zalihe.",
          );
      }
      const data = {
        ...input,
        sellable:
          input.sellable ?? before?.sellable ?? D(input.sellingPrice).gt(0),
        categoryId: await lookup(tx, "category", input.category),
        supplierId: await lookup(tx, "supplier", input.supplier),
      };
      const { category: _category, supplier: _supplier, ...fields } = data;
      const item = id
        ? await tx.inventoryItem.update({
            where: { id },
            data: fields,
            include: itemInclude,
          })
        : await tx.inventoryItem.create({ data: fields, include: itemInclude });
      await audit(
        tx,
        userId,
        id ? "INVENTORY_UPDATED" : "INVENTORY_CREATED",
        item.id,
        before,
        item,
      );
      const openDay = await tx.ledgerDay.findFirst({
        where: { stage: { lt: 3 } },
      });
      if (openDay && item.sellable && item.active)
        await tx.ledgerLine.upsert({
          where: {
            dayId_inventoryItemId: {
              dayId: openDay.id,
              inventoryItemId: item.id,
            },
          },
          update: {},
          create: {
            dayId: openDay.id,
            inventoryItemId: item.id,
            name: item.name,
            category: item.category?.name,
            unit: item.unit,
            opening: item.cafeQuantity,
            sellingPrice: item.sellingPrice,
            costFirst: item.cafeCost,
            costSecond: item.cafeCost,
            ...(openDay.stage === 2
              ? { countFirst: item.cafeQuantity, soldFirst: D(0) }
              : {}),
          },
        });
      if (openDay)
        await tx.ledgerDay.update({
          where: { id: openDay.id },
          data: { version: { increment: 1 } },
        });
      return publicItem(item);
    },
    { isolationLevel: "Serializable" },
  );
}

export async function command(
  userId: number,
  key: string,
  kind: string,
  body: unknown,
  operation: (tx: Tx) => Promise<Prisma.InputJsonObject>,
) {
  const bodyHash = hash(JSON.stringify(body));
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.command.findUnique({ where: { key } });
          if (existing) {
            if (
              existing.userId !== userId ||
              existing.kind !== kind ||
              existing.bodyHash !== bodyHash
            )
              throw new HttpError(
                409,
                "Ključ zahtjeva je već korišten za drugačiju radnju.",
              );
            return existing.result;
          }
          const result = await operation(tx);
          await tx.command.create({
            data: { key, userId, kind, bodyHash, result },
          });
          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      ) {
        if (attempt < 4) continue;
        throw new HttpError(
          409,
          "Zaliha je upravo izmijenjena. Ponovite zahtjev s istim ključem.",
        );
      }
      throw error;
    }
  }
  throw new HttpError(409, "Zahtjev nije izvršen. Pokušajte ponovo.");
}
async function trackedItem(tx: Tx, id: number) {
  const item = await tx.inventoryItem.findUnique({ where: { id } });
  if (!item || !item.active)
    throw new HttpError(400, "Aktivan artikal nije pronađen.");
  return item;
}
const ensureTotal = (total: Prisma.Decimal) => {
  if (total.gt("99999999999999.99"))
    throw new HttpError(400, "Ukupan iznos je prevelik.");
};
export async function recordPurchase(
  userId: number,
  key: string,
  body: z.infer<typeof purchaseSchema>,
) {
  return command(userId, key, "PURCHASE", body, async (tx) => {
    const supplierId = await lookup(tx, "supplier", body.supplier);
    const purchase = await tx.purchase.create({
      data: {
        supplierId,
        purchaseDate: new Date(body.purchaseDate + "T00:00:00Z"),
        invoiceReference: body.invoiceReference,
        note: body.note,
        createdById: userId,
      },
    });
    let total = D(0);
    for (const line of [...body.items].sort(
      (a, b) => a.inventoryItemId - b.inventoryItemId,
    )) {
      const item = await trackedItem(tx, line.inventoryItemId);
      const next = item.currentQuantity.add(line.quantity);
      const cost = lineTotal(line.quantity, line.unitCost);
      total = total.add(cost);
      ensureTotal(total);
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentQuantity: next,
          warehouseCost: item.currentQuantity.eq(0)
            ? D(line.unitCost)
            : item.warehouseCost
              ? item.currentQuantity
                  .mul(item.warehouseCost)
                  .add(D(line.quantity).mul(line.unitCost))
                  .div(next)
                  .toDecimalPlaces(6)
              : null,
          ...(item.lastPurchasedAt == null ||
          new Date(body.purchaseDate) >= item.lastPurchasedAt
            ? {
                purchasePrice: D(line.unitCost),
                lastPurchasedAt: new Date(body.purchaseDate),
                ...(supplierId ? { supplierId } : {}),
              }
            : {}),
        },
      });
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          inventoryItemId: item.id,
          productName: item.name,
          quantity: D(line.quantity),
          unitCost: D(line.unitCost),
          totalCost: cost,
        },
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "PURCHASE",
          quantity: D(line.quantity),
          previousQuantity: item.currentQuantity,
          newQuantity: next,
          unitCost: D(line.unitCost),
          referenceId: purchase.id,
          note: body.note,
          createdById: userId,
        },
      });
    }
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { totalCost: total },
    });
    await audit(tx, userId, "PURCHASE_CREATED", purchase.id, null, {
      ...body,
      totalCost: money(total),
    });
    return { id: purchase.id };
  });
}
export async function recordSale(
  userId: number,
  key: string,
  body: z.infer<typeof saleSchema>,
) {
  if (body.saleDate && body.soldAt)
    throw new HttpError(400, "Unesite datum ili tačno vrijeme, ne oba.");
  if (body.saleDate && body.saleDate > today())
    throw new HttpError(400, "Prodaja ne može biti u budućnosti.");
  if (body.soldAt && new Date(body.soldAt).getTime() > Date.now() + 60000)
    throw new HttpError(400, "Prodaja ne može biti u budućnosti.");
  return command(userId, key, "SALE", body, async (tx) => {
    let soldAt = body.soldAt ? new Date(body.soldAt) : new Date();
    if (body.saleDate && body.saleDate !== today()) {
      const [row] = await tx.$queryRaw<
        { instant: Date }[]
      >`SELECT (${body.saleDate}::date + time '12:00') AT TIME ZONE 'Europe/Sarajevo' AS instant`;
      soldAt = row.instant;
    }
    const sale = await tx.sale.create({
      data: { soldAt, note: body.note, createdById: userId },
    });
    let total = D(0);
    for (const line of [...body.items].sort(
      (a, b) => a.inventoryItemId - b.inventoryItemId,
    )) {
      const item = await trackedItem(tx, line.inventoryItemId);
      const count = D(line.quantity);
      // Conditional UPDATE and serializable isolation protect concurrent sales.
      const update = await tx.inventoryItem.updateMany({
        where: { id: item.id, active: true, currentQuantity: { gte: count } },
        data: { currentQuantity: { decrement: count } },
      });
      if (!update.count)
        throw new HttpError(
          409,
          `Nedovoljno zalihe za ${item.name}. Dostupno: ${item.currentQuantity} ${item.unit}.`,
        );
      const unitPrice =
        line.sellingPrice === undefined
          ? item.sellingPrice
          : D(line.sellingPrice);
      const lineRevenue = lineTotal(line.quantity, unitPrice.toString());
      total = total.add(lineRevenue);
      ensureTotal(total);
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          inventoryItemId: item.id,
          productName: item.name,
          quantity: count,
          sellingPrice: unitPrice,
          unitCost: item.lastPurchasedAt ? item.purchasePrice : null,
          total: lineRevenue,
        },
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "SALE",
          quantity: count.neg(),
          previousQuantity: item.currentQuantity,
          newQuantity: item.currentQuantity.sub(count),
          unitCost: item.lastPurchasedAt ? item.purchasePrice : null,
          referenceId: sale.id,
          note: body.note,
          createdById: userId,
        },
      });
    }
    await tx.sale.update({ where: { id: sale.id }, data: { total } });
    await audit(tx, userId, "SALE_CREATED", sale.id, null, {
      ...body,
      total: money(total),
    });
    return { id: sale.id };
  });
}
export async function adjustStock(
  userId: number,
  key: string,
  id: number,
  body: z.infer<typeof adjustmentSchema>,
) {
  return command(userId, key, `ADJUST:${id}`, body, async (tx) => {
    const item = await trackedItem(tx, id);
    const next = item.currentQuantity.add(body.quantity);
    if (next.lt(0))
      throw new HttpError(
        409,
        `Nedovoljno zalihe. Dostupno: ${item.currentQuantity}.`,
      );
    await tx.inventoryItem.update({
      where: { id },
      data: {
        currentQuantity: next,
        ...(D(body.quantity).gt(0) ? { warehouseCost: null } : {}),
      },
    });
    const movement = await tx.stockMovement.create({
      data: {
        inventoryItemId: id,
        type: "MANUAL_ADJUSTMENT",
        quantity: D(body.quantity),
        previousQuantity: item.currentQuantity,
        newQuantity: next,
        note: body.note,
        createdById: userId,
      },
    });
    await audit(
      tx,
      userId,
      "STOCK_ADJUSTED",
      id,
      { quantity: item.currentQuantity },
      { quantity: next, reason: body.note, movementId: movement.id },
    );
    return { currentQuantity: next.toString() };
  });
}

export const saleInclude = {
  items: true,
  createdBy: { select: { username: true } },
} as const;
export function publicSale(
  sale: Prisma.SaleGetPayload<{ include: typeof saleInclude }>,
) {
  return {
    id: sale.id,
    soldAt: localTimestamp(sale.soldAt),
    soldAtUtc: sale.soldAt.toISOString(),
    total: money(sale.total),
    createdBy: sale.createdBy.username,
    note: sale.note,
    demo: isDemo,
    items: sale.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      productName: item.productName,
      quantity: item.quantity.toNumber(),
      sellingPrice: money(item.sellingPrice),
      total: money(item.total),
    })),
  };
}
export const purchaseInclude = {
  items: { include: { inventoryItem: true } },
  supplier: true,
  createdBy: { select: { username: true } },
} as const;
export function publicPurchase(
  purchase: Prisma.PurchaseGetPayload<{ include: typeof purchaseInclude }>,
) {
  return {
    id: purchase.id,
    purchase_date: purchase.purchaseDate.toISOString().slice(0, 10),
    supplier_name: purchase.supplier?.name,
    created_by_name: purchase.createdBy.username,
    invoiceReference: purchase.invoiceReference,
    note: purchase.note,
    totalCost: money(purchase.totalCost),
    is_demo: isDemo,
    items: purchase.items.map((item) => ({
      id: item.inventoryItemId,
      name: item.productName,
      unit: item.inventoryItem.unit,
      quantity: item.quantity.toNumber(),
      unitCost: money(item.unitCost),
      totalCost: money(item.totalCost),
    })),
  };
}
export async function salesInRange(from: string, to: string) {
  const ids = await prisma.$queryRaw<
    { id: number }[]
  >`SELECT id FROM sales WHERE ("soldAt" AT TIME ZONE 'Europe/Sarajevo')::date BETWEEN ${from}::date AND ${to}::date ORDER BY "soldAt" DESC, id DESC LIMIT 5000`;
  return prisma.sale.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: saleInclude,
    orderBy: [{ soldAt: "desc" }, { id: "desc" }],
  });
}
