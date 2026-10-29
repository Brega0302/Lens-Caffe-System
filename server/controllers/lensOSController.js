import db from '../db/init.js';
import process from 'node:process';

const units = new Set(['piece', 'bottle', 'can', 'kg', 'g', 'litre', 'ml', 'package', 'box']);
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const quantityMilli = (value, label = 'Quantity', { allowZero = false, signed = false } = {}) => {
  const stringValue = String(value ?? '').trim();
  const pattern = signed ? /^-?\d+(?:\.\d{1,3})?$/ : /^\d+(?:\.\d{1,3})?$/;
  if (!pattern.test(stringValue)) throw new Error(`${label} must be a number with up to 3 decimal places.`);
  const parsed = Math.round(Number(stringValue) * 1000);
  if ((!allowZero && (signed ? parsed === 0 : parsed <= 0)) || (allowZero && parsed < 0)) throw new Error(`${label} must be ${allowZero ? 'zero or greater' : signed ? 'non-zero' : 'greater than zero'}.`);
  return parsed;
};

const moneyMinor = (value, label = 'Price') => {
  const stringValue = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(stringValue)) throw new Error(`${label} must be a non-negative amount with up to 2 decimal places.`);
  const [whole, fraction = ''] = stringValue.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

const quantity = (milli) => milli / 1000;
const money = (minor) => (minor / 100).toFixed(2);
const itemSelect = `SELECT i.*, c.name AS category_name, s.name AS supplier_name
  FROM InventoryItems i LEFT JOIN InventoryCategories c ON c.id=i.category_id
  LEFT JOIN Suppliers s ON s.id=i.supplier_id`;
const publicItem = (row) => ({
  id: row.id, name: row.name, categoryId: row.category_id, category: row.category_name,
  unit: row.unit, currentQuantity: quantity(row.current_quantity_milli), minimumQuantity: quantity(row.minimum_quantity_milli),
  purchasePrice: money(row.purchase_price_minor), sellingPrice: money(row.selling_price_minor),
  supplierId: row.supplier_id, supplier: row.supplier_name, active: Boolean(row.is_active),
  status: row.current_quantity_milli === 0 ? 'OUT_OF_STOCK' : row.current_quantity_milli <= row.minimum_quantity_milli ? 'LOW_STOCK' : 'NORMAL',
  createdAt: row.created_at, updatedAt: row.updated_at, demo: Boolean(row.is_demo),
});
const getOrCreateNamed = (table, name) => {
  const cleaned = String(name || '').trim();
  if (!cleaned) return null;
  if (!['InventoryCategories', 'Suppliers'].includes(table)) throw new Error('Unsupported lookup table.');
  db.prepare(`INSERT INTO ${table} (name) VALUES (?) ON CONFLICT(name) DO NOTHING`).run(cleaned);
  return db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(cleaned).id;
};
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: process.env.LENSOS_TIME_ZONE || 'Europe/Sarajevo' }).format(new Date());
const validDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
};
const localDateTime = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: process.env.LENSOS_TIME_ZONE || 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).format(new Date()).replace(' ', 'T');

export const listInventory = (req, res) => {
  const { search = '', categoryId, lowStock, sort = 'name', direction = 'asc' } = req.query;
  const allowedSort = { name: 'i.name COLLATE NOCASE', category: 'c.name COLLATE NOCASE', quantity: 'i.current_quantity_milli', price: 'i.purchase_price_minor', status: 'i.is_active' };
  const orderBy = allowedSort[sort] || allowedSort.name;
  const conditions = ['i.name LIKE ?'];
  const params = [`%${String(search).slice(0, 100)}%`];
  if (categoryId) { conditions.push('i.category_id = ?'); params.push(Number(categoryId)); }
  if (lowStock === 'true') conditions.push('i.current_quantity_milli <= i.minimum_quantity_milli');
  try {
    const items = db.prepare(`${itemSelect} WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} ${direction === 'desc' ? 'DESC' : 'ASC'}, i.id`).all(...params);
    const categories = db.prepare('SELECT id, name FROM InventoryCategories ORDER BY name COLLATE NOCASE').all();
    const suppliers = db.prepare('SELECT id, name FROM Suppliers WHERE is_active=1 ORDER BY name COLLATE NOCASE').all();
    res.json({ success: true, data: items.map(publicItem), categories, suppliers });
  } catch { fail(res, 500, 'Could not load inventory.'); }
};

export const getInventoryItem = (req, res) => {
  const row = db.prepare(`${itemSelect} WHERE i.id=?`).get(req.params.id);
  if (!row) return fail(res, 404, 'Inventory item not found.');
  res.json({ success: true, data: publicItem(row) });
};

