import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma, assertDatabaseMode, isDemo } from "./db.js";
import { recordPurchase, saveItem } from "./services.js";
import { transferStock, getLedger, countLedger } from "./ledger.js";
import { today } from "./validation.js";

assertDatabaseMode();
if (!isDemo || process.env.NODE_ENV === "production")
  throw new Error("Demo seed je dozvoljen samo u izdvojenoj _demo bazi.");
try {
  const username = process.env.LENSOS_OWNER_USERNAME || "lens-demo-owner";
  let user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    const password =
      process.env.LENSOS_OWNER_PASSWORD ||
      randomBytes(18).toString("base64url");
    if (password.length < 12)
      throw new Error("Lozinka mora imati najmanje 12 znakova.");
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 12),
        role: "OWNER",
      },
    });
    console.log(`Demo korisnik: ${username}`);
    if (!process.env.LENSOS_OWNER_PASSWORD)
      console.log(`Jednokratni prikaz demo lozinke: ${password}`);
  }
  if (await prisma.inventoryItem.count()) {
    console.log("Demo podaci već postoje; nisu prepisani.");
  } else {
    const examples = [
      [
        "Coca-Cola 0,25 l",
        "Bezalkoholna pića",
        "bottle",
        "1.20",
        "2.50",
        "24",
        "100",
      ],
      [
        "Sprite 0,25 l",
        "Bezalkoholna pića",
        "bottle",
        "1.10",
        "2.50",
        "20",
        "80",
      ],
      ["Mineralna voda 0,25 l", "Voda", "bottle", "0.60", "2.00", "24", "120"],
      ["Negazirana voda 0,33 l", "Voda", "bottle", "0.55", "2.00", "20", "60"],
      ["Sok narandža 0,20 l", "Sokovi", "bottle", "1.30", "3.00", "12", "10"],
      ["Kafa u zrnu", "Sirovine", "kg", "24.00", "0.00", "3", "2"],
      ["Mlijeko", "Sirovine", "litre", "2.10", "0.00", "10", "15"],
      ["Sirup od mente", "Sirupi", "bottle", "9.50", "0.00", "2", "0"],
    ];
    const entries = [];
    for (const [
      name,
      category,
      unit,
      purchasePrice,
      sellingPrice,
      minimumQuantity,
      stock,
    ] of examples) {
      const item = await saveItem(user.id, {
        name,
        category,
        unit: unit as "bottle" | "kg" | "litre",
        purchasePrice,
        sellingPrice,
        minimumQuantity,
        supplier: "Demo dobavljač",
        notes: "Primjer za demonstraciju; nije stvarno stanje kafića.",
      });
      if (stock !== "0")
        entries.push({
          inventoryItemId: item.id,
          quantity: stock,
          unitCost: purchasePrice,
        });
    }
    await recordPurchase(user.id, "demo-initial-stock-2026", {
      supplier: "Demo dobavljač",
      purchaseDate: today(),
      invoiceReference: "DEMO-001",
      note: "Početno demo stanje.",
      items: entries,
    });
    const drinks = await prisma.inventoryItem.findMany({
      where: { sellingPrice: { gt: 0 } },
      orderBy: { id: "asc" },
    });
    await transferStock(user.id, "demo-initial-transfer-2026", {
      note: "Demo izdavanje u kafić",
      items: drinks
        .slice(0, 3)
        .map((item, i) => ({
          inventoryItemId: item.id,
          quantity: String([20, 18, 24][i]),
        })),
    });
    const book = await getLedger(today());
    if (book)
      await countLedger(
        user.id,
        "demo-initial-shift-2026",
        book.id,
        {
          version: book.version,
          stage: 1,
          note: "Demo predaja prve smjene — nije stvarni promet.",
          counts: book.lines.map((line) => {
            const index = drinks
              .slice(0, 3)
              .findIndex((item) => item.id === line.inventoryItemId);
            return {
              inventoryItemId: line.inventoryItemId,
              quantity: line.opening
                .add(line.receivedFirst)
                .sub(index >= 0 ? [8, 5, 6][index] : 0)
                .toString(),
            };
          }),
        },
        true,
      );
    console.log(
      "Kreirani su odvojeni demo artikli, nabavka i prodaja. Recepti nisu uključeni.",
    );
  }
} finally {
  await prisma.$disconnect();
}
