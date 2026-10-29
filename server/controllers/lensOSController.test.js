/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../index.js';
import db from '../db/init.js';

describe('LensOS inventory and daily ledger', () => {
  let token;
  let productId;
  const headers = () => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    db.exec(`DELETE FROM InventoryMovements; DELETE FROM SaleItems; DELETE FROM Sales; DELETE FROM PurchaseItems; DELETE FROM Purchases;
      DELETE FROM InventoryItems; DELETE FROM InventoryCategories; DELETE FROM Suppliers; DELETE FROM UserSessions; DELETE FROM Users;`);
    const passwordHash = await bcrypt.hash('test-password', 4);
    db.prepare("INSERT INTO Users(username,password_hash,role,is_active) VALUES('lens-test',?,'OWNER',1)").run(passwordHash);
    const category = db.prepare("INSERT INTO InventoryCategories(name) VALUES('Test category')").run();
    productId = Number(db.prepare(`INSERT INTO InventoryItems(name,category_id,unit,current_quantity_milli,minimum_quantity_milli,purchase_price_minor,selling_price_minor)
      VALUES('Test drink',?,'can',10000,3000,120,200)`).run(category.lastInsertRowid).lastInsertRowid);
    const login = await request(app).post('/api/auth/login').send({ username: 'lens-test', password: 'test-password' });
    token = login.body.token;
  });

  afterEach(() => {
    db.exec(`DELETE FROM InventoryMovements; DELETE FROM SaleItems; DELETE FROM Sales; DELETE FROM PurchaseItems; DELETE FROM Purchases;
      DELETE FROM InventoryItems; DELETE FROM InventoryCategories; DELETE FROM Suppliers; DELETE FROM UserSessions; DELETE FROM Users;`);
  });

  it('adds purchased stock and creates a purchase movement', async () => {
    const result = await request(app).post('/api/purchases').set(headers()).send({ supplier: 'Test supplier', purchaseDate: '2026-10-08', items: [{ inventoryItemId: productId, quantity: '5', unitCost: '1.25' }] });
    expect(result.status).toBe(201);
    expect(db.prepare('SELECT current_quantity_milli FROM InventoryItems WHERE id=?').get(productId).current_quantity_milli).toBe(15000);
    expect(db.prepare("SELECT movement_type,quantity_milli FROM InventoryMovements WHERE reference_type='PURCHASE'").get()).toMatchObject({ movement_type: 'PURCHASE', quantity_milli: 5000 });
  });

  it('records a sale, deducts stock, and creates a sale movement', async () => {
    const result = await request(app).post('/api/sales').set(headers()).send({ items: [{ inventoryItemId: productId, quantity: '2' }] });
    expect(result.status).toBe(201);
    expect(db.prepare('SELECT current_quantity_milli FROM InventoryItems WHERE id=?').get(productId).current_quantity_milli).toBe(8000);
    expect(db.prepare("SELECT movement_type,quantity_milli FROM InventoryMovements WHERE reference_type='SALE'").get()).toMatchObject({ movement_type: 'SALE', quantity_milli: -2000 });
  });

  it('rejects negative stock and rolls back the whole multi-item sale', async () => {
    const second = db.prepare("INSERT INTO InventoryItems(name,unit,current_quantity_milli,selling_price_minor) VALUES('Second','bottle',1000,100)").run();
    const result = await request(app).post('/api/sales').set(headers()).send({ items: [{ inventoryItemId: productId, quantity: '2' }, { inventoryItemId: second.lastInsertRowid, quantity: '2' }] });
    expect(result.status).toBe(409);
    expect(db.prepare('SELECT current_quantity_milli FROM InventoryItems WHERE id=?').get(productId).current_quantity_milli).toBe(10000);
    expect(db.prepare('SELECT COUNT(*) AS n FROM Sales').get().n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM InventoryMovements').get().n).toBe(0);
  });

  it('preserves the historical selling price when the catalog price changes', async () => {
    await request(app).post('/api/sales').set(headers()).send({ items: [{ inventoryItemId: productId, quantity: '1' }] }).expect(201);
    db.prepare('UPDATE InventoryItems SET selling_price_minor=250 WHERE id=?').run(productId);
    const sale = db.prepare('SELECT selling_price_minor,total_minor,product_name_snapshot FROM SaleItems').get();
    expect(sale).toMatchObject({ selling_price_minor: 200, total_minor: 200, product_name_snapshot: 'Test drink' });
  });

  it('detects low-stock and out-of-stock states', async () => {
    db.prepare('UPDATE InventoryItems SET current_quantity_milli=2000 WHERE id=?').run(productId);
    const out = db.prepare("INSERT INTO InventoryItems(name,unit,current_quantity_milli,minimum_quantity_milli) VALUES('Empty','piece',0,1)").run();
    const result = await request(app).get('/api/inventory').set(headers());
    expect(result.status).toBe(200);
    expect(result.body.data.find((item) => item.id === productId).status).toBe('LOW_STOCK');
    expect(result.body.data.find((item) => item.id === out.lastInsertRowid).status).toBe('OUT_OF_STOCK');
  });

  it('shows movement history with before and after quantities', async () => {
    await request(app).post('/api/inventory').set(headers()).send({ name: 'Water', unit: 'bottle', minimumQuantity: '2', purchasePrice: '0.50' }).expect(201);
    const adjustment = await request(app).post(`/api/inventory/${productId}/adjustments`).set(headers()).send({ quantity: '-3', note: 'Damaged stock' });
    expect(adjustment.status, adjustment.body.message).toBe(200);
    const movements = await request(app).get(`/api/inventory/${productId}/movements`).set(headers());
    expect(movements.body.data[0]).toMatchObject({ type: 'MANUAL_ADJUSTMENT', quantity: -3, previousQuantity: 10, newQuantity: 7, note: 'Damaged stock', createdBy: 'lens-test' });
  });

  it('calculates daily dashboard totals from the recorded sales', async () => {
    await request(app).post('/api/sales').set(headers()).send({ items: [{ inventoryItemId: productId, quantity: '2' }] }).expect(201);
    const result = await request(app).get('/api/dashboard/summary').set(headers());
    expect(result.status).toBe(200);
    expect(result.body.data.todayRevenue).toBe('4.00');
    expect(result.body.data.itemsSold).toBe(2);
    expect(result.body.data.topProducts[0]).toMatchObject({ name: 'Test drink', quantity: 2, revenue: '4.00' });
  });

  it('requires authentication for inventory and sales APIs', async () => {
    expect((await request(app).get('/api/inventory')).status).toBe(401);
    expect((await request(app).post('/api/sales').send({ items: [] })).status).toBe(401);
  });
});
