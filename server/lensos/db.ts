import "dotenv/config";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const isDemo = process.env.APP_MODE === "demo";
export function assertDatabaseMode() {
  const url = new URL(
    process.env.DATABASE_URL || "postgresql://invalid/invalid",
  );
  const name = url.pathname.slice(1);
  if (isDemo && !name.endsWith("_demo"))
    throw new Error(
      "Demo način zahtijeva posebnu bazu čije ime završava na _demo.",
    );
  if (!isDemo && name.endsWith("_demo"))
    throw new Error("Demo baza zahtijeva APP_MODE=demo.");
  if (process.env.NODE_ENV === "production" && isDemo)
    throw new Error("Demo baza nije dozvoljena u produkciji.");
}
