import "dotenv/config";
import { readFileSync, unlinkSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

export default async function teardown() {
  const url = new URL(
    process.env.TEST_DATABASE_URL || "postgresql://invalid/invalid",
  );
  if (!url.pathname.endsWith("_test"))
    throw new Error("Odbijeno čišćenje izvan testne baze.");
  let schema: string;
  try {
    schema = JSON.parse(
      readFileSync(".local/e2e-credentials.json", "utf8"),
    ).schema;
  } catch {
    return;
  }
  if (!/^e2e_[0-9a-f]{16}$/.test(schema))
    throw new Error("Neispravan naziv testne sheme.");
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    unlinkSync(".local/e2e-credentials.json");
  } finally {
    await db.$disconnect();
  }
}
