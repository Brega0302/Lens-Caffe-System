import "dotenv/config";
import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "supertest";
import type { Express } from "express";
const url = new URL(
  process.env.TEST_DATABASE_URL || "postgresql://invalid/invalid",
);
if (!url.pathname.endsWith("_test"))
  throw new Error("Potrebna je izdvojena _test baza.");
const schema = "test_" + randomBytes(8).toString("hex");
url.searchParams.set("connection_limit", "3");
const admin = new PrismaClient({
  datasources: { db: { url: url.toString() } },
});
url.searchParams.set("schema", schema);
process.env.DATABASE_URL = url.toString();
process.env.APP_MODE = "test";
process.env.NODE_ENV = "test";
let app: Express,
  db: PrismaClient,
  userId: number,
  itemId: number,
  token: string;
const headers = () => ({ Authorization: `Bearer ${token}` });
const post = (path: string, body: object, key: string = randomUUID()) =>
  request(app)
    .post("/api" + path)
    .set(headers())
    .set("Idempotency-Key", key)
    .send(body);
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sarajevo" }).format(
    new Date(),
  );
const getBook = async () =>
  (
    await request(app)
      .get("/api/ledger?date=" + today())
      .set(headers())
      .expect(200)
  ).body.data;
const transfer = (quantity: string, key?: string) =>
  post(
    "/stock-transfers",
    { items: [{ inventoryItemId: itemId, quantity }] },
    key,
  );
