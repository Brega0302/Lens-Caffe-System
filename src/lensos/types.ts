export type InventoryItem = {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  currentQuantity: number;
  cafeQuantity: number;
  sellable: boolean;
  minimumQuantity: number;
  purchasePrice: string;
  sellingPrice: string;
  supplier: string | null;
  active: boolean;
  status: "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";
  demo: boolean;
  notes?: string | null;
  lastPurchasedAt: string | null;
};
export type Category = { id: number; name: string };
export type InventoryResponse = {
  data: InventoryItem[];
  categories: Category[];
  demo: boolean;
};
export type Movement = {
  id: number;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  unitCost: string | null;
  referenceId: number | null;
  location: string;
};
export type Purchase = {
  id: number;
  purchase_date: string;
  supplier_name: string | null;
  created_by_name: string;
  invoiceReference: string | null;
  note: string | null;
  totalCost: string;
  is_demo: boolean;
  items: {
    id: number;
    name: string;
    unit: string;
    quantity: number;
    unitCost: string;
    totalCost: string;
  }[];
};
export type Sale = {
  id: number;
  soldAt: string;
  soldAtUtc: string;
  total: string;
  createdBy: string;
  note: string | null;
  demo: boolean;
  items: {
    inventoryItemId: number;
    productName: string;
    quantity: number;
    sellingPrice: string;
    total: string;
  }[];
};
export type Dashboard = {
  todayRevenue: string;
  itemsSold: number;
  inventoryItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  topProducts: { name: string; quantity: number; revenue: string }[];
  lowStock: InventoryItem[];
  outOfStock: InventoryItem[];
};
export const units: Record<string, string> = {
  piece: "kom",
  bottle: "boca",
  can: "limenka",
  kg: "kg",
  g: "g",
  litre: "l",
  ml: "ml",
  package: "paket",
  box: "kutija",
};
export const movementNames: Record<string, string> = {
  PURCHASE: "Nabavka",
  SALE: "Prodaja",
  MANUAL_ADJUSTMENT: "Korekcija",
  TRANSFER_OUT: 'Izdavanje u kafić',
  TRANSFER_IN: 'Prijem u kafiću',
  CAFE_SALE: 'Prodaja iz kafića',
};
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Došlo je do greške. Pokušajte ponovo.";
export const formatDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sarajevo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((x) => x.type === key)?.value;
  return `${part("day")}.${part("month")}.${part("year")}. ${part("hour")}:${part("minute")}`;
};
export const cafeDate = (weekday = false) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sarajevo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (key: string) =>
    Number(parts.find((x) => x.type === key)?.value);
  const months = [
    "januar",
    "februar",
    "mart",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "septembar",
    "oktobar",
    "novembar",
    "decembar",
  ];
  const days = [
    "nedjelja",
    "ponedjeljak",
    "utorak",
    "srijeda",
    "četvrtak",
    "petak",
    "subota",
  ];
  const year = part("year"),
    month = part("month"),
    day = part("day");
  return `${weekday ? days[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()] + ", " : ""}${day}. ${months[month - 1]} ${year}.`;
};
