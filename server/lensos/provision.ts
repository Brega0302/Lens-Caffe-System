import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma, assertDatabaseMode } from "./db.js";

assertDatabaseMode();
try {
  const username = process.env.LENSOS_OWNER_USERNAME || "owner";
  if (await prisma.user.count())
    throw new Error(
      "Baza već ima korisnike. Ova naredba je samo za prvog vlasnika.",
    );
  const password =
    process.env.LENSOS_OWNER_PASSWORD || randomBytes(18).toString("base64url");
  if (password.length < 12)
    throw new Error("Lozinka mora imati najmanje 12 znakova.");
  await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: "OWNER",
    },
  });
  console.log(`Vlasnik je kreiran. Korisničko ime: ${username}`);
  if (!process.env.LENSOS_OWNER_PASSWORD)
    console.log(`Jednokratni prikaz lozinke: ${password}`);
} finally {
  await prisma.$disconnect();
}