const count = async (quantity: string, close = true, key?: string) => {
  const book = await getBook();
  return post(
    `/ledger/${book.id}/${close ? "close" : "draft"}`,
    {
      version: book.version,
      stage: book.stage,
      counts: book.lines.map(
        (line: {
          inventoryItemId: number;
          opening: string;
          receivedFirst: string;
          countFirst: string;
          receivedSecond: string;
        }) => ({
          inventoryItemId: line.inventoryItemId,
          quantity:
            line.inventoryItemId === itemId
              ? quantity
              : String(
                  book.stage === 1
                    ? Number(line.opening) + Number(line.receivedFirst)
                    : Number(line.countFirst) + Number(line.receivedSecond),
                ),
        }),
      ),
    },
    key,
  );
};
before(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, stdio: "pipe" },
  );
  db = (await import("./db.js")).prisma;
  app = (await import("./app.js")).app;
});
after(async () => {
  await db?.$disconnect();
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.$disconnect();
});
beforeEach(async () => {
  await db.command.deleteMany();
  await db.auditLog.deleteMany();
  await db.stockMovement.deleteMany();
  await db.transferItem.deleteMany();
  await db.stockTransfer.deleteMany();
  await db.saleItem.deleteMany();
  await db.sale.deleteMany();
  await db.purchaseItem.deleteMany();
  await db.purchase.deleteMany();
  await db.ledgerLine.deleteMany();
  await db.ledgerDay.deleteMany();
  await db.inventoryItem.deleteMany();
  await db.category.deleteMany();
  await db.supplier.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  userId = (
    await db.user.create({
      data: {
        username: "test-owner",
        passwordHash: await bcrypt.hash("test-password-only", 4),
        role: "OWNER",
      },
    })
  ).id;
  token = randomBytes(32).toString("base64url");
  const { hash } = await import("./auth.js");
  await db.session.create({
    data: {
      userId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  itemId = (
    await post("/inventory", {
      name: "Test sok",
      category: "Pića",
      unit: "bottle",
      minimumQuantity: "3",
      sellingPrice: "2.50",
      sellable: true,
    }).expect(201)
  ).body.data.id;
  await post("/purchases", {
    purchaseDate: today(),
    invoiceReference: "TEST-001",
    items: [{ inventoryItemId: itemId, quantity: "10", unitCost: "1.20" }],
  }).expect(201);
});
describe("Warehouse, café and shift ledger", () => {
  it("keeps purchases in warehouse and preserves cost history", async () => {
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    assert.equal(item.currentQuantity.toString(), "10");
    assert.equal(item.cafeQuantity.toString(), "0");
    assert.equal(item.warehouseCost?.toString(), "1.2");
    assert.equal(
      (await db.purchaseItem.findFirstOrThrow()).unitCost.toFixed(2),
      "1.20",
    );
  });
  it("transfers both balances atomically and fills the first shift", async () => {
    await transfer("6").expect(201);
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    assert.equal(item.currentQuantity.toString(), "4");
    assert.equal(item.cafeQuantity.toString(), "6");
    const book = await getBook();
    assert.equal(book.lines[0].opening, "0");
    assert.equal(book.lines[0].receivedFirst, "6");
    assert.equal(
      await db.stockMovement.count({
        where: { type: { in: ["TRANSFER_IN", "TRANSFER_OUT"] } },
      }),
      2,
    );
  });
  it("does not duplicate a transfer on replay", async () => {
    const key = randomUUID();
    const first = await transfer("4", key).expect(201),
      second = await transfer("4", key).expect(201);
    assert.equal(first.body.data.id, second.body.data.id);
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).cafeQuantity.toString(),
      "4",
    );
  });
  it("prevents concurrent transfer overspending", async () => {
    const results = await Promise.all([transfer("8"), transfer("8")]);
    assert.deepEqual(results.map((x) => x.status).sort(), [201, 409]);
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).currentQuantity.toString(),
      "2",
    );
  });
  it("rolls back a whole transfer if a later line is invalid", async () => {
    await post("/stock-transfers", {
      items: [
        { inventoryItemId: itemId, quantity: "3" },
        { inventoryItemId: 2147483647, quantity: "1" },
      ],
    }).expect(400);
    assert.equal(await db.stockTransfer.count(), 0);
    assert.equal(await db.ledgerDay.count(), 0);
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).currentQuantity.toString(),
      "10",
    );
  });
  it("separates hygiene from saleable ledger items", async () => {
    const soap = (
      await post("/inventory", {
        name: "Sapun",
        unit: "bottle",
        sellable: false,
        sellingPrice: "0",
      }).expect(201)
    ).body.data.id;
    await post("/purchases", {
      purchaseDate: today(),
      items: [{ inventoryItemId: soap, quantity: "4", unitCost: "2" }],
    }).expect(201);
    await post("/stock-transfers", {
      items: [{ inventoryItemId: soap, quantity: "2" }],
    }).expect(201);
    const book = await getBook();
    assert.equal(
      book.lines.some(
        (x: { inventoryItemId: number }) => x.inventoryItemId === soap,
      ),
      false,
    );
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: soap } })
      ).cafeQuantity.toString(),
      "2",
    );
  });
  it("saves draft counts without changing stock or revenue", async () => {
    await transfer("6");
    assert.equal((await count("2", false)).status, 200);
    assert.equal((await getBook()).lines[0].countFirst, "2");
    assert.equal(await db.sale.count(), 0);
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).cafeQuantity.toString(),
      "6",
    );
  });
  it("records first handover as a sale from café without reducing warehouse again", async () => {
    await transfer("6");
    const response = await count("2");
    assert.equal(response.status, 200);
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    assert.equal(item.currentQuantity.toString(), "4");
    assert.equal(item.cafeQuantity.toString(), "2");
    const book = await getBook();
    assert.equal(book.stage, 2);
    assert.equal(book.lines[0].soldFirst, "4");
    assert.equal(book.totals.first, "10.00");
    assert.equal(book.totals.estimatedGross, "5.20");
  });
  it("allocates second-shift restock and calculates the final takings", async () => {
    await transfer("6");
    assert.equal((await count("2")).status, 200);
    await transfer("2").expect(201);
    assert.equal((await count("1")).status, 200);
    const book = await getBook();
    assert.equal(book.stage, 3);
    assert.equal(book.lines[0].receivedFirst, "6");
    assert.equal(book.lines[0].receivedSecond, "2");
    assert.equal(book.lines[0].sold, "7");
    assert.equal(book.totals.revenue, "17.50");
    assert.equal(book.totals.estimatedGross, "9.10");
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).cafeQuantity.toString(),
      "1",
    );
  });
  it("replays shift confirmation without a duplicate sale", async () => {
    await transfer("5");
    const book = await getBook(),
      key = randomUUID(),
      body = {
        version: book.version,
        stage: 1,
        counts: [{ inventoryItemId: itemId, quantity: "2" }],
      };
    const a = await post(`/ledger/${book.id}/close`, body, key).expect(200),
      b = await post(`/ledger/${book.id}/close`, body, key).expect(200);
    assert.equal(a.body.data.saleId, b.body.data.saleId);
    assert.equal(await db.sale.count(), 1);
    assert.equal(
      await db.stockMovement.count({ where: { type: "CAFE_SALE" } }),
      1,
    );
  });
  it("rejects stale counts after another delivery", async () => {
    await transfer("5");
    const old = await getBook();
    await transfer("1");
    await post(`/ledger/${old.id}/close`, {
      version: old.version,
      stage: 1,
      counts: [{ inventoryItemId: itemId, quantity: "2" }],
    }).expect(409);
    assert.equal(await db.sale.count(), 0);
  });
  it("rejects missing or over-counted inventory", async () => {
    await transfer("5");
    assert.equal((await count("6")).status, 400);
    const book = await getBook();
    await post(`/ledger/${book.id}/close`, {
      version: book.version,
      stage: 1,
      counts: [],
    }).expect(400);
    assert.equal(await db.sale.count(), 0);
  });
  it("freezes prices and closed shifts", async () => {
    await transfer("5");
    await db.inventoryItem.update({
      where: { id: itemId },
      data: { sellingPrice: "9.00" },
    });
    assert.equal((await count("3")).status, 200);
    const book = await getBook();
    assert.equal(book.lines[0].sellingPrice, "2.5");
    assert.equal(book.totals.first, "5.00");
    await post(`/ledger/${book.id}/close`, {
      version: book.version,
      stage: 1,
      counts: [{ inventoryItemId: itemId, quantity: "2" }],
    }).expect(409);
  });
  it("carries last night closing into a new day", async () => {
    const yesterday = new Date(today() + "T12:00:00Z");
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = yesterday.toISOString().slice(0, 10);
    await db.inventoryItem.update({
      where: { id: itemId },
      data: { cafeQuantity: "3", cafeCost: "1.2" },
    });
    const opened = await post("/ledger/open", { date }).expect(201);
    let day = await db.ledgerDay.findUniqueOrThrow({
      where: { id: opened.body.data.id },
    });
    await post(`/ledger/${day.id}/close`, {
      version: day.version,
      stage: 1,
      counts: [{ inventoryItemId: itemId, quantity: "2" }],
    }).expect(200);
    day = await db.ledgerDay.findUniqueOrThrow({ where: { id: day.id } });
    await post(`/ledger/${day.id}/close`, {
      version: day.version,
      stage: 2,
      counts: [{ inventoryItemId: itemId, quantity: "1" }],
    }).expect(200);
    await post("/ledger/open", { date: today() }).expect(201);
    assert.equal((await getBook()).lines[0].opening, "1");
  });
  it("uses weighted purchase costs and does not invent missing profit", async () => {
    await post("/purchases", {
      purchaseDate: today(),
      items: [{ inventoryItemId: itemId, quantity: "10", unitCost: "2.00" }],
    }).expect(201);
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).warehouseCost?.toString(),
      "1.6",
    );
    await db.inventoryItem.update({
      where: { id: itemId },
      data: { warehouseCost: null },
    });
    await transfer("2");
    assert.equal((await count("1")).status, 200);
    assert.equal((await getBook()).totals.estimatedGross, null);
  });
  it("detects warehouse low-stock after issuance", async () => {
    await transfer("8");
    const result = await request(app)
      .get("/api/dashboard/summary")
      .set(headers())
      .expect(200);
    assert.equal(result.body.data.lowStockCount, 1);
    assert.equal(result.body.data.todayRevenue, "0.00");
  });
  it("keeps direct stock sale API disabled to prevent double counting", async () => {
    await post("/sales", {
      items: [{ inventoryItemId: itemId, quantity: "1" }],
    }).expect(409);
    assert.equal(await db.sale.count(), 0);
  });
  it("enforces permissions and does not allow silent stock overwrites", async () => {
    await request(app).get("/api/ledger").expect(401);
    await request(app)
      .patch(`/api/inventory/${itemId}`)
      .set(headers())
      .send({ name: "X", unit: "piece", cafeQuantity: "100" })
      .expect(400);
    await db.user.update({ where: { id: userId }, data: { role: "EMPLOYEE" } });
    await transfer("1").expect(403);
  });
  it("enforces database balance and café nonnegative constraints", async () => {
    await assert.rejects(
      db.inventoryItem.update({
        where: { id: itemId },
        data: { cafeQuantity: "-1" },
      }),
    );
    await assert.rejects(
      db.stockMovement.create({
        data: {
          inventoryItemId: itemId,
          type: "TRANSFER_IN",
          location: "CAFE",
          quantity: "2",
          previousQuantity: "0",
          newQuantity: "1",
          createdById: userId,
        },
      }),
    );
  });
  it("preserves audited warehouse corrections and requires a reason", async () => {
    await post(`/inventory/${itemId}/adjustments`, {
      quantity: "-1",
      note: "",
    }).expect(400);
    await post(`/inventory/${itemId}/adjustments`, {
      quantity: "-1",
      note: "Pogrešan prijem",
    }).expect(201);
    assert.equal(
      (
        await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
      ).currentQuantity.toString(),
      "9",
    );
    assert.equal(
      await db.auditLog.count({ where: { action: "STOCK_ADJUSTED" } }),
      1,
    );
  });
});