export const createInventoryItem = (req, res) => {
  const { name, category, categoryId, unit, minimumQuantity = 0, purchasePrice = '0', sellingPrice = '0', supplier, supplierId } = req.body;
  if (!String(name || '').trim()) return fail(res, 400, 'Item name is required.');
  if (!units.has(unit)) return fail(res, 400, 'Choose a supported unit.');
  try {
    const minimum = quantityMilli(minimumQuantity, 'Minimum quantity', { allowZero: true });
    const cost = moneyMinor(purchasePrice, 'Purchase price');
    const salePrice = moneyMinor(sellingPrice, 'Selling price');
    const categoryKey = categoryId ? Number(categoryId) : getOrCreateNamed('InventoryCategories', category);
    const supplierKey = supplierId ? Number(supplierId) : getOrCreateNamed('Suppliers', supplier);
    if (categoryKey && !db.prepare('SELECT id FROM InventoryCategories WHERE id=?').get(categoryKey)) return fail(res, 400, 'Category not found.');
    if (supplierKey && !db.prepare('SELECT id FROM Suppliers WHERE id=?').get(supplierKey)) return fail(res, 400, 'Supplier not found.');
    const result = db.prepare(`INSERT INTO InventoryItems(name,category_id,unit,minimum_quantity_milli,purchase_price_minor,selling_price_minor,supplier_id)
      VALUES(?,?,?,?,?,?,?)`).run(String(name).trim(), categoryKey || null, unit, minimum, cost, salePrice, supplierKey || null);
    res.status(201).json({ success: true, data: publicItem(db.prepare(`${itemSelect} WHERE i.id=?`).get(result.lastInsertRowid)) });
  } catch (error) { fail(res, 400, error.message); }
};

