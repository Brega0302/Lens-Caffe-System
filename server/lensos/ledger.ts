import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { permit } from "./auth.js";
import { audit, command, itemInclude } from "./services.js";
import {
  amount,
  commandKey,
  date,
  decimal,
  D,
  HttpError,
  id,
  lineTotal,
  money,
  today,
} from "./validation.js";

type Tx = Prisma.TransactionClient;
const dayInclude = {
  lines: { orderBy: [{ category: "asc" }, { name: "asc" }, { id: "asc" }] },
} satisfies Prisma.LedgerDayInclude;
const transferSchema = z
  .object({
    note: z.string().trim().max(1000).optional(),
    items: z
      .array(z.object({ inventoryItemId: id, quantity: amount }).strict())
      .min(1)
      .max(200)
      .refine(
        (items) =>
          new Set(items.map((x) => x.inventoryItemId)).size === items.length,
        "Artikal navedite samo jednom.",
      ),
  })
  .strict();
const countSchema = z
  .object({
    version: z.number().int().min(0),
    stage: z.union([z.literal(1), z.literal(2)]),
    counts: z
      .array(z.object({ inventoryItemId: id, quantity: decimal(3) }).strict())
      .max(2000)
      .refine(
        (items) =>
          new Set(items.map((x) => x.inventoryItemId)).size === items.length,
        "Artikal navedite samo jednom.",
      ),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

async function openInTransaction(tx: Tx, userId: number, dayDate: string) {
  if (dayDate > today())
    throw new HttpError(400, "Knjiga se ne otvara za budući datum.");
  const existing = await tx.ledgerDay.findUnique({
    where: { date: new Date(dayDate) },
  });
  if (existing) return existing;
  const last = await tx.ledgerDay.findFirst({ orderBy: { date: "desc" } });
  if (
    last &&
    (last.stage !== 3 || last.date.toISOString().slice(0, 10) >= dayDate)
  )
    throw new HttpError(
      409,
      "Prvo zaključite prethodnu knjigu. Novi datum mora biti nakon posljednje knjige.",
    );
  const day = await tx.ledgerDay.create({
    data: { date: new Date(dayDate), openedBy: userId },
  });
  const items = await tx.inventoryItem.findMany({
    where: { active: true, sellable: true },
    include: itemInclude,
  });
  await tx.ledgerLine.createMany({
    data: items.map((item) => ({
      dayId: day.id,
      inventoryItemId: item.id,
      name: item.name,
      category: item.category?.name,
      unit: item.unit,
      opening: item.cafeQuantity,
      sellingPrice: item.sellingPrice,
      costFirst: item.cafeCost,
      costSecond: item.cafeCost,
    })),
  });
  await audit(tx, userId, "LEDGER_OPENED", day.id, null, { date: dayDate });
  return day;
}
export async function openLedger(userId: number, key: string, dayDate: string) {
  return command(userId, key, "LEDGER_OPEN", { date: dayDate }, async (tx) => ({
    id: (await openInTransaction(tx, userId, dayDate)).id,
  }));
}
export async function transferStock(
  userId: number,
  key: string,
  input: z.infer<typeof transferSchema>,
) {
  return command(userId, key, "STOCK_TRANSFER", input, async (tx) => {
    let day = await tx.ledgerDay.findFirst({ where: { stage: { lt: 3 } } });
    if (!day) day = await openInTransaction(tx, userId, today());
    if (day.stage === 3)
      throw new HttpError(
        409,
        "Današnja knjiga je zaključena. Izdavanje će biti dostupno uz novu knjigu sljedećeg dana.",
      );
    if (day.date.toISOString().slice(0, 10) !== today())
      throw new HttpError(
        409,
        "Zaključite staru knjigu i otvorite današnji dan prije izdavanja robe.",
      );
    const transfer = await tx.stockTransfer.create({
      data: {
        dayId: day.id,
        shift: day.stage,
        createdBy: userId,
        note: input.note,
      },
    });
    for (const entry of [...input.items].sort(
      (a, b) => a.inventoryItemId - b.inventoryItemId,
    )) {
      const item = await tx.inventoryItem.findUnique({
        where: { id: entry.inventoryItemId },
        include: itemInclude,
      });
      if (!item?.active)
        throw new HttpError(400, "Aktivan artikal nije pronađen.");
      const quantity = D(entry.quantity),
        warehouse = item.currentQuantity.sub(quantity),
        cafe = item.cafeQuantity.add(quantity);
      if (warehouse.lt(0))
        throw new HttpError(
          409,
          `Nema dovoljno artikla ${item.name} u magacinu. Dostupno: ${item.currentQuantity}.`,
        );
      const cost = item.warehouseCost;
      const cafeCost = item.cafeQuantity.eq(0)
        ? cost
        : item.cafeCost && cost
          ? item.cafeQuantity
              .mul(item.cafeCost)
              .add(quantity.mul(cost))
              .div(cafe)
              .toDecimalPlaces(6)
          : null;
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentQuantity: warehouse, cafeQuantity: cafe, cafeCost },
      });
      await tx.transferItem.create({
        data: {
          transferId: transfer.id,
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          quantity,
          unitCost: cost,
        },
      });
      await tx.stockMovement.createMany({
        data: [
          {
            inventoryItemId: item.id,
            type: "TRANSFER_OUT",
            location: "WAREHOUSE",
            quantity: quantity.neg(),
            previousQuantity: item.currentQuantity,
            newQuantity: warehouse,
            unitCost: cost,
            referenceId: transfer.id,
            note: input.note,
            createdById: userId,
          },
          {
            inventoryItemId: item.id,
            type: "TRANSFER_IN",
            location: "CAFE",
            quantity,
            previousQuantity: item.cafeQuantity,
            newQuantity: cafe,
            unitCost: cost,
            referenceId: transfer.id,
            note: input.note,
            createdById: userId,
          },
        ],
      });
      if (item.sellable) {
        const line = await tx.ledgerLine.upsert({
          where: {
            dayId_inventoryItemId: { dayId: day.id, inventoryItemId: item.id },
          },
          update: {},
          create: {
            dayId: day.id,
            inventoryItemId: item.id,
            name: item.name,
            category: item.category?.name,
            unit: item.unit,
            opening: item.cafeQuantity,
            sellingPrice: item.sellingPrice,
            ...(day.stage === 2
              ? { countFirst: item.cafeQuantity, soldFirst: D(0) }
              : {}),
            costFirst: item.cafeCost,
            costSecond: item.cafeCost,
          },
        });
        await tx.ledgerLine.update({
          where: { id: line.id },
          data:
            day.stage === 1
              ? {
                  receivedFirst: { increment: quantity },
                  costFirst: cafeCost,
                  costSecond: cafeCost,
                }
              : {
                  receivedSecond: { increment: quantity },
                  costSecond: cafeCost,
                },
        });
      }
    }
    await tx.ledgerDay.update({
      where: { id: day.id },
      data: { version: { increment: 1 } },
    });
    await audit(tx, userId, "STOCK_TRANSFERRED", transfer.id, null, {
      ...input,
      dayId: day.id,
      shift: day.stage,
    });
    return { id: transfer.id, dayId: day.id };
  });
}
export async function countLedger(
  userId: number,
  key: string,
  dayId: number,
  input: z.infer<typeof countSchema>,
  close: boolean,
) {
  return command(
    userId,
    key,
    `${close ? "CLOSE" : "DRAFT"}:${dayId}`,
    input,
    async (tx) => {
      const day = await tx.ledgerDay.findUnique({
        where: { id: dayId },
        include: dayInclude,
      });
      if (!day) throw new HttpError(404, "Knjiga nije pronađena.");
      if (day.stage !== input.stage || day.version !== input.version)
        throw new HttpError(
          409,
          "Knjiga je izmijenjena. Osvježite je i provjerite dopune prije potvrde.",
        );
      const counts = new Map(
        input.counts.map((x) => [x.inventoryItemId, D(x.quantity)]),
      );
      if (
        input.counts.some(
          (x) =>
            !day.lines.some(
              (line) => line.inventoryItemId === x.inventoryItemId,
            ),
        )
      )
        throw new HttpError(400, "Artikal ne pripada ovoj knjizi.");
      if (close && counts.size !== day.lines.length)
        throw new HttpError(
          400,
          "Unesite prebrojano stanje za svaki artikal, uključujući nule.",
        );
      let revenue = D(0),
        saleId: number | null = null;
      const soldLines: {
        line: (typeof day.lines)[number];
        sold: Prisma.Decimal;
        count: Prisma.Decimal;
        revenue: Prisma.Decimal;
        cost: Prisma.Decimal | null;
        costTotal: Prisma.Decimal | null;
      }[] = [];
      for (const line of day.lines) {
        const count = counts.get(line.inventoryItemId);
        if (!count) continue;
        const available =
          input.stage === 1
            ? line.opening.add(line.receivedFirst)
            : line.countFirst!.add(line.receivedSecond);
        if (count.gt(available))
          throw new HttpError(
            400,
            `${line.name}: prebrojano stanje ${count} je veće od zaduženja ${available}. Provjerite izdavanje robe.`,
          );
        const sold = available.sub(count),
          lineRevenue = lineTotal(
            sold.toString(),
            line.sellingPrice.toString(),
          );
        const cost = input.stage === 1 ? line.costFirst : line.costSecond;
        const costTotal = sold.eq(0)
          ? D(0)
          : cost
            ? sold.mul(cost).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
            : null;
        if (close) {
          const updated = await tx.inventoryItem.updateMany({
            where: { id: line.inventoryItemId, cafeQuantity: available },
            data: { cafeQuantity: count },
          });
          if (updated.count !== 1)
            throw new HttpError(
              409,
              `Stanje artikla ${line.name} je promijenjeno izvan knjige. Osvježite prikaz.`,
            );
          soldLines.push({
            line,
            sold,
            count,
            revenue: lineRevenue,
            cost,
            costTotal,
          });
          revenue = revenue.add(lineRevenue);
        }
        await tx.ledgerLine.update({
          where: { id: line.id },
          data:
            input.stage === 1
              ? {
                  countFirst: count,
                  ...(close
                    ? {
                        soldFirst: sold,
                        revenueFirst: lineRevenue,
                        costTotalFirst: costTotal,
                      }
                    : {}),
                }
              : {
                  countFinal: count,
                  ...(close
                    ? {
                        soldSecond: sold,
                        revenueSecond: lineRevenue,
                        costTotalSecond: costTotal,
                      }
                    : {}),
                },
        });
      }
      if (close && soldLines.some((x) => x.sold.gt(0))) {
        const [at] = await tx.$queryRaw<
          { instant: Date }[]
        >`SELECT (${day.date.toISOString().slice(0, 10)}::date + time '12:00') AT TIME ZONE 'Europe/Sarajevo' AS instant`;
        const sale = await tx.sale.create({
          data: {
            ledgerDayId: day.id,
            shift: input.stage,
            soldAt: at.instant,
            total: revenue,
            createdById: userId,
            note: input.note || `Knjiga pazara · ${input.stage}. smjena`,
          },
        });
        saleId = sale.id;
        for (const entry of soldLines.filter((x) => x.sold.gt(0))) {
          const { line, sold, count } = entry;
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              inventoryItemId: line.inventoryItemId,
              productName: line.name,
              quantity: sold,
              sellingPrice: line.sellingPrice,
              unitCost: entry.cost?.toDecimalPlaces(2),
              total: entry.revenue,
            },
          });
          await tx.stockMovement.create({
            data: {
              inventoryItemId: line.inventoryItemId,
              type: "CAFE_SALE",
              location: "CAFE",
              quantity: sold.neg(),
              previousQuantity: count.add(sold),
              newQuantity: count,
              unitCost: entry.cost?.toDecimalPlaces(2),
              referenceId: sale.id,
              note: input.note || `Obračun ${input.stage}. smjene`,
              createdById: userId,
            },
          });
        }
      }
      await tx.ledgerDay.update({
        where: { id: day.id },
        data: {
          version: { increment: 1 },
          ...(close
            ? {
                stage: input.stage + 1,
                ...(input.stage === 1
                  ? { firstClosedBy: userId, firstClosedAt: new Date() }
                  : { closedBy: userId, closedAt: new Date() }),
              }
            : {}),
        },
      });
      await audit(
        tx,
        userId,
        close ? "LEDGER_SHIFT_CLOSED" : "LEDGER_DRAFT_SAVED",
        day.id,
        { stage: day.stage, version: day.version },
        { ...input, saleId, revenue: money(revenue) },
      );
      return { id: day.id, saleId, revenue: money(revenue) };
    },
  );
}
export async function getLedger(dayDate: string) {
  const day = await prisma.ledgerDay.findUnique({
    where: { date: new Date(dayDate) },
    include: dayInclude,
  });
  if (!day) return null;
  let first = D(0),
    second = D(0),
    cost = D(0),
    known = true;
  const lines = day.lines.map((line) => {
    first = first.add(line.revenueFirst);
    second = second.add(line.revenueSecond);
    const sold = (line.soldFirst || D(0)).add(line.soldSecond || 0);
    if (
      (line.soldFirst?.gt(0) && line.costTotalFirst === null) ||
      (line.soldSecond?.gt(0) && line.costTotalSecond === null)
    )
      known = false;
    cost = cost.add(line.costTotalFirst || 0).add(line.costTotalSecond || 0);
    return {
      ...line,
      sold: sold.toString(),
      revenue: money(line.revenueFirst.add(line.revenueSecond)),
      estimatedGross:
        (line.soldFirst?.gt(0) && line.costTotalFirst === null) ||
        (line.soldSecond?.gt(0) && line.costTotalSecond === null)
          ? null
          : money(
              line.revenueFirst
                .add(line.revenueSecond)
                .sub(
                  (line.costTotalFirst || D(0)).add(line.costTotalSecond || 0),
                ),
            ),
    };
  });
  return {
    ...day,
    date: dayDate,
    lines,
    totals: {
      first: money(first),
      second: money(second),
      revenue: money(first.add(second)),
      cost: known ? money(cost) : null,
      estimatedGross: known ? money(first.add(second).sub(cost)) : null,
    },
  };
}
export const ledgerRouter = Router(),
  transferRouter = Router();
