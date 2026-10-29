import { app } from "./app.js";
import { prisma, assertDatabaseMode } from "./db.js";
import express from "express";
import path from "node:path";

assertDatabaseMode();
await prisma.$connect();
// Fail before accepting requests if migrations have not been applied.
await prisma.inventoryItem.count();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
}
const server = app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log(
    `LensOS PostgreSQL API: http://localhost:${process.env.PORT || 3001}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    }),
  );
