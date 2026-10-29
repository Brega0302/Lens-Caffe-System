import bcrypt from 'bcrypt';
import process from 'node:process';
import { randomBytes } from 'node:crypto';
import db from './init.js';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');

const run = async () => {
  let owner = db.prepare("SELECT id FROM Users WHERE username='lens-demo-owner'").get();
  let oneTimePassword = null;
  if (!owner) {
    oneTimePassword = process.env.LENSOS_DEMO_PASSWORD || randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(oneTimePassword, 12);
    const result = db.prepare("INSERT INTO Users(username,password_hash,role,is_active) VALUES('lens-demo-owner',?,'OWNER',1)").run(hash);
    owner = { id: result.lastInsertRowid };
  } else if (process.env.LENSOS_DEMO_PASSWORD) {
    const hash = await bcrypt.hash(process.env.LENSOS_DEMO_PASSWORD, 12);
    db.prepare('UPDATE Users SET password_hash=?,is_active=1 WHERE id=?').run(hash, owner.id);
  }
  if (db.prepare('SELECT id FROM InventoryItems WHERE is_demo=1 LIMIT 1').get()) {
    console.log('LensOS demo inventory already exists; left it unchanged.');
    if (oneTimePassword) console.log(`One-time demo login: lens-demo-owner / ${oneTimePassword}`);
    return;
  }

  const categories = ['Coffee', 'Soft Drinks', 'Water', 'Cocktails', 'Non-Alcoholic Cocktails', 'Food', 'Hookah', 'Syrups'];
  const categoryIds = Object.fromEntries(categories.map((name) => {
    const id = db.prepare('INSERT INTO InventoryCategories(name,is_demo) VALUES(?,1)').run(name).lastInsertRowid;
    return [name, id];
  }));
  const supplierIds = Object.fromEntries(['Café Lens Demo Supplier', 'Soft Drinks Demo Supplier'].map((name) => {
    const id = db.prepare('INSERT INTO Suppliers(name,is_demo) VALUES(?,1)').run(name).lastInsertRowid;
    return [name, id];
  }));
  const products = [
    ['Coffee Beans', 'Coffee', 'kg', '8', '3', '18.00', '0.00', 'Café Lens Demo Supplier'],
    ['Milk', 'Food', 'litre', '12', '5', '1.60', '0.00', 'Café Lens Demo Supplier'],
    ['Espresso', 'Coffee', 'piece', '60', '20', '0.35', '2.00', 'Café Lens Demo Supplier'],
    ['Cappuccino', 'Coffee', 'piece', '40', '15', '0.55', '3.00', 'Café Lens Demo Supplier'],
    ['Coca-Cola', 'Soft Drinks', 'can', '42', '20', '1.20', '2.00', 'Soft Drinks Demo Supplier'],
    ['Sprite', 'Soft Drinks', 'can', '18', '20', '1.10', '2.00', 'Soft Drinks Demo Supplier'],
    ['Mineral Water', 'Water', 'bottle', '30', '12', '0.70', '1.50', 'Soft Drinks Demo Supplier'],
    ['Blue Curaçao Syrup', 'Syrups', 'ml', '2500', '500', '0.01', '0.00', 'Café Lens Demo Supplier'],
    ['Mint Syrup', 'Syrups', 'ml', '1200', '500', '0.01', '0.00', 'Café Lens Demo Supplier'],
    ['Lemon', 'Food', 'piece', '5', '8', '0.30', '0.00', 'Café Lens Demo Supplier'],
    ['Lime', 'Food', 'piece', '0', '6', '0.35', '0.00', 'Café Lens Demo Supplier'],
  ];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.LENSOS_TIME_ZONE || 'Europe/Sarajevo' }).format(new Date());
  const makeSeed = db.transaction(() => {
    const purchase = db.prepare(`INSERT INTO Purchases(supplier_id,purchase_date,note,created_by,is_demo)
      VALUES(?,?, 'Demo opening stock receipt', ?,1)`).run(supplierIds['Café Lens Demo Supplier'], today, owner.id);
    let purchaseTotal = 0;
    const ids = {};
    for (const [name, category, unit, startingStock, minimum, cost, price, supplier] of products) {
      const stockMilli = Math.round(Number(startingStock) * 1000);
      const costMinor = Math.round(Number(cost) * 100);
      const priceMinor = Math.round(Number(price) * 100);
      const itemId = db.prepare(`INSERT INTO InventoryItems(name,category_id,unit,current_quantity_milli,minimum_quantity_milli,purchase_price_minor,selling_price_minor,supplier_id,is_demo)
        VALUES(?,?,?,?,?,?,?,?,1)`).run(name, categoryIds[category], unit, stockMilli, Math.round(Number(minimum) * 1000), costMinor, priceMinor, supplierIds[supplier]).lastInsertRowid;
      ids[name] = itemId;
      const initialQuantity = stockMilli;
      if (initialQuantity > 0) {
        const lineTotal = Math.round(initialQuantity * costMinor / 1000);
        purchaseTotal += lineTotal;
        db.prepare('INSERT INTO PurchaseItems(purchase_id,inventory_item_id,quantity_milli,unit_cost_minor,total_cost_minor) VALUES(?,?,?,?,?)')
          .run(purchase.lastInsertRowid, itemId, initialQuantity, costMinor, lineTotal);
        db.prepare(`INSERT INTO InventoryMovements(inventory_item_id,movement_type,quantity_milli,previous_quantity_milli,new_quantity_milli,unit_cost_minor,reference_type,reference_id,note,created_by,is_demo)
          VALUES(?,'PURCHASE',?,0,?,?, 'PURCHASE',?,'Demo opening stock',?,1)`).run(itemId, initialQuantity, initialQuantity, costMinor, purchase.lastInsertRowid, owner.id);
      }
    }
    db.prepare('UPDATE Purchases SET total_cost_minor=? WHERE id=?').run(purchaseTotal, purchase.lastInsertRowid);
    // A small sample ledger entry demonstrates the sale snapshot and stock movement flow.
    const sale = db.prepare("INSERT INTO Sales(sold_at,total_revenue_minor,created_by,note,is_demo) VALUES(?,0,?,'Demo sample sale',1)").run(`${today}T10:30:00`, owner.id);
    let salesTotal = 0;
    for (const [name, amount] of [['Espresso', 10], ['Coca-Cola', 4], ['Cappuccino', 3]]) {
      const item = db.prepare('SELECT * FROM InventoryItems WHERE id=?').get(ids[name]);
      const amountMilli = amount * 1000;
      const lineTotal = amount * item.selling_price_minor;
      const next = item.current_quantity_milli - amountMilli;
      salesTotal += lineTotal;
      db.prepare('UPDATE InventoryItems SET current_quantity_milli=? WHERE id=?').run(next, item.id);
      db.prepare('INSERT INTO SaleItems(sale_id,inventory_item_id,product_name_snapshot,quantity_milli,selling_price_minor,total_minor) VALUES(?,?,?,?,?,?)')
        .run(sale.lastInsertRowid, item.id, item.name, amountMilli, item.selling_price_minor, lineTotal);
      db.prepare(`INSERT INTO InventoryMovements(inventory_item_id,movement_type,quantity_milli,previous_quantity_milli,new_quantity_milli,unit_cost_minor,reference_type,reference_id,note,created_by,is_demo)
        VALUES(?,'SALE',?,?,?,?, 'SALE',?,'Demo sample sale',?,1)`).run(item.id, -amountMilli, item.current_quantity_milli, next, item.purchase_price_minor, sale.lastInsertRowid, owner.id);
    }
    db.prepare('UPDATE Sales SET total_revenue_minor=? WHERE id=?').run(salesTotal, sale.lastInsertRowid);
  });
  makeSeed();
  console.log('Created clearly marked LensOS demo categories, items, supplier, purchase, stock movements, and sales.');
  if (oneTimePassword) console.log(`One-time demo login: lens-demo-owner / ${oneTimePassword}`);
};

run().catch((error) => { console.error('Demo seed failed:', error.message); process.exitCode = 1; }).finally(() => db.close());
