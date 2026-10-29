import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { createServer } from "vite";

const url = new URL(
  process.env.TEST_DATABASE_URL || "postgresql://invalid/invalid",
);
if (!url.pathname.endsWith("_test"))
  throw new Error("E2E zahtijeva izdvojenu _test bazu.");
const schema = "e2e_" + randomBytes(8).toString("hex");
url.searchParams.set("connection_limit", "3");
const admin = new PrismaClient({
  datasources: { db: { url: url.toString() } },
});
await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
url.searchParams.set("schema", schema);
process.env.DATABASE_URL = url.toString();
process.env.APP_MODE = "test";
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, stdio: "pipe" },
);
const { prisma } = await import("../server/lensos/db.js");
const username = "e2e-owner",
  password = randomBytes(18).toString("base64url");
await prisma.user.create({
  data: {
    username,
    passwordHash: await bcrypt.hash(password, 4),
    role: "OWNER",
  },
});
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/e2e-credentials.json",
  JSON.stringify({ username, password, schema }),
);
const { app } = await import("../server/lensos/app.js");
const server = app.listen(3301, "127.0.0.1");
const vite = await createServer({
  server: {
    port: 5175,
    strictPort: true,
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:3301" },
  },
});
await vite.listen();
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await vite.close();
    server.close();
    await prisma.$disconnect();
    await admin.$disconnect();
    process.exit(0);
  });
