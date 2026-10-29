import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, isDemo } from "./db.js";
import { authenticate, authRouter, permit } from "./auth.js";
import { ledgerRouter, transferRouter } from "./ledger.js";
import {
  adjustmentSchema,
  commandKey,
  D,
  date,
  HttpError,
  id,
  itemSchema,
  money,
  purchaseSchema,
  today,
} from "./validation.js";
import {
  adjustStock,
  audit,
  itemInclude,
  publicItem,
  publicPurchase,
  publicSale,
  purchaseInclude,
  recordPurchase,
  saleInclude,
  salesInRange,
  saveItem,
} from "./services.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
const origins = new Set(
  (
    process.env.LENSOS_CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((x) => x.trim()),
);
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || origins.has(origin)),
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Previše zahtjeva. Pokušajte uskoro." },
  }),
);
app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({
    status: "ok",
    message: "LensOS PostgreSQL API je pokrenut.",
    demo: isDemo,
  });
});
app.use("/api/auth", authRouter);
app.use("/api", authenticate, permit("read"));
app.get("/api/session", (req, res) =>
  res.json({ success: true, data: req.user, demo: isDemo }),
);
app.use("/api/ledger", ledgerRouter);
app.use("/api/stock-transfers", transferRouter);

app.get("/api/inventory/categories", async (_req, res) =>
  res.json({
    success: true,
    data: await prisma.category.findMany({ orderBy: { name: "asc" } }),
  }),
);
app.get("/api/inventory", async (req, res) => {
  const query = z
    .object({
      search: z.string().max(100).default(""),
      categoryId: z.union([id, z.literal("")]).optional(),
      lowStock: z.enum(["true", "false"]).optional(),
      sort: z
        .enum(["name", "category", "quantity", "price", "status"])
        .default("name"),
      direction: z.enum(["asc", "desc"]).default("asc"),
    })
    .parse(req.query);
  const ordering = {
    name: { name: query.direction },
    category: { category: { name: query.direction } },
    quantity: { currentQuantity: query.direction },
    price: { purchasePrice: query.direction },
    status: { active: query.direction },
  } satisfies Record<string, Prisma.InventoryItemOrderByWithRelationInput>;
  const rows = await prisma.inventoryItem.findMany({
    where: {
      name: { contains: query.search, mode: "insensitive" },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.lowStock === "true"
        ? {
            active: true,
            currentQuantity: {
              lte: prisma.inventoryItem.fields.minimumQuantity,
            },
          }
        : {}),
    },
    include: itemInclude,
    orderBy: [ordering[query.sort], { id: "asc" }],
    take: 1000,
  });
  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);
  res.json({
    success: true,
    data: rows.map(publicItem),
    categories,
    suppliers,
    demo: isDemo,
  });
});
app.get("/api/inventory/:id/movements", async (req, res) => {
  const itemId = id.parse(req.params.id);
  if (!(await prisma.inventoryItem.findUnique({ where: { id: itemId } })))
    throw new HttpError(404, "Artikal nije pronađen.");
  const rows = await prisma.stockMovement.findMany({
    where: { inventoryItemId: itemId },
    include: { createdBy: { select: { username: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1000,
  });
  res.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: row.quantity.toNumber(),
      previousQuantity: row.previousQuantity.toNumber(),
      newQuantity: row.newQuantity.toNumber(),
      unitCost: row.unitCost ? money(row.unitCost) : null,
      referenceId: row.referenceId,
      note: row.note,
      location: row.location,
      createdBy: row.createdBy.username,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});
app.get("/api/inventory/:id", async (req, res) => {
  const row = await prisma.inventoryItem.findUnique({
    where: { id: id.parse(req.params.id) },
    include: itemInclude,
  });
  if (!row) throw new HttpError(404, "Artikal nije pronađen.");
  res.json({ success: true, data: publicItem(row) });
});
app.post("/api/inventory", permit("inventory:write"), async (req, res) =>
  res.status(201).json({
    success: true,
    data: await saveItem(req.user.id, itemSchema.parse(req.body)),
  }),
);
app.patch("/api/inventory/:id", permit("inventory:write"), async (req, res) =>
  res.json({
    success: true,
    data: await saveItem(
      req.user.id,
      itemSchema.parse(req.body),
      id.parse(req.params.id),
    ),
  }),
);
app.patch(
  "/api/inventory/:id/status",
  permit("inventory:write"),
  async (req, res) => {
    const itemId = id.parse(req.params.id);
    const data = z.object({ active: z.boolean() }).strict().parse(req.body);
    await prisma.$transaction(async (tx) => {
      const before = await tx.inventoryItem.findUnique({
        where: { id: itemId },
      });
      if (!before) throw new HttpError(404, "Artikal nije pronađen.");
      if (!data.active && before.cafeQuantity.gt(0))
        throw new HttpError(
          409,
          "Artikal ima zalihu u kafiću. Ne može se deaktivirati prije razduženja.",
        );
      await tx.inventoryItem.update({ where: { id: itemId }, data });
      await audit(
        tx,
        req.user.id,
        "INVENTORY_STATUS_CHANGED",
        itemId,
        { active: before.active },
        data,
      );
    });
    res.json({ success: true });
  },
);
app.post(
  "/api/inventory/:id/adjustments",
  permit("inventory:write"),
  async (req, res) =>
    res.status(201).json({
      success: true,
      data: await adjustStock(
        req.user.id,
        commandKey.parse(req.get("Idempotency-Key")),
        id.parse(req.params.id),
        adjustmentSchema.parse(req.body),
      ),
    }),
);
app.get("/api/purchases", async (_req, res) =>
  res.json({
    success: true,
    data: (
      await prisma.purchase.findMany({
        include: purchaseInclude,
        orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
        take: 1000,
      })
    ).map(publicPurchase),
  }),
);
app.get("/api/purchases/:id", async (req, res) => {
  const row = await prisma.purchase.findUnique({
    where: { id: id.parse(req.params.id) },
    include: purchaseInclude,
  });
  if (!row) throw new HttpError(404, "Nabavka nije pronađena.");
  res.json({ success: true, data: publicPurchase(row) });
});
app.post("/api/purchases", permit("purchases:write"), async (req, res) =>
  res.status(201).json({
    success: true,
    data: await recordPurchase(
      req.user.id,
      commandKey.parse(req.get("Idempotency-Key")),
      purchaseSchema.parse(req.body),
    ),
  }),
);
app.get("/api/sales", async (req, res) => {
  const from = date.parse(req.query.from || today());
  const to = date.parse(req.query.to || from);
  if (from > to)
    throw new HttpError(400, "Početni datum mora biti prije završnog.");
  const rows = await salesInRange(from, to);
  res.json({
    success: true,
    data: rows.map(publicSale),
    limit: 5000,
    truncated: rows.length === 5000,
  });
});
app.get("/api/sales/:id", async (req, res) => {
  const row = await prisma.sale.findUnique({
    where: { id: id.parse(req.params.id) },
    include: saleInclude,
  });
  if (!row) throw new HttpError(404, "Prodaja nije pronađena.");
  res.json({ success: true, data: publicSale(row) });
});
app.post("/api/sales", permit("sales:write"), (_req, res) =>
  res.status(409).json({
    success: false,
    message:
      "Prodaja se sada obračunava u Knjizi pazara iz prebrojanog stanja. Otvorite knjigu i zaključite smjenu.",
  }),
);
app.get("/api/dashboard/summary", async (req, res) => {
  const day = date.parse(req.query.date || today());
  const data = await prisma.$transaction(
    async (tx) => {
      const saleIds = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM sales WHERE ("soldAt" AT TIME ZONE 'Europe/Sarajevo')::date = ${day}::date`;
      const sales = await tx.sale.findMany({
        where: { id: { in: saleIds.map((x) => x.id) } },
        include: { items: true },
      });
      const all = await tx.inventoryItem.findMany({
        where: { active: true },
        include: itemInclude,
      });
      const products = new Map<
        number,
        { name: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal }
      >();
      let revenue = D(0),
        quantity = D(0);
      for (const sale of sales) {
        revenue = revenue.add(sale.total);
        for (const item of sale.items) {
          quantity = quantity.add(item.quantity);
          const product = products.get(item.inventoryItemId) || {
            name: item.productName,
            quantity: D(0),
            revenue: D(0),
          };
          product.quantity = product.quantity.add(item.quantity);
          product.revenue = product.revenue.add(item.total);
          products.set(item.inventoryItemId, product);
        }
      }
      const low = all.filter(
        (item) =>
          item.currentQuantity.gt(0) &&
          item.currentQuantity.lte(item.minimumQuantity),
      );
      const out = all.filter((item) => item.currentQuantity.eq(0));
      return {
        date: day,
        currency: "BAM",
        todayRevenue: money(revenue),
        itemsSold: quantity.toNumber(),
        inventoryItems: all.length,
        lowStockCount: low.length,
        outOfStockCount: out.length,
        topProducts: [...products.values()]
          .sort((a, b) => b.quantity.cmp(a.quantity))
          .slice(0, 5)
          .map((p) => ({
            name: p.name,
            quantity: p.quantity.toNumber(),
            revenue: money(p.revenue),
          })),
        lowStock: low.map(publicItem),
        outOfStock: out.map(publicItem),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
  res.json({ success: true, data, demo: isDemo });
});
app.get("/api/audit", permit("audit:read"), async (_req, res) =>
  res.json({
    success: true,
    data: await prisma.auditLog.findMany({
      orderBy: { id: "desc" },
      take: 200,
      include: { user: { select: { username: true } } },
    }),
  }),
);
app.use("/api", (_req, res) =>
  res
    .status(404)
    .json({ success: false, message: "Traženi API nije pronađen." }),
);
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: error.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join(" "),
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2003", "P2025"].includes(error.code)
  ) {
    res.status(409).json({
      success: false,
      message:
        "Podaci su promijenjeni ili povezani s historijom. Osvježite prikaz.",
    });
    return;
  }
  if (
    error.type === "entity.parse.failed" ||
    error.type === "entity.too.large"
  ) {
    res.status(400).json({
      success: false,
      message: "Tijelo zahtjeva nije ispravno ili je preveliko.",
    });
    return;
  }
  console.error("LensOS API error", error.code || error.name);
  res
    .status(500)
    .json({ success: false, message: "Greška servera. Pokušajte ponovo." });
};
app.use(errors);