export const updateInventoryItem = (req, res) => {
  const existing = db.prepare('SELECT * FROM InventoryItems WHERE id=?').get(req.params.id);
  if (!existing) return fail(res, 404, 'Inventory item not found.');
  const body = req.body;
  const name = body.name === undefined ? existing.name : String(body.name).trim();
  const unit = body.unit === undefined ? existing.unit : body.unit;
  if (!name) return fail(res, 400, 'Item name is required.');
  if (!units.has(unit)) return fail(res, 400, 'Choose a supported unit.');
  try {
    const minimum = body.minimumQuantity === undefined ? existing.minimum_quantity_milli : quantityMilli(body.minimumQuantity, 'Minimum quantity', { allowZero: true });
    const cost = body.purchasePrice === undefined ? existing.purchase_price_minor : moneyMinor(body.purchasePrice, 'Purchase price');
    const salePrice = body.sellingPrice === undefined ? existing.selling_price_minor : moneyMinor(body.sellingPrice, 'Selling price');
    const categoryKey = body.categoryId !== undefined ? (body.categoryId ? Number(body.categoryId) : null) : body.category !== undefined ? getOrCreateNamed('InventoryCategories', body.category) : existing.category_id;
    const supplierKey = body.supplierId !== undefined ? (body.supplierId ? Number(body.supplierId) : null) : body.supplier !== undefined ? getOrCreateNamed('Suppliers', body.supplier) : existing.supplier_id;
    db.prepare(`UPDATE InventoryItems SET name=?,category_id=?,unit=?,minimum_quantity_milli=?,purchase_price_minor=?,selling_price_minor=?,supplier_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name, categoryKey, unit, minimum, cost, salePrice, supplierKey, req.params.id);
    res.json({ success: true, data: publicItem(db.prepare(`${itemSelect} WHERE i.id=?`).get(req.params.id)) });
  } catch (error) { fail(res, 400, error.message); }
};

export const updateInventoryStatus = (req, res) => {
  const active = req.body.active;
  if (typeof active !== 'boolean') return fail(res, 400, 'Active must be true or false.');
  const result = db.prepare('UPDATE InventoryItems SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(active ? 1 : 0, req.params.id);
  if (!result.changes) return fail(res, 404, 'Inventory item not found.');
  res.json({ success: true });
};

export const adjustInventory = (req, res) => {
  const { quantity: delta, type = 'MANUAL_ADJUSTMENT', note } = req.body;
  if (!['MANUAL_ADJUSTMENT', 'WASTE', 'RETURN'].includes(type)) return fail(res, 400, 'Invalid adjustment type.');
  if (!String(note || '').trim()) return fail(res, 400, 'A reason is required for a stock adjustment.');
  let deltaMilli;
  try { deltaMilli = quantityMilli(delta, 'Adjustment', { signed: true }); } catch (error) { return fail(res, 400, error.message); }
  if (type === 'WASTE' && deltaMilli > 0) return fail(res, 400, 'Waste quantity must reduce stock.');
  if (type === 'RETURN' && deltaMilli < 0) return fail(res, 400, 'Return quantity must add stock.');
  const transaction = db.transaction(() => {
    const item = db.prepare('SELECT * FROM InventoryItems WHERE id=?').get(req.params.id);
    if (!item) throw Object.assign(new Error('Inventory item not found.'), { status: 404 });
    const next = item.current_quantity_milli + deltaMilli;
    if (next < 0) throw Object.assign(new Error(`Insufficient stock. Available: ${quantity(item.current_quantity_milli)}.`), { status: 409 });
    db.prepare('UPDATE InventoryItems SET current_quantity_milli=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(next, item.id);
    db.prepare(`INSERT INTO InventoryMovements(inventory_item_id,movement_type,quantity_milli,previous_quantity_milli,new_quantity_milli,note,created_by)
      VALUES(?,?,?,?,?,?,?)`).run(item.id, type, deltaMilli, item.current_quantity_milli, next, String(note).trim(), req.user.id);
    return next;
  });
  try { const next = transaction(); res.json({ success: true, data: { currentQuantity: quantity(next) } }); }
  catch (error) { fail(res, error.status || 400, error.message); }
};

export const listMovements = (req, res) => {
  if (!db.prepare('SELECT id FROM InventoryItems WHERE id=?').get(req.params.id)) return fail(res, 404, 'Inventory item not found.');
  const rows = db.prepare(`SELECT m.*, u.username AS created_by_name FROM InventoryMovements m
    LEFT JOIN Users u ON u.id=m.created_by WHERE m.inventory_item_id=? ORDER BY m.created_at DESC,m.id DESC`).all(req.params.id);
  res.json({ success: true, data: rows.map((row) => ({ id: row.id, type: row.movement_type, quantity: quantity(row.quantity_milli),
    previousQuantity: quantity(row.previous_quantity_milli), newQuantity: quantity(row.new_quantity_milli),
    unitCost: row.unit_cost_minor == null ? null : money(row.unit_cost_minor), referenceType: row.reference_type,
    referenceId: row.reference_id, note: row.note, createdBy: row.created_by_name, createdAt: row.created_at })) });
};

export const listPurchases = (req, res) => {
  const rows = db.prepare(`SELECT p.*, s.name AS supplier_name, u.username AS created_by_name FROM Purchases p
    LEFT JOIN Suppliers s ON s.id=p.supplier_id LEFT JOIN Users u ON u.id=p.created_by
    ORDER BY p.purchase_date DESC,p.id DESC`).all();
  const data = rows.map((row) => ({ ...row, totalCost: money(row.total_cost_minor), items: db.prepare(`SELECT pi.*,i.name AS item_name,i.unit FROM PurchaseItems pi JOIN InventoryItems i ON i.id=pi.inventory_item_id WHERE pi.purchase_id=?`).all(row.id).map((item) => ({ id: item.inventory_item_id, name: item.item_name, unit: item.unit, quantity: quantity(item.quantity_milli), unitCost: money(item.unit_cost_minor), totalCost: money(item.total_cost_minor) })) }));
  res.json({ success: true, data });
};

export const getPurchase = (req, res) => {
  const row = db.prepare(`SELECT p.*,s.name AS supplier_name,u.username AS created_by_name FROM Purchases p LEFT JOIN Suppliers s ON s.id=p.supplier_id LEFT JOIN Users u ON u.id=p.created_by WHERE p.id=?`).get(req.params.id);
  if (!row) return fail(res, 404, 'Purchase not found.');
  const items = db.prepare(`SELECT pi.*,i.name AS item_name,i.unit FROM PurchaseItems pi JOIN InventoryItems i ON i.id=pi.inventory_item_id WHERE pi.purchase_id=?`).all(row.id)
    .map((item) => ({ inventoryItemId: item.inventory_item_id, name: item.item_name, unit: item.unit, quantity: quantity(item.quantity_milli), unitCost: money(item.unit_cost_minor), totalCost: money(item.total_cost_minor) }));
  res.json({ success: true, data: { id: row.id, supplier: row.supplier_name, purchaseDate: row.purchase_date, note: row.note, totalCost: money(row.total_cost_minor), createdBy: row.created_by_name, items } });
};

export const createPurchase = (req, res) => {
  const { supplier, supplierId, purchaseDate, note, items } = req.body;
  if (!validDate(purchaseDate)) return fail(res, 400, 'Purchase date must use YYYY-MM-DD.');
  if (!Array.isArray(items) || !items.length) return fail(res, 400, 'Add at least one purchase item.');
  try {
    const entries = items.map((entry) => ({ id: Number(entry.inventoryItemId), amount: quantityMilli(entry.quantity), cost: moneyMinor(entry.unitCost, 'Unit cost') }));
    const save = db.transaction(() => {
      const key = supplierId ? Number(supplierId) : getOrCreateNamed('Suppliers', supplier);
      const purchase = db.prepare('INSERT INTO Purchases(supplier_id,purchase_date,note,created_by) VALUES(?,?,?,?)').run(key || null, purchaseDate, note?.trim() || null, req.user.id);
      let total = 0;
      for (const entry of entries) {
        const item = db.prepare('SELECT * FROM InventoryItems WHERE id=? AND is_active=1').get(entry.id);
        if (!item) throw Object.assign(new Error(`Active inventory item ${entry.id} not found.`), { status: 400 });
        const next = item.current_quantity_milli + entry.amount;
        const lineTotal = Math.round(entry.amount * entry.cost / 1000);
        total += lineTotal;
        db.prepare('UPDATE InventoryItems SET current_quantity_milli=?,purchase_price_minor=?,supplier_id=COALESCE(?,supplier_id),updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .run(next, entry.cost, key || null, item.id);
        db.prepare('INSERT INTO PurchaseItems(purchase_id,inventory_item_id,quantity_milli,unit_cost_minor,total_cost_minor) VALUES(?,?,?,?,?)')
          .run(purchase.lastInsertRowid, item.id, entry.amount, entry.cost, lineTotal);
        db.prepare(`INSERT INTO InventoryMovements(inventory_item_id,movement_type,quantity_milli,previous_quantity_milli,new_quantity_milli,unit_cost_minor,reference_type,reference_id,note,created_by)
          VALUES(?,'PURCHASE',?,?,?,?, 'PURCHASE',?,?,?)`).run(item.id, entry.amount, item.current_quantity_milli, next, entry.cost, purchase.lastInsertRowid, note?.trim() || null, req.user.id);
      }
      db.prepare('UPDATE Purchases SET total_cost_minor=? WHERE id=?').run(total, purchase.lastInsertRowid);
      return purchase.lastInsertRowid;
    });
    const id = save();
    res.status(201).json({ success: true, data: { id } });
  } catch (error) { fail(res, error.status || 400, error.message); }
};

export const listSales = (req, res) => {
  const from = validDate(req.query.from) ? req.query.from : dateToday();
  const to = validDate(req.query.to) ? req.query.to : from;
  const rows = db.prepare(`SELECT s.*,u.username AS created_by_name FROM Sales s LEFT JOIN Users u ON u.id=s.created_by
    WHERE substr(s.sold_at,1,10) BETWEEN ? AND ? ORDER BY s.sold_at DESC,s.id DESC`).all(from, to);
  res.json({ success: true, data: rows.map((row) => ({ id: row.id, soldAt: row.sold_at, total: money(row.total_revenue_minor), createdBy: row.created_by_name, note: row.note, demo: Boolean(row.is_demo),
    items: db.prepare('SELECT * FROM SaleItems WHERE sale_id=?').all(row.id).map((item) => ({ inventoryItemId: item.inventory_item_id, productName: item.product_name_snapshot, quantity: quantity(item.quantity_milli), sellingPrice: money(item.selling_price_minor), total: money(item.total_minor) })) })) });
};

export const getSale = (req, res) => {
  const row = db.prepare('SELECT * FROM Sales WHERE id=?').get(req.params.id);
  if (!row) return fail(res, 404, 'Sale not found.');
  const items = db.prepare('SELECT * FROM SaleItems WHERE sale_id=?').all(row.id).map((item) => ({ inventoryItemId: item.inventory_item_id, productName: item.product_name_snapshot, quantity: quantity(item.quantity_milli), sellingPrice: money(item.selling_price_minor), total: money(item.total_minor) }));
  res.json({ success: true, data: { id: row.id, soldAt: row.sold_at, total: money(row.total_revenue_minor), items } });
};

export const createSale = (req, res) => {
  const { items, note } = req.body;
  if (!Array.isArray(items) || !items.length) return fail(res, 400, 'Add at least one sale item.');
  let entries;
  try { entries = items.map((entry) => ({ id: Number(entry.inventoryItemId), amount: quantityMilli(entry.quantity), price: entry.sellingPrice == null ? null : moneyMinor(entry.sellingPrice, 'Selling price') })); }
  catch (error) { return fail(res, 400, error.message); }
  const save = db.transaction(() => {
    const sale = db.prepare('INSERT INTO Sales(sold_at,note,created_by) VALUES(?,?,?)').run(localDateTime(), note?.trim() || null, req.user.id);
    let total = 0;
    for (const entry of entries) {
      const item = db.prepare('SELECT * FROM InventoryItems WHERE id=? AND is_active=1').get(entry.id);
      if (!item) throw Object.assign(new Error(`Active inventory item ${entry.id} not found.`), { status: 400 });
      if (entry.amount > item.current_quantity_milli) throw Object.assign(new Error(`Insufficient stock for ${item.name}. Available: ${quantity(item.current_quantity_milli)} ${item.unit}.`), { status: 409 });
      const price = entry.price ?? item.selling_price_minor;
      const lineTotal = Math.round(entry.amount * price / 1000);
      const next = item.current_quantity_milli - entry.amount;
      total += lineTotal;
      db.prepare('UPDATE InventoryItems SET current_quantity_milli=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(next, item.id);
      db.prepare('INSERT INTO SaleItems(sale_id,inventory_item_id,product_name_snapshot,quantity_milli,selling_price_minor,total_minor) VALUES(?,?,?,?,?,?)')
        .run(sale.lastInsertRowid, item.id, item.name, entry.amount, price, lineTotal);
      db.prepare(`INSERT INTO InventoryMovements(inventory_item_id,movement_type,quantity_milli,previous_quantity_milli,new_quantity_milli,unit_cost_minor,reference_type,reference_id,note,created_by)
        VALUES(?,'SALE',?,?,?,?, 'SALE',?,?,?)`).run(item.id, -entry.amount, item.current_quantity_milli, next, item.purchase_price_minor, sale.lastInsertRowid, note?.trim() || null, req.user.id);
    }
    db.prepare('UPDATE Sales SET total_revenue_minor=? WHERE id=?').run(total, sale.lastInsertRowid);
    return sale.lastInsertRowid;
  });
  try { const id = save(); res.status(201).json({ success: true, data: { id } }); }
  catch (error) { fail(res, error.status || 400, error.message); }
};

export const dashboardSummary = (req, res) => {
  const date = validDate(req.query.date) ? req.query.date : dateToday();
  const revenue = db.prepare('SELECT COALESCE(SUM(total_revenue_minor),0) AS amount FROM Sales WHERE substr(sold_at,1,10)=?').get(date).amount;
  const itemsSold = db.prepare('SELECT COALESCE(SUM(si.quantity_milli),0) AS amount FROM SaleItems si JOIN Sales s ON s.id=si.sale_id WHERE substr(s.sold_at,1,10)=?').get(date).amount;
  const topProducts = db.prepare(`SELECT product_name_snapshot AS name,SUM(quantity_milli) AS quantity,SUM(total_minor) AS revenue_minor FROM SaleItems si JOIN Sales s ON s.id=si.sale_id WHERE substr(s.sold_at,1,10)=? GROUP BY product_name_snapshot ORDER BY quantity DESC LIMIT 5`).all(date);
  const inventoryCount = db.prepare('SELECT COUNT(*) AS count FROM InventoryItems WHERE is_active=1').get().count;
  const lowStock = db.prepare(`${itemSelect} WHERE i.is_active=1 AND i.current_quantity_milli>0 AND i.current_quantity_milli<=i.minimum_quantity_milli ORDER BY i.current_quantity_milli ASC LIMIT 8`).all();
  const outOfStock = db.prepare(`${itemSelect} WHERE i.is_active=1 AND i.current_quantity_milli=0 ORDER BY i.name COLLATE NOCASE`).all();
  res.json({ success: true, data: { date, currency: 'BAM', todayRevenue: money(revenue), itemsSold: quantity(itemsSold), inventoryItems: inventoryCount,
    lowStockCount: db.prepare('SELECT COUNT(*) AS count FROM InventoryItems WHERE is_active=1 AND current_quantity_milli>0 AND current_quantity_milli<=minimum_quantity_milli').get().count,
    outOfStockCount: outOfStock.length, topProducts: topProducts.map((row) => ({ name: row.name, quantity: quantity(row.quantity), revenue: money(row.revenue_minor) })),
    lowStock: lowStock.map(publicItem), outOfStock: outOfStock.map(publicItem) } });
};

export const listCategories = (_req, res) => res.json({ success: true, data: db.prepare('SELECT id,name FROM InventoryCategories ORDER BY name COLLATE NOCASE').all() });