ledgerRouter.get("/", async (req, res) =>
  res.json({
    success: true,
    data: await getLedger(date.parse(req.query.date || today())),
  }),
);
ledgerRouter.get("/days", async (_req, res) =>
  res.json({
    success: true,
    data: await prisma.ledgerDay.findMany({
      select: { id: true, date: true, stage: true },
      orderBy: { date: "desc" },
      take: 365,
    }),
  }),
);
ledgerRouter.post("/open", permit("inventory:write"), async (req, res) => {
  const body = z.object({ date }).strict().parse(req.body);
  res
    .status(201)
    .json({
      success: true,
      data: await openLedger(
        req.user.id,
        commandKey.parse(req.get("Idempotency-Key")),
        body.date,
      ),
    });
});
for (const action of ["draft", "close"] as const)
  ledgerRouter.post("/:id/" + action, permit("sales:write"), async (req, res) =>
    res.json({
      success: true,
      data: await countLedger(
        req.user.id,
        commandKey.parse(req.get("Idempotency-Key")),
        id.parse(req.params.id),
        countSchema.parse(req.body),
        action === "close",
      ),
    }),
  );
transferRouter.get("/", async (_req, res) => {
  const rows = await prisma.stockTransfer.findMany({
    include: { items: true, day: { select: { date: true } } },
    orderBy: { id: "desc" },
    take: 500,
  });
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });
  res.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      createdByName: users.find((x) => x.id === row.createdBy)?.username,
    })),
  });
});
transferRouter.post("/", permit("inventory:write"), async (req, res) =>
  res
    .status(201)
    .json({
      success: true,
      data: await transferStock(
        req.user.id,
        commandKey.parse(req.get("Idempotency-Key")),
        transferSchema.parse(req.body),
      ),
    }),
);
