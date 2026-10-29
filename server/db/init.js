import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import process from 'node:process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure db directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite Database
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : process.env.LENSOS_DATABASE_PATH || path.join(dbDir, 'quattrodrive.db');
const db = new Database(dbPath, { verbose: process.env.LENSOS_SQL_TRACE === '1' ? console.log : undefined });
db.pragma('foreign_keys = ON');

// Create Tables if they don't exist
const initDb = () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createCandidatesTable = `
    CREATE TABLE IF NOT EXISTS Candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      dob DATE NOT NULL,
      personal_id_number TEXT UNIQUE NOT NULL,
      address TEXT,
      phone_number TEXT,
      email TEXT,
      license_category TEXT NOT NULL,
      status TEXT DEFAULT 'In Progress',
      theory_test_passed BOOLEAN DEFAULT 0,
      practical_test_passed BOOLEAN DEFAULT 0,
      total_course_fee REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createPaymentsTable = `
    CREATE TABLE IF NOT EXISTS Payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date DATE NOT NULL,
      payment_method TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES Candidates (id) ON DELETE CASCADE
    );
  `;

  const createLessonsTable = `
    CREATE TABLE IF NOT EXISTS Lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL,
      lesson_date DATE NOT NULL,
      instructor_name TEXT NOT NULL,
      duration_hours REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES Candidates (id) ON DELETE CASCADE
    );
  `;

  db.exec(createUsersTable);
  db.exec(createCandidatesTable);
  db.exec(createPaymentsTable);
  db.exec(createLessonsTable);

  // Versioned, additive LensOS migration: existing QuattroDrive records are untouched.
  db.exec('CREATE TABLE IF NOT EXISTS SchemaMigrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const lensOsPhaseOneApplied = db.prepare('SELECT version FROM SchemaMigrations WHERE version = 1').get();
  if (!lensOsPhaseOneApplied) {
    const applyLensOSMigration = db.transaction(() => {
      db.exec(`
    CREATE TABLE IF NOT EXISTS InventoryCategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS Suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS InventoryItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER REFERENCES InventoryCategories(id) ON DELETE SET NULL,
      unit TEXT NOT NULL,
      current_quantity_milli INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity_milli >= 0),
      minimum_quantity_milli INTEGER NOT NULL DEFAULT 0 CHECK (minimum_quantity_milli >= 0),
      purchase_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (purchase_price_minor >= 0),
      selling_price_minor INTEGER NOT NULL DEFAULT 0 CHECK (selling_price_minor >= 0),
      supplier_id INTEGER REFERENCES Suppliers(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON InventoryItems(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON InventoryItems(category_id);
    CREATE TABLE IF NOT EXISTS Purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES Suppliers(id) ON DELETE SET NULL,
      purchase_date TEXT NOT NULL,
      note TEXT,
      total_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_cost_minor >= 0),
      created_by INTEGER REFERENCES Users(id) ON DELETE SET NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS PurchaseItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES Purchases(id) ON DELETE RESTRICT,
      inventory_item_id INTEGER NOT NULL REFERENCES InventoryItems(id) ON DELETE RESTRICT,
      quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
      unit_cost_minor INTEGER NOT NULL CHECK (unit_cost_minor >= 0),
      total_cost_minor INTEGER NOT NULL CHECK (total_cost_minor >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON Purchases(purchase_date);
    CREATE TABLE IF NOT EXISTS Sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total_revenue_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_revenue_minor >= 0),
      created_by INTEGER REFERENCES Users(id) ON DELETE SET NULL,
      note TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS SaleItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES Sales(id) ON DELETE RESTRICT,
      inventory_item_id INTEGER NOT NULL REFERENCES InventoryItems(id) ON DELETE RESTRICT,
      product_name_snapshot TEXT NOT NULL,
      quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
      selling_price_minor INTEGER NOT NULL CHECK (selling_price_minor >= 0),
      total_minor INTEGER NOT NULL CHECK (total_minor >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON Sales(sold_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON SaleItems(inventory_item_id);
    CREATE TABLE IF NOT EXISTS InventoryMovements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER NOT NULL REFERENCES InventoryItems(id) ON DELETE RESTRICT,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('PURCHASE','SALE','MANUAL_ADJUSTMENT','WASTE','RETURN')),
      quantity_milli INTEGER NOT NULL CHECK (quantity_milli != 0),
      previous_quantity_milli INTEGER NOT NULL CHECK (previous_quantity_milli >= 0),
      new_quantity_milli INTEGER NOT NULL CHECK (new_quantity_milli >= 0),
      unit_cost_minor INTEGER CHECK (unit_cost_minor IS NULL OR unit_cost_minor >= 0),
      reference_type TEXT,
      reference_id INTEGER,
      note TEXT,
      created_by INTEGER REFERENCES Users(id) ON DELETE SET NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_movements_item_date ON InventoryMovements(inventory_item_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS UserSessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
      `);

      const userColumns = db.prepare('PRAGMA table_info(Users)').all().map((column) => column.name);
      if (!userColumns.includes('role')) db.exec("ALTER TABLE Users ADD COLUMN role TEXT NOT NULL DEFAULT 'OWNER'");
      if (!userColumns.includes('is_active')) db.exec('ALTER TABLE Users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
      db.prepare('INSERT INTO SchemaMigrations(version) VALUES(1)').run();
    });
    applyLensOSMigration();
  }

  // Disable only the original publicly documented admin/admin123 seed account.
  if (!db.prepare('SELECT version FROM SchemaMigrations WHERE version=2').get()) {
    const legacyAdmin = db.prepare("SELECT id,password_hash FROM Users WHERE username='admin'").get();
    if (legacyAdmin && bcrypt.compareSync('admin123', legacyAdmin.password_hash)) {
      db.prepare('UPDATE Users SET is_active=0 WHERE id=?').run(legacyAdmin.id);
    }
    db.prepare('INSERT INTO SchemaMigrations(version) VALUES(2)').run();
  }
  
  // Migration for lesson_time
  try {
    const tableInfo = db.prepare("PRAGMA table_info(Lessons)").all();
    const hasTimeColumn = tableInfo.some(col => col.name === 'lesson_time');
    if (!hasTimeColumn) {
      db.exec("ALTER TABLE Lessons ADD COLUMN lesson_time TEXT");
      console.log('Added lesson_time column to Lessons table');
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
  
  console.log('Database initialized successfully.');
};

initDb();

export default db;
