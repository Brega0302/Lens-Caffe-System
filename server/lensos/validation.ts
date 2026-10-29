import { z } from "zod";
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const id = z.coerce.number().int().positive().max(2147483647);
export const decimal = (scale: number, positive = false, signed = false) =>
  z
    .union([z.string(), z.number()])
    .transform(String)
    .refine(
      (value) => {
        if (
          !new RegExp(
            `^${signed ? "-?" : ""}\\d{1,9}(?:\\.\\d{1,${scale}})?$`,
          ).test(value)
        )
          return false;
        const number = new Prisma.Decimal(value);
        return positive ? number.gt(0) : signed ? !number.eq(0) : number.gte(0);
      },
      `Unesite ${positive ? "pozitivan" : signed ? "nenulti" : "nenegativan"} iznos s najviše ${scale} decimale.`,
    );
export const amount = decimal(3, true);
export const price = decimal(2);
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Datum nije ispravan.");
export const itemSchema = z
  .object({
    name: z.string().trim().min(1, "Naziv je obavezan.").max(160),
    category: optionalText(120),
    supplier: optionalText(160),
    unit: z.enum([
      "piece",
      "bottle",
      "can",
      "kg",
      "g",
      "litre",
      "ml",
      "package",
      "box",
    ]),
    minimumQuantity: decimal(3).default("0"),
    purchasePrice: price.default("0"),
    sellingPrice: price.default("0"),
    notes: optionalText(1000),
    sellable: z.boolean().optional(),
  })
  .strict();
const uniqueLines = (items: { inventoryItemId: number }[]) =>
  new Set(items.map((i) => i.inventoryItemId)).size === items.length;
export const purchaseSchema = z
  .object({
    supplier: optionalText(160),
    purchaseDate: date,
    invoiceReference: optionalText(120),
    note: optionalText(1000),
    items: z
      .array(
        z
          .object({ inventoryItemId: id, quantity: amount, unitCost: price })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(uniqueLines, "Artikal smije biti naveden samo jednom."),
  })
  .strict();
export const saleSchema = z
  .object({
    saleDate: date.optional(),
    soldAt: z.string().datetime({ offset: true }).optional(),
    note: optionalText(1000),
    items: z
      .array(
        z
          .object({
            inventoryItemId: id,
            quantity: amount,
            sellingPrice: price.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100)
      .refine(uniqueLines, "Artikal smije biti naveden samo jednom."),
  })
  .strict();
export const adjustmentSchema = z
  .object({
    quantity: decimal(3, false, true),
    type: z.literal("MANUAL_ADJUSTMENT").default("MANUAL_ADJUSTMENT"),
    note: z.string().trim().min(3, "Navedite razlog promjene.").max(1000),
  })
  .strict();
export const commandKey = z
  .string()
  .min(16)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Neispravan ključ zahtjeva.");
export const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const money = (value: Prisma.Decimal.Value) => D(value).toFixed(2);
export const lineTotal = (quantity: string, unitPrice: string) =>
  D(quantity).mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sarajevo" }).format(
    new Date(),
  );
export const localTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Sarajevo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(value)
    .replace(" ", "T");
