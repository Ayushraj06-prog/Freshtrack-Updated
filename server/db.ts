/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack SQLite Database Engine (Node.js native node:sqlite)
 * WAL journal mode, typed queries, auto-seeding, and persistent storage in data/freshtrack.db.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { sanitizeImageUrl } from './security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbFilePath = path.join(dataDir, 'freshtrack.db');

export const sqliteDb = new DatabaseSync(dbFilePath);

// Enable WAL mode for high performance concurrency
sqliteDb.exec('PRAGMA journal_mode = WAL;');

// Initialize Tables
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    purchaseDate TEXT NOT NULL,
    estimatedExpiryDate TEXT NOT NULL,
    printedExpiryDate TEXT,
    storage TEXT NOT NULL,
    price REAL,
    status TEXT NOT NULL,
    originalQuantity REAL,
    savedMoney REAL DEFAULT 0,
    usedAt TEXT,
    source TEXT NOT NULL,
    barcode TEXT,
    notes TEXT,
    imageUrl TEXT,
    batchCode TEXT,
    supplierName TEXT,
    parLevel REAL,
    branchZone TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// Safe migrations for existing SQLite databases
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN originalQuantity REAL;'); } catch {}
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN savedMoney REAL DEFAULT 0;'); } catch {}
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN batchCode TEXT;'); } catch {}
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN supplierName TEXT;'); } catch {}
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN parLevel REAL;'); } catch {}
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN branchZone TEXT;'); } catch {}

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY,
    operationScale TEXT DEFAULT 'household',
    organizationName TEXT DEFAULT '',
    branchLocation TEXT DEFAULT '',
    wasteBudgetRs REAL DEFAULT 2000,
    scaleConfigured INTEGER DEFAULT 0,
    diet TEXT,
    reminderLeadDays INTEGER,
    morningDigestEnabled INTEGER,
    morningDigestTime TEXT,
    defaultStorage TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    itemName TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    timeMinutes INTEGER,
    servings INTEGER,
    difficulty TEXT,
    diet TEXT,
    cuisine TEXT,
    ingredients TEXT,
    instructions TEXT,
    notes TEXT,
    cookedCount INTEGER DEFAULT 0,
    lastCookedAt TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS restock_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    targetQuantity REAL NOT NULL,
    unit TEXT NOT NULL,
    storage TEXT NOT NULL,
    estimatedPrice REAL,
    supplierName TEXT,
    branchZone TEXT,
    parLevel REAL,
    sourceItemId TEXT,
    reason TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    checked INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS meal_plans (
    id TEXT PRIMARY KEY,
    dayOfWeek TEXT NOT NULL,
    slot TEXT NOT NULL,
    recipeId TEXT,
    recipeTitle TEXT NOT NULL,
    servings INTEGER DEFAULT 2,
    ingredients TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contactName TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    categories TEXT,
    leadTimeDays INTEGER DEFAULT 1,
    paymentTerms TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS storage_logs (
    id TEXT PRIMARY KEY,
    zoneName TEXT NOT NULL,
    zoneType TEXT NOT NULL,
    temperatureC REAL NOT NULL,
    humidityPct REAL,
    status TEXT NOT NULL,
    checkedBy TEXT,
    branchZone TEXT,
    notes TEXT,
    loggedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completedAt TEXT,
    assignedTo TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS waste_logs (
    id TEXT PRIMARY KEY,
    itemId TEXT,
    itemName TEXT NOT NULL,
    category TEXT NOT NULL,
    quantityWasted REAL NOT NULL,
    unit TEXT NOT NULL,
    lossRs REAL DEFAULT 0,
    reason TEXT NOT NULL,
    loggedBy TEXT,
    branchZone TEXT,
    notes TEXT,
    loggedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoiceNumber TEXT NOT NULL,
    supplierName TEXT NOT NULL,
    invoiceDate TEXT NOT NULL,
    dueDate TEXT,
    amountRs REAL NOT NULL,
    category TEXT NOT NULL,
    paymentStatus TEXT DEFAULT 'paid',
    itemsCount INTEGER,
    branchZone TEXT,
    notes TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS auth_config (
    id TEXT PRIMARY KEY,
    passcodeHash TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

// Seed default daily kitchen checks if checklists table is empty
try {
  const chkCount = (sqliteDb.prepare('SELECT COUNT(*) as count FROM checklists').get() as { count: number }).count;
  if (chkCount === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { id: 'chk-1', title: 'Inspect FIFO #1 urgent items expiring within 48 hours', category: 'opening', notes: 'Pull near-expiry stock to front shelf for today prep' },
      { id: 'chk-2', title: 'Log Fridge (0–4°C) and Freezer (≤-18°C) temperatures', category: 'hygiene', notes: 'FSSAI cold-chain safety check' },
      { id: 'chk-3', title: 'Check Par-Level shortages & send vendor / grocery buy list', category: 'opening', notes: 'Verify dairy, greens, and staple levels' },
      { id: 'chk-4', title: 'Label & date all prepped containers and seal dry pantry jars', category: 'closing', notes: 'Print FIFO Use-By stickers before end of day' },
    ];
    const insertChk = sqliteDb.prepare(
      `INSERT INTO checklists (id, title, category, completed, completedAt, assignedTo, notes, createdAt, updatedAt)
       VALUES (@id, @title, @category, 0, NULL, NULL, @notes, @createdAt, @updatedAt)`
    );
    for (const d of defaults) {
      insertChk.run({ ...d, createdAt: now, updatedAt: now });
    }
  }
} catch {}

// Safe migrations for existing preferences tables
try { sqliteDb.exec("ALTER TABLE preferences ADD COLUMN operationScale TEXT DEFAULT 'household';"); } catch {}
try { sqliteDb.exec("ALTER TABLE preferences ADD COLUMN organizationName TEXT DEFAULT '';"); } catch {}
try { sqliteDb.exec("ALTER TABLE preferences ADD COLUMN branchLocation TEXT DEFAULT '';"); } catch {}
try { sqliteDb.exec('ALTER TABLE preferences ADD COLUMN wasteBudgetRs REAL DEFAULT 2000;'); } catch {}
try { sqliteDb.exec('ALTER TABLE preferences ADD COLUMN scaleConfigured INTEGER DEFAULT 0;'); } catch {}

// Seed default data if empty
const countStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM items');
const rowCount = (countStmt.get() as { count: number }).count;
if (rowCount === 0) {
  seedKitchenData();
}

function formatDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function seedKitchenData() {
  const now = new Date().toISOString();
  const sampleItems = [
    {
      id: 'seed-1',
      name: 'Mother Dairy Classic Dahi 400g',
      category: 'Dairy',
      quantity: 400,
      unit: 'g',
      purchaseDate: formatDateOffset(-5),
      estimatedExpiryDate: formatDateOffset(1), // Urgent!
      storage: 'fridge',
      price: 35,
      status: 'active',
      source: 'receipt',
      barcode: '8901030383786',
      imageUrl: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=300&q=80',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-2',
      name: 'Fresh Coriander (Dhaniya)',
      category: 'Leafy Greens',
      quantity: 1,
      unit: 'bunch',
      purchaseDate: formatDateOffset(-3),
      estimatedExpiryDate: formatDateOffset(0), // Expiring Today!
      storage: 'fridge',
      price: 15,
      status: 'active',
      source: 'receipt',
      imageUrl: 'https://images.unsplash.com/photo-1592417817098-8f3d6910985b?w=300&q=80',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-3',
      name: 'Amul Malai Paneer 200g',
      category: 'Dairy',
      quantity: 200,
      unit: 'g',
      purchaseDate: formatDateOffset(-3),
      estimatedExpiryDate: formatDateOffset(2), // Expiring in 2 days!
      storage: 'fridge',
      price: 85,
      status: 'active',
      source: 'barcode',
      barcode: '8901058852332',
      imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=300&q=80',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-4',
      name: 'Britannia 100% Whole Wheat Bread',
      category: 'Bakery & Bread',
      quantity: 1,
      unit: 'pack',
      purchaseDate: formatDateOffset(-2),
      estimatedExpiryDate: formatDateOffset(2), // Expiring in 2 days!
      storage: 'pantry',
      price: 50,
      status: 'active',
      source: 'receipt',
      imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-5',
      name: 'Fresh Hybrid Tomatoes 1kg',
      category: 'Vegetables',
      quantity: 1,
      unit: 'kg',
      purchaseDate: formatDateOffset(-1),
      estimatedExpiryDate: formatDateOffset(5),
      storage: 'fridge',
      price: 38,
      status: 'active',
      source: 'receipt',
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-6',
      name: 'Farm Fresh White Eggs 6pcs',
      category: 'Eggs, Meat & Poultry',
      quantity: 6,
      unit: 'pcs',
      purchaseDate: formatDateOffset(-2),
      estimatedExpiryDate: formatDateOffset(18),
      storage: 'fridge',
      price: 55,
      status: 'active',
      source: 'receipt',
      imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300&q=80',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-7',
      name: 'Aashirvaad Shudh Chakki Atta 5kg',
      category: 'Grains & Flours',
      quantity: 5,
      unit: 'kg',
      purchaseDate: formatDateOffset(-10),
      estimatedExpiryDate: formatDateOffset(110),
      storage: 'pantry',
      price: 245,
      status: 'active',
      source: 'barcode',
      barcode: '8901058849202',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-8',
      name: 'Nashik Red Onions 2kg',
      category: 'Vegetables',
      quantity: 2,
      unit: 'kg',
      purchaseDate: formatDateOffset(-4),
      estimatedExpiryDate: formatDateOffset(17),
      storage: 'pantry',
      price: 70,
      status: 'active',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    // Past Used/Saved items
    {
      id: 'seed-9',
      name: 'Amul Taaza Toned Milk 500ml',
      category: 'Dairy',
      quantity: 500,
      unit: 'ml',
      purchaseDate: formatDateOffset(-6),
      estimatedExpiryDate: formatDateOffset(-3),
      storage: 'fridge',
      price: 27,
      status: 'used',
      usedAt: formatDateOffset(-4),
      source: 'receipt',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-10',
      name: 'Fresh Palak (Spinach) 250g',
      category: 'Leafy Greens',
      quantity: 250,
      unit: 'g',
      purchaseDate: formatDateOffset(-7),
      estimatedExpiryDate: formatDateOffset(-4),
      storage: 'fridge',
      price: 22,
      status: 'used',
      usedAt: formatDateOffset(-5),
      source: 'receipt',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-11',
      name: 'Tata Sampann Toor Dal 1kg',
      category: 'Pulses & Dal',
      quantity: 1,
      unit: 'kg',
      purchaseDate: formatDateOffset(-25),
      estimatedExpiryDate: formatDateOffset(150),
      storage: 'pantry',
      price: 165,
      status: 'used',
      usedAt: formatDateOffset(-2),
      source: 'barcode',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const insert = sqliteDb.prepare(`
    INSERT OR REPLACE INTO items (
      id, name, category, quantity, unit, purchaseDate, estimatedExpiryDate,
      storage, price, status, usedAt, source, barcode, imageUrl, createdAt, updatedAt
    ) VALUES (
      @id, @name, @category, @quantity, @unit, @purchaseDate, @estimatedExpiryDate,
      @storage, @price, @status, @usedAt, @source, @barcode, @imageUrl, @createdAt, @updatedAt
    )
  `);

  for (const item of sampleItems) {
    insert.run({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      purchaseDate: item.purchaseDate,
      estimatedExpiryDate: item.estimatedExpiryDate,
      storage: item.storage,
      price: item.price,
      status: item.status,
      usedAt: item.usedAt || null,
      source: item.source,
      barcode: item.barcode || null,
      imageUrl: item.imageUrl || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  // Seed default preferences only if none exists yet
  sqliteDb.prepare(`
    INSERT OR IGNORE INTO preferences (
      id, operationScale, organizationName, branchLocation, wasteBudgetRs, scaleConfigured,
      diet, reminderLeadDays, morningDigestEnabled, morningDigestTime, defaultStorage, updatedAt
    )
    VALUES ('default', 'household', '', '', 2000, 0, 'veg', 2, 1, '08:30', 'fridge', ?)
  `).run(now);

  // Seed sample custom recipe if none exists
  try {
    const customCountStmt = sqliteDb.prepare('SELECT COUNT(*) as count FROM custom_recipes');
    const customCount = (customCountStmt.get() as { count: number }).count;
    if (customCount === 0) {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO custom_recipes (
          id, title, description, image, timeMinutes, servings, difficulty, diet, cuisine,
          ingredients, instructions, notes, cookedCount, lastCookedAt, createdAt, updatedAt
        ) VALUES (
          @id, @title, @description, @image, @timeMinutes, @servings, @difficulty, @diet, @cuisine,
          @ingredients, @instructions, @notes, @cookedCount, @lastCookedAt, @createdAt, @updatedAt
        )
      `).run({
        id: 'seed-custom-1',
        title: 'Homestyle Dahi Tadka Toast',
        description: 'Crispy pan-toasted bread layered with spiced, tempered curd and fresh coriander garnish.',
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80',
        timeMinutes: 12,
        servings: 2,
        difficulty: 'Quick',
        diet: 'veg',
        cuisine: 'North Indian',
        ingredients: JSON.stringify([
          { itemId: 'seed-1', name: 'Mother Dairy Classic Dahi 400g', portionUsed: 0.25, amountText: '100g' },
          { itemId: 'seed-4', name: 'Britannia 100% Whole Wheat Bread', portionUsed: 0.5, amountText: '2 slices' },
          { itemId: 'seed-2', name: 'Fresh Coriander (Dhaniya)', portionUsed: 0.25, amountText: 'Handful' },
          { name: 'Mustard Seeds & Curry Leaves', isPantryStaple: true, amountText: '1/2 tsp' },
        ]),
        instructions: JSON.stringify([
          'Whisk thick curd with salt, crushed roasted cumin, and black pepper.',
          'Heat ghee or mustard oil in a small tadka pan; sputter mustard seeds and curry leaves.',
          'Toast bread slices on a tawa until golden and crisp.',
          'Spread the seasoned curd over warm toast, pour hot aromatic tadka on top, garnish with coriander, and enjoy immediately!',
        ]),
        notes: 'Family favorite quick evening snack using leftover bread and dahi!',
        cookedCount: 1,
        lastCookedAt: formatDateOffset(-1),
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.warn('Seeding custom recipes deferred:', err);
  }
}

// ---------------- SQLite Public Interface ----------------

export const db = {
  getEngine() {
    return {
      type: 'sqlite',
      version: '3.x (native node:sqlite DatabaseSync)',
      path: 'data/freshtrack.db',
    };
  },

  getAuthConfig(): { passcodeHash: string; updatedAt: string } | null {
    const stmt = sqliteDb.prepare('SELECT passcodeHash, updatedAt FROM auth_config WHERE id = ?');
    const row = stmt.get('default') as { passcodeHash?: string; updatedAt?: string } | undefined;
    if (!row?.passcodeHash) return null;
    return {
      passcodeHash: row.passcodeHash,
      updatedAt: row.updatedAt || new Date().toISOString(),
    };
  },

  setPasscodeHash(passcodeHash: string) {
    const nowIso = new Date().toISOString();
    const stmt = sqliteDb.prepare(`
      INSERT INTO auth_config (id, passcodeHash, updatedAt)
      VALUES ('default', @passcodeHash, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        passcodeHash = excluded.passcodeHash,
        updatedAt = excluded.updatedAt
    `);
    stmt.run({ passcodeHash, updatedAt: nowIso });
    return { updatedAt: nowIso };
  },

  getAllItems() {
    const stmt = sqliteDb.prepare('SELECT * FROM items ORDER BY estimatedExpiryDate ASC');
    return (stmt.all() as any[]).map(mapItem);
  },

  getItemById(id: string) {
    const stmt = sqliteDb.prepare('SELECT * FROM items WHERE id = ?');
    const row = stmt.get(id);
    return row ? mapItem(row) : null;
  },

  insertItem(item: any) {
    const nowIso = new Date().toISOString();
    const qty = Number(item.quantity) || 1;
    const prepared = {
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: item.name,
      category: item.category,
      quantity: qty,
      unit: item.unit || 'pack',
      purchaseDate: item.purchaseDate || nowIso.split('T')[0],
      estimatedExpiryDate: item.estimatedExpiryDate,
      printedExpiryDate: item.printedExpiryDate ?? null,
      storage: item.storage || 'fridge',
      price: item.price !== null && item.price !== undefined && !isNaN(item.price) ? Number(item.price) : null,
      status: item.status || 'active',
      originalQuantity: item.originalQuantity ? Number(item.originalQuantity) : qty,
      savedMoney: item.savedMoney ? Number(item.savedMoney) : 0,
      usedAt: item.usedAt ?? null,
      source: item.source || 'manual',
      barcode: item.barcode ?? null,
      notes: item.notes ?? null,
      imageUrl: sanitizeImageUrl(item.imageUrl),
      batchCode: item.batchCode ?? null,
      supplierName: item.supplierName ?? null,
      parLevel: item.parLevel !== null && item.parLevel !== undefined && !isNaN(Number(item.parLevel)) ? Number(item.parLevel) : null,
      branchZone: item.branchZone ?? null,
      createdAt: item.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO items (
        id, name, category, quantity, unit, purchaseDate, estimatedExpiryDate,
        printedExpiryDate, storage, price, status, originalQuantity, savedMoney, usedAt, source, barcode, notes, imageUrl,
        batchCode, supplierName, parLevel, branchZone, createdAt, updatedAt
      ) VALUES (
        @id, @name, @category, @quantity, @unit, @purchaseDate, @estimatedExpiryDate,
        @printedExpiryDate, @storage, @price, @status, @originalQuantity, @savedMoney, @usedAt, @source, @barcode, @notes, @imageUrl,
        @batchCode, @supplierName, @parLevel, @branchZone, @createdAt, @updatedAt
      )
    `);
    stmt.run(prepared);
    if (!item.id) {
      this.logActivity('added', prepared.name, `Added ${prepared.quantity} ${prepared.unit} to ${prepared.storage}`);
    }
    return prepared;
  },

  insertItems(items: any[]) {
    return items.map((item) => this.insertItem(item));
  },

  updateItem(id: string, updates: any) {
    const existing = this.getItemById(id);
    if (!existing) return null;

    const rawPar = updates.parLevel !== undefined ? updates.parLevel : existing.parLevel;
    const normalizedPar = rawPar !== null && rawPar !== undefined && !isNaN(Number(rawPar)) ? Number(rawPar) : null;

    const merged = {
      id,
      name: updates.name ?? existing.name,
      category: updates.category ?? existing.category,
      quantity: updates.quantity !== undefined ? Number(updates.quantity) : Number(existing.quantity),
      unit: updates.unit ?? existing.unit,
      purchaseDate: updates.purchaseDate ?? existing.purchaseDate,
      estimatedExpiryDate: updates.estimatedExpiryDate ?? existing.estimatedExpiryDate,
      printedExpiryDate: (updates.printedExpiryDate !== undefined ? updates.printedExpiryDate : existing.printedExpiryDate) ?? null,
      storage: updates.storage ?? existing.storage,
      price: (updates.price !== undefined ? updates.price : existing.price) ?? null,
      status: updates.status ?? existing.status,
      originalQuantity: (updates.originalQuantity !== undefined ? updates.originalQuantity : existing.originalQuantity) ?? null,
      savedMoney: (updates.savedMoney !== undefined ? updates.savedMoney : existing.savedMoney) ?? 0,
      usedAt: (updates.usedAt !== undefined ? updates.usedAt : existing.usedAt) ?? null,
      source: updates.source ?? existing.source,
      barcode: (updates.barcode !== undefined ? updates.barcode : existing.barcode) ?? null,
      notes: (updates.notes !== undefined ? updates.notes : existing.notes) ?? null,
      imageUrl: sanitizeImageUrl(updates.imageUrl !== undefined ? updates.imageUrl : existing.imageUrl),
      batchCode: (updates.batchCode !== undefined ? updates.batchCode : existing.batchCode) ?? null,
      supplierName: (updates.supplierName !== undefined ? updates.supplierName : existing.supplierName) ?? null,
      parLevel: normalizedPar,
      branchZone: (updates.branchZone !== undefined ? updates.branchZone : existing.branchZone) ?? null,
      updatedAt: new Date().toISOString(),
    };

    const stmt = sqliteDb.prepare(`
      UPDATE items SET
        name = @name,
        category = @category,
        quantity = @quantity,
        unit = @unit,
        purchaseDate = @purchaseDate,
        estimatedExpiryDate = @estimatedExpiryDate,
        printedExpiryDate = @printedExpiryDate,
        storage = @storage,
        price = @price,
        status = @status,
        originalQuantity = @originalQuantity,
        savedMoney = @savedMoney,
        usedAt = @usedAt,
        source = @source,
        barcode = @barcode,
        notes = @notes,
        imageUrl = @imageUrl,
        batchCode = @batchCode,
        supplierName = @supplierName,
        parLevel = @parLevel,
        branchZone = @branchZone,
        updatedAt = @updatedAt
      WHERE id = @id
    `);
    stmt.run(merged);
    return merged;
  },

  deleteItem(id: string) {
    const stmt = sqliteDb.prepare('DELETE FROM items WHERE id = ?');
    stmt.run(id);
    return true;
  },

  markItemUsed(id: string, options?: { portion?: number; usedQuantity?: number; usedPortionName?: string }) {
    const existing = this.getItemById(id);
    if (!existing) return null;

    const origQty = Number(existing.originalQuantity) || Number(existing.quantity) || 1;
    const currQty = Number(existing.quantity) || 1;
    const nowIso = new Date().toISOString();

    let portionFraction = 1.0;
    let qtyUsed = currQty;

    if (options && typeof options.portion === 'number' && options.portion > 0 && options.portion <= 1.0) {
      portionFraction = options.portion;
      qtyUsed = Math.min(currQty, Number((currQty * portionFraction).toFixed(2)));
    } else if (options && typeof options.usedQuantity === 'number' && options.usedQuantity > 0) {
      qtyUsed = Math.min(currQty, options.usedQuantity);
      portionFraction = currQty > 0 ? (qtyUsed / currQty) : 1.0;
    }

    const remainingQty = Math.max(0, Number((currQty - qtyUsed).toFixed(2)));
    const portionRatioOfTotal = origQty > 0 ? (qtyUsed / origQty) : portionFraction;
    const moneySavedFromThisPortion = existing.price ? Math.round(existing.price * portionRatioOfTotal) : 0;
    const newSavedMoney = (Number(existing.savedMoney) || 0) + moneySavedFromThisPortion;

    const portionLabel = options?.usedPortionName || (portionFraction >= 1 ? 'Finished 100%' : `Used ${Math.round(portionFraction * 100)}% (${qtyUsed} ${existing.unit})`);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const usageNote = `[${dateStr}] ${portionLabel} (Saved ₹${moneySavedFromThisPortion})`;
    const updatedNotes = existing.notes ? `${existing.notes} • ${usageNote}` : usageNote;

    if (remainingQty <= 0 || portionFraction >= 0.98) {
      // Finished completely
      const finished = this.updateItem(id, {
        status: 'used',
        quantity: 0,
        originalQuantity: origQty,
        savedMoney: newSavedMoney > 0 ? newSavedMoney : (existing.price || 0),
        usedAt: nowIso,
        notes: updatedNotes,
      });

      // For restaurant & enterprise, automatically add finished item to Need-to-Buy restock queue if not already pending
      try {
        const prefs = this.getPreferences();
        if (prefs.operationScale !== 'household') {
          const existingPending = sqliteDb
            .prepare("SELECT id FROM restock_list WHERE status = 'pending' AND LOWER(name) = LOWER(?)")
            .get(existing.name) as any;
          if (!existingPending) {
            this.saveRestockItem({
              name: existing.name,
              category: existing.category,
              targetQuantity: origQty,
              unit: existing.unit,
              storage: existing.storage,
              estimatedPrice: existing.price,
              supplierName: existing.supplierName ?? null,
              branchZone: existing.branchZone ?? (prefs.branchLocation || null),
              parLevel: existing.parLevel ?? null,
              sourceItemId: existing.id,
              reason: 'completed',
              priority: existing.parLevel !== null && existing.parLevel !== undefined ? 'urgent' : 'normal',
              checked: false,
              status: 'pending',
            });
          }
        }
      } catch (err) {
        console.warn('Auto-queue restock skipped:', err);
      }

      this.logActivity('used', existing.name, `${portionLabel} (100% depleted)`);
      return finished;
    } else {
      // Partially used - remains active with updated quantity!
      this.logActivity('used', existing.name, `${portionLabel} (${remainingQty} ${existing.unit} left)`);
      return this.updateItem(id, {
        status: 'active',
        quantity: remainingQty,
        originalQuantity: origQty,
        savedMoney: newSavedMoney,
        notes: updatedNotes,
      });
    }
  },

  markItemsUsed(ids: string[]) {
    return ids.map((id) => this.markItemUsed(id, { portion: 1.0, usedPortionName: 'Finished 100%' })).filter(Boolean);
  },

  markItemExpired(id: string) {
    const existing = this.getItemById(id);
    if (!existing) return null;
    const updated = this.updateItem(id, {
      status: 'expired',
      updatedAt: new Date().toISOString(),
    });
    this.logActivity(
      'expired',
      existing.name,
      `Marked spoiled/wasted (${existing.quantity} ${existing.unit}${existing.price ? `, ₹${existing.price} loss` : ''})`
    );
    return updated;
  },

  markItemsExpired(ids: string[]) {
    return ids.map((id) => this.markItemExpired(id)).filter(Boolean);
  },

  freezeAndExtendItem(id: string) {
    const existing = this.getItemById(id);
    if (!existing) return null;

    const freezerDays = defaultShelfLifeDays(existing.category, 'freezer');
    const extendedDate = formatDateOffset(freezerDays);
    const nextExpiry =
      extendedDate > existing.estimatedExpiryDate ? extendedDate : existing.estimatedExpiryDate;
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const freezeNote = `[${dateStr}] Frozen & extended expiry to ${nextExpiry}`;
    const updatedNotes = existing.notes ? `${existing.notes} • ${freezeNote}` : freezeNote;

    const updated = this.updateItem(id, {
      storage: 'freezer',
      estimatedExpiryDate: nextExpiry,
      notes: updatedNotes,
    });
    this.logActivity('frozen', existing.name, `Moved to Freezer • extended to ${nextExpiry}`);
    return updated;
  },

  markItemsFrozen(ids: string[]) {
    return ids.map((id) => this.freezeAndExtendItem(id)).filter(Boolean);
  },

  clearAllItems() {
    sqliteDb.exec('DELETE FROM items;');
    this.logActivity('cleared', 'All Inventory', 'Database items cleared');
    return true;
  },

  // Preferences
  getPreferences() {
    const defaults = {
      operationScale: 'household',
      organizationName: '',
      branchLocation: '',
      wasteBudgetRs: 2000,
      scaleConfigured: false,
      diet: 'veg',
      reminderLeadDays: 2,
      morningDigestEnabled: true,
      morningDigestTime: '08:30',
      defaultStorage: 'fridge',
    };

    const stmt = sqliteDb.prepare("SELECT * FROM preferences WHERE id = 'default'");
    const row = stmt.get() as any;
    if (!row) return defaults;
    return {
      operationScale: row.operationScale || 'household',
      organizationName: row.organizationName || '',
      branchLocation: row.branchLocation || '',
      wasteBudgetRs: row.wasteBudgetRs !== null && row.wasteBudgetRs !== undefined ? Number(row.wasteBudgetRs) : 2000,
      scaleConfigured: Boolean(row.scaleConfigured),
      diet: row.diet || 'veg',
      reminderLeadDays: row.reminderLeadDays || 2,
      morningDigestEnabled: Boolean(row.morningDigestEnabled),
      morningDigestTime: row.morningDigestTime || '08:30',
      defaultStorage: row.defaultStorage || 'fridge',
    };
  },

  updatePreferences(updates: any) {
    const current = this.getPreferences();
    const merged = { ...current, ...updates };

    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO preferences (
        id, operationScale, organizationName, branchLocation, wasteBudgetRs, scaleConfigured,
        diet, reminderLeadDays, morningDigestEnabled, morningDigestTime, defaultStorage, updatedAt
      ) VALUES (
        'default', @operationScale, @organizationName, @branchLocation, @wasteBudgetRs, @scaleConfigured,
        @diet, @reminderLeadDays, @morningDigestEnabled, @morningDigestTime, @defaultStorage, @updatedAt
      )
    `);
    stmt.run({
      operationScale: merged.operationScale || 'household',
      organizationName: merged.organizationName ?? '',
      branchLocation: merged.branchLocation ?? '',
      wasteBudgetRs: merged.wasteBudgetRs !== undefined && !isNaN(Number(merged.wasteBudgetRs)) ? Number(merged.wasteBudgetRs) : 2000,
      scaleConfigured: merged.scaleConfigured ? 1 : 0,
      diet: merged.diet || 'veg',
      reminderLeadDays: Number(merged.reminderLeadDays) || 2,
      morningDigestEnabled: merged.morningDigestEnabled ? 1 : 0,
      morningDigestTime: merged.morningDigestTime || '08:30',
      defaultStorage: merged.defaultStorage || 'fridge',
      updatedAt: new Date().toISOString(),
    });
    return merged;
  },

  getStats() {
    const items = this.getAllItems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activeCount = 0;
    let usedCount = 0;
    let expiredCount = 0;
    let urgentCount = 0;
    let freshCount = 0;
    let moneySavedRs = 0;
    let moneyWastedRs = 0;
    let unpricedUsedCount = 0;
    let unpricedExpiredCount = 0;
    let totalScansLogged = 0;
    let lowStockCount = 0;
    let totalActiveValueRs = 0;
    let valueAtRiskRs = 0;

    for (const item of items) {
      if (item.source === 'barcode' || item.source === 'receipt') {
        totalScansLogged++;
      }

      // Accumulate any money saved from partial or full uses
      if (item.savedMoney && item.savedMoney > 0) {
        moneySavedRs += item.savedMoney;
      }

      if (item.status === 'active') {
        activeCount++;
        if (item.parLevel !== null && item.parLevel !== undefined && Number(item.quantity) <= Number(item.parLevel)) {
          lowStockCount++;
        }

        const remainingValue =
          item.price !== null && !isNaN(item.price)
            ? item.originalQuantity && item.originalQuantity > 0 && item.quantity < item.originalQuantity
              ? Math.round(item.price * (item.quantity / item.originalQuantity))
              : item.price
            : 0;
        totalActiveValueRs += remainingValue;

        const exp = new Date(item.estimatedExpiryDate);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) {
          urgentCount++;
          valueAtRiskRs += remainingValue;
        } else {
          freshCount++;
        }
      } else if (item.status === 'used') {
        usedCount++;
        // If savedMoney wasn't tracked separately, fall back to price
        if (!item.savedMoney || item.savedMoney === 0) {
          if (item.price !== null && !isNaN(item.price)) {
            moneySavedRs += item.price;
          } else {
            unpricedUsedCount++;
          }
        }
      } else if (item.status === 'expired') {
        expiredCount++;
        if (item.price !== null && !isNaN(item.price)) {
          moneyWastedRs += item.price;
        } else {
          unpricedExpiredCount++;
        }
      }
    }

    const totalResolved = usedCount + expiredCount;
    const savingPercentage = totalResolved > 0 ? Math.round((usedCount / totalResolved) * 100) : 100;
    const zeroWasteStreakDays = expiredCount === 0 && usedCount > 0 ? Math.min(14, usedCount + 2) : 5;

    return {
      totalLogged: items.length,
      activeCount,
      usedCount,
      expiredCount,
      urgentCount,
      freshCount,
      moneySavedRs,
      moneyWastedRs,
      unpricedUsedCount,
      unpricedExpiredCount,
      savingPercentage,
      zeroWasteStreakDays,
      totalScansLogged,
      lowStockCount,
      totalActiveValueRs,
      valueAtRiskRs,
    };
  },

  // Custom User Recipes
  getAllCustomRecipes() {
    const stmt = sqliteDb.prepare('SELECT * FROM custom_recipes ORDER BY createdAt DESC');
    return (stmt.all() as any[]).map(mapCustomRecipe);
  },

  getCustomRecipeById(id: string) {
    const stmt = sqliteDb.prepare('SELECT * FROM custom_recipes WHERE id = ?');
    const row = stmt.get(id);
    return row ? mapCustomRecipe(row) : null;
  },

  saveCustomRecipe(recipe: any) {
    const nowIso = new Date().toISOString();
    const prepared = {
      id: recipe.id || `custom-recipe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: recipe.title || 'My Custom Dish',
      description: recipe.description ?? '',
      image:
        sanitizeImageUrl(recipe.image) ||
        'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80',
      timeMinutes: Number(recipe.timeMinutes) || 15,
      servings: Number(recipe.servings) || 2,
      difficulty: recipe.difficulty ?? 'Easy',
      diet: recipe.diet ?? 'veg',
      cuisine: recipe.cuisine ?? 'Homestyle',
      ingredients: typeof recipe.ingredients === 'string' ? recipe.ingredients : JSON.stringify(recipe.ingredients || []),
      instructions: typeof recipe.instructions === 'string' ? recipe.instructions : JSON.stringify(recipe.instructions || []),
      notes: recipe.notes ?? null,
      cookedCount: Number(recipe.cookedCount) || 0,
      lastCookedAt: recipe.lastCookedAt ?? null,
      createdAt: recipe.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO custom_recipes (
        id, title, description, image, timeMinutes, servings, difficulty, diet, cuisine,
        ingredients, instructions, notes, cookedCount, lastCookedAt, createdAt, updatedAt
      ) VALUES (
        @id, @title, @description, @image, @timeMinutes, @servings, @difficulty, @diet, @cuisine,
        @ingredients, @instructions, @notes, @cookedCount, @lastCookedAt, @createdAt, @updatedAt
      )
    `);
    stmt.run(prepared);
    return mapCustomRecipe(prepared);
  },

  deleteCustomRecipe(id: string) {
    const stmt = sqliteDb.prepare('DELETE FROM custom_recipes WHERE id = ?');
    stmt.run(id);
    return true;
  },

  cookCustomRecipe(
    recipeId: string,
    deductions: { itemId: string; portion?: number; usedQuantity?: number; usedPortionName?: string }[]
  ) {
    const recipe = this.getCustomRecipeById(recipeId);
    const updatedItems: any[] = [];
    const recipeTitle = recipe?.title || 'Custom Recipe';

    for (const d of deductions) {
      if (!d.itemId) continue;
      const portionName = d.usedPortionName || `Used for "${recipeTitle}"`;
      const updated = this.markItemUsed(d.itemId, {
        portion: d.portion,
        usedQuantity: d.usedQuantity,
        usedPortionName: portionName,
      });
      if (updated) updatedItems.push(updated);
    }

    if (recipe) {
      const nowIso = new Date().toISOString();
      const nextCount = (recipe.cookedCount || 0) + 1;
      sqliteDb
        .prepare('UPDATE custom_recipes SET cookedCount = ?, lastCookedAt = ?, updatedAt = ? WHERE id = ?')
        .run(nextCount, nowIso, nowIso, recipeId);
      recipe.cookedCount = nextCount;
      recipe.lastCookedAt = nowIso;
    }

    return {
      recipe,
      updatedItems,
    };
  },

  // ---------------- Restock / Need-to-Buy Procurement List ----------------
  getRestockList() {
    const stmt = sqliteDb.prepare(
      "SELECT * FROM restock_list ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, CASE WHEN priority = 'urgent' THEN 0 ELSE 1 END, createdAt DESC"
    );
    return (stmt.all() as any[]).map(mapRestockItem);
  },

  getRestockItemById(id: string) {
    const row = sqliteDb.prepare('SELECT * FROM restock_list WHERE id = ?').get(id);
    return row ? mapRestockItem(row) : null;
  },

  saveRestockItem(entry: any) {
    const nowIso = new Date().toISOString();
    const targetQty = Number(entry.targetQuantity) > 0 ? Number(entry.targetQuantity) : 1;
    const prepared = {
      id: entry.id || `restock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: String(entry.name || '').trim() || 'Kitchen Item',
      category: entry.category || 'Other',
      targetQuantity: targetQty,
      unit: entry.unit || 'pack',
      storage: entry.storage || 'fridge',
      estimatedPrice:
        entry.estimatedPrice !== null && entry.estimatedPrice !== undefined && !isNaN(Number(entry.estimatedPrice))
          ? Number(entry.estimatedPrice)
          : null,
      supplierName: entry.supplierName ?? null,
      branchZone: entry.branchZone ?? null,
      parLevel:
        entry.parLevel !== null && entry.parLevel !== undefined && !isNaN(Number(entry.parLevel))
          ? Number(entry.parLevel)
          : null,
      sourceItemId: entry.sourceItemId ?? null,
      reason: entry.reason || 'manual',
      priority: entry.priority === 'urgent' ? 'urgent' : 'normal',
      checked: entry.checked ? 1 : 0,
      status: entry.status === 'stocked' ? 'stocked' : 'pending',
      notes: entry.notes ?? null,
      createdAt: entry.createdAt || nowIso,
      updatedAt: nowIso,
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO restock_list (
        id, name, category, targetQuantity, unit, storage, estimatedPrice,
        supplierName, branchZone, parLevel, sourceItemId, reason, priority,
        checked, status, notes, createdAt, updatedAt
      ) VALUES (
        @id, @name, @category, @targetQuantity, @unit, @storage, @estimatedPrice,
        @supplierName, @branchZone, @parLevel, @sourceItemId, @reason, @priority,
        @checked, @status, @notes, @createdAt, @updatedAt
      )
    `
      )
      .run(prepared);

    return mapRestockItem(prepared);
  },

  updateRestockItem(id: string, updates: any) {
    const existing = this.getRestockItemById(id);
    if (!existing) return null;

    const merged = {
      ...existing,
      ...updates,
      id,
      targetQuantity:
        updates.targetQuantity !== undefined && Number(updates.targetQuantity) > 0
          ? Number(updates.targetQuantity)
          : existing.targetQuantity,
      estimatedPrice:
        updates.estimatedPrice !== undefined
          ? updates.estimatedPrice !== null && !isNaN(Number(updates.estimatedPrice))
            ? Number(updates.estimatedPrice)
            : null
          : existing.estimatedPrice,
      parLevel:
        updates.parLevel !== undefined
          ? updates.parLevel !== null && !isNaN(Number(updates.parLevel))
            ? Number(updates.parLevel)
            : null
          : existing.parLevel ?? null,
      supplierName: (updates.supplierName !== undefined ? updates.supplierName : existing.supplierName) ?? null,
      branchZone: (updates.branchZone !== undefined ? updates.branchZone : existing.branchZone) ?? null,
      notes: (updates.notes !== undefined ? updates.notes : existing.notes) ?? null,
      checked: updates.checked !== undefined ? Boolean(updates.checked) : existing.checked,
      status: updates.status ?? existing.status,
      priority: updates.priority ?? existing.priority,
    };

    return this.saveRestockItem(merged);
  },

  deleteRestockItem(id: string) {
    sqliteDb.prepare('DELETE FROM restock_list WHERE id = ?').run(id);
    return true;
  },

  stockRestockItem(id: string, overrides: any = {}) {
    const restock = this.getRestockItemById(id);
    if (!restock) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const defaultDays = defaultShelfLifeDays(restock.category, overrides.storage || restock.storage);
    const defaultExpiry = formatDateOffset(defaultDays);

    const qty =
      overrides.quantity !== undefined && Number(overrides.quantity) > 0
        ? Number(overrides.quantity)
        : restock.targetQuantity;

    const stockedItem = this.insertItem({
      name: restock.name,
      category: restock.category,
      quantity: qty,
      originalQuantity: qty,
      unit: overrides.unit || restock.unit,
      purchaseDate: todayStr,
      estimatedExpiryDate: overrides.estimatedExpiryDate || defaultExpiry,
      storage: overrides.storage || restock.storage,
      price:
        overrides.price !== undefined
          ? overrides.price
          : restock.estimatedPrice,
      status: 'active',
      source: 'manual',
      batchCode: overrides.batchCode ?? null,
      supplierName: (overrides.supplierName !== undefined ? overrides.supplierName : restock.supplierName) ?? null,
      parLevel: (overrides.parLevel !== undefined ? overrides.parLevel : restock.parLevel) ?? null,
      branchZone: (overrides.branchZone !== undefined ? overrides.branchZone : restock.branchZone) ?? null,
      notes: `Restocked from Buy List (${restock.reason})`,
    });

    const updatedRestock = this.updateRestockItem(id, {
      status: 'stocked',
      checked: false,
    });

    this.logActivity('restocked', restock.name, `Restocked ${qty} ${overrides.unit || restock.unit} into ${overrides.storage || restock.storage}`);

    return {
      stockedItem,
      restockItem: updatedRestock,
    };
  },

  bulkStockRestockItems(ids: string[]) {
    const stockedItems: any[] = [];
    const restockItems: any[] = [];

    for (const id of ids) {
      const result = this.stockRestockItem(id);
      if (result) {
        stockedItems.push(result.stockedItem);
        restockItems.push(result.restockItem);
      }
    }

    return { stockedItems, restockItems };
  },

  syncNeededRestockItems() {
    const allItems = this.getAllItems();
    const pendingList = this.getRestockList().filter((r) => r.status === 'pending');
    const pendingNames = new Set(pendingList.map((r) => r.name.toLowerCase()));
    const activeNames = new Set(allItems.filter((i) => i.status === 'active').map((i) => i.name.toLowerCase()));
    const prefs = this.getPreferences();

    const added: any[] = [];

    for (const item of allItems) {
      const lowerName = item.name.toLowerCase();
      if (pendingNames.has(lowerName)) continue;

      const isLowStock =
        item.status === 'active' &&
        item.parLevel !== null &&
        item.parLevel !== undefined &&
        Number(item.quantity) <= Number(item.parLevel);

      const isCompletedMissing =
        (item.status === 'used' || item.status === 'expired' || Number(item.quantity) <= 0) &&
        !activeNames.has(lowerName);

      if (isLowStock || isCompletedMissing) {
        const targetQty = isLowStock
          ? Math.max(Number(item.originalQuantity || item.parLevel || 1), Number(item.parLevel || 1) * 2 - Number(item.quantity))
          : Number(item.originalQuantity || item.quantity || 1);

        const created = this.saveRestockItem({
          name: item.name,
          category: item.category,
          targetQuantity: targetQty > 0 ? targetQty : 1,
          unit: item.unit,
          storage: item.storage,
          estimatedPrice: item.price,
          supplierName: item.supplierName ?? null,
          branchZone: item.branchZone ?? (prefs.branchLocation || null),
          parLevel: item.parLevel ?? null,
          sourceItemId: item.id,
          reason: isLowStock ? 'low-stock' : item.status === 'expired' ? 'expired' : 'completed',
          priority: isLowStock ? 'urgent' : 'normal',
          checked: false,
          status: 'pending',
        });

        pendingNames.add(lowerName);
        added.push(created);
      }
    }

    return {
      addedCount: added.length,
      items: this.getRestockList(),
    };
  },

  // ---------------- Activity & Audit Logs ----------------
  logActivity(action: string, itemName: string, details: string) {
    try {
      const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const timestamp = new Date().toISOString();
      sqliteDb
        .prepare('INSERT INTO activity_logs (id, action, itemName, details, timestamp) VALUES (?, ?, ?, ?, ?)')
        .run(id, action, itemName, details ?? '', timestamp);

      // Keep recent 200 rows to stay lightweight
      sqliteDb.exec(`
        DELETE FROM activity_logs WHERE id NOT IN (
          SELECT id FROM activity_logs ORDER BY timestamp DESC LIMIT 200
        )
      `);
    } catch (err) {
      console.warn('Activity log skipped:', err);
    }
  },

  getActivityLogs(limit = 40) {
    const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 200);
    return sqliteDb
      .prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?')
      .all(safeLimit) as any[];
  },

  // ---------------- Weekly Meal & Prep Planner ----------------
  getMealPlans() {
    const rows = sqliteDb.prepare('SELECT * FROM meal_plans ORDER BY createdAt ASC').all() as any[];
    return rows.map(mapMealPlan);
  },

  saveMealPlan(entry: any) {
    const nowIso = new Date().toISOString();
    const dayOfWeek = entry.dayOfWeek || 'Mon';
    const slot = entry.slot || 'lunch';
    const id = entry.id || `${dayOfWeek}-${slot}`;
    const prepared = {
      id,
      dayOfWeek,
      slot,
      recipeId: entry.recipeId ?? null,
      recipeTitle: String(entry.recipeTitle || '').trim() || 'Planned Dish',
      servings: Number(entry.servings) > 0 ? Number(entry.servings) : 2,
      ingredients:
        typeof entry.ingredients === 'string'
          ? entry.ingredients
          : JSON.stringify(Array.isArray(entry.ingredients) ? entry.ingredients : []),
      notes: entry.notes ?? null,
      createdAt: entry.createdAt || nowIso,
      updatedAt: nowIso,
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO meal_plans (
        id, dayOfWeek, slot, recipeId, recipeTitle, servings, ingredients, notes, createdAt, updatedAt
      ) VALUES (
        @id, @dayOfWeek, @slot, @recipeId, @recipeTitle, @servings, @ingredients, @notes, @createdAt, @updatedAt
      )
    `
      )
      .run(prepared);

    return mapMealPlan(prepared);
  },

  deleteMealPlan(id: string) {
    sqliteDb.prepare('DELETE FROM meal_plans WHERE id = ?').run(id);
    return true;
  },

  clearMealPlans() {
    sqliteDb.exec('DELETE FROM meal_plans;');
    return true;
  },

  // ---------------- Suppliers / Vendors Directory ----------------
  getSuppliers() {
    const rows = sqliteDb.prepare('SELECT * FROM suppliers ORDER BY name ASC').all() as any[];
    return rows.map(mapSupplier);
  },

  saveSupplier(entry: any) {
    const nowIso = new Date().toISOString();
    const prepared = {
      id: entry.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: String(entry.name || '').trim() || 'Supplier',
      contactName: entry.contactName ?? null,
      phone: entry.phone ?? null,
      whatsapp: entry.whatsapp ?? null,
      email: entry.email ?? null,
      categories: entry.categories ?? null,
      leadTimeDays: Number(entry.leadTimeDays) >= 0 ? Number(entry.leadTimeDays) : 1,
      paymentTerms: entry.paymentTerms ?? null,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt || nowIso,
      updatedAt: nowIso,
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO suppliers (
        id, name, contactName, phone, whatsapp, email, categories, leadTimeDays, paymentTerms, notes, createdAt, updatedAt
      ) VALUES (
        @id, @name, @contactName, @phone, @whatsapp, @email, @categories, @leadTimeDays, @paymentTerms, @notes, @createdAt, @updatedAt
      )
    `
      )
      .run(prepared);

    this.logActivity('supplier', prepared.name, `Saved vendor profile (${prepared.leadTimeDays}d lead time)`);
    return mapSupplier(prepared);
  },

  deleteSupplier(id: string) {
    sqliteDb.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    return true;
  },

  // ---------------- Cold-Chain & FSSAI Storage Temp Logs ----------------
  getStorageLogs(limit = 60) {
    const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 300);
    const rows = sqliteDb
      .prepare('SELECT * FROM storage_logs ORDER BY loggedAt DESC LIMIT ?')
      .all(safeLimit) as any[];
    return rows.map(mapStorageLog);
  },

  addStorageLog(entry: any) {
    const temp = Number(entry.temperatureC);
    if (isNaN(temp)) {
      throw new Error('Valid temperatureC number is required');
    }
    const zoneType = entry.zoneType || 'fridge';
    const status = evaluateStorageTempStatus(zoneType, temp);
    const prepared = {
      id: entry.id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      zoneName: String(entry.zoneName || '').trim() || 'Main Storage',
      zoneType,
      temperatureC: temp,
      humidityPct:
        entry.humidityPct !== null && entry.humidityPct !== undefined && !isNaN(Number(entry.humidityPct))
          ? Number(entry.humidityPct)
          : null,
      status,
      checkedBy: entry.checkedBy ?? null,
      branchZone: entry.branchZone ?? null,
      notes: entry.notes ?? null,
      loggedAt: entry.loggedAt || new Date().toISOString(),
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO storage_logs (
        id, zoneName, zoneType, temperatureC, humidityPct, status, checkedBy, branchZone, notes, loggedAt
      ) VALUES (
        @id, @zoneName, @zoneType, @temperatureC, @humidityPct, @status, @checkedBy, @branchZone, @notes, @loggedAt
      )
    `
      )
      .run(prepared);

    this.logActivity(
      status === 'pass' ? 'hygiene' : 'alert',
      prepared.zoneName,
      `Logged ${temp}°C (${status.toUpperCase()})`
    );
    return mapStorageLog(prepared);
  },

  deleteStorageLog(id: string) {
    sqliteDb.prepare('DELETE FROM storage_logs WHERE id = ?').run(id);
    return true;
  },

  // ---------------- Inter-Zone / Branch Stock Transfer ----------------
  transferItem(
    id: string,
    payload: { quantity?: number; targetStorage?: string; targetBranchZone?: string | null; notes?: string | null }
  ) {
    const existing = this.getItemById(id);
    if (!existing) return null;

    const currQty = Number(existing.quantity) || 0;
    const transferQty =
      payload.quantity !== undefined && Number(payload.quantity) > 0
        ? Math.min(currQty, Number(payload.quantity))
        : currQty;
    const targetStorage = payload.targetStorage || existing.storage;
    const targetZone =
      payload.targetBranchZone !== undefined && String(payload.targetBranchZone).trim() !== ''
        ? String(payload.targetBranchZone).trim()
        : existing.branchZone ?? null;
    const transferNote = payload.notes ? String(payload.notes).trim() : '';

    const sourceLabel = `${existing.branchZone || 'Main Kitchen'} (${existing.storage})`;
    const destLabel = `${targetZone || 'Main Kitchen'} (${targetStorage})`;

    // Full transfer -> update item in place
    if (transferQty >= currQty || currQty <= 0) {
      const updatedNotes = [existing.notes, `Transferred ${sourceLabel} → ${destLabel}${transferNote ? `: ${transferNote}` : ''}`]
        .filter(Boolean)
        .join(' • ');
      const updated = this.updateItem(id, {
        storage: targetStorage,
        branchZone: targetZone,
        notes: updatedNotes,
      });
      this.logActivity('transfer', existing.name, `Moved ${currQty} ${existing.unit} from ${sourceLabel} to ${destLabel}`);
      return { sourceItem: updated, transferredItem: null };
    }

    // Partial transfer -> split batch cleanly
    const remainingQty = Number((currQty - transferQty).toFixed(2));
    const ratio = currQty > 0 ? transferQty / currQty : 0;
    const transferPrice = existing.price !== null ? Math.round(existing.price * ratio) : null;
    const remainPrice = existing.price !== null ? Math.max(0, existing.price - (transferPrice || 0)) : null;

    const updatedSource = this.updateItem(id, {
      quantity: remainingQty,
      price: remainPrice,
      notes: [existing.notes, `Split ${transferQty} ${existing.unit} → ${destLabel}`].filter(Boolean).join(' • '),
    });

    const createdTarget = this.insertItem({
      name: existing.name,
      category: existing.category,
      quantity: transferQty,
      originalQuantity: transferQty,
      unit: existing.unit,
      purchaseDate: existing.purchaseDate,
      estimatedExpiryDate: existing.estimatedExpiryDate,
      printedExpiryDate: existing.printedExpiryDate ?? null,
      storage: targetStorage,
      price: transferPrice,
      status: 'active',
      source: existing.source,
      barcode: existing.barcode ?? null,
      imageUrl: existing.imageUrl ?? null,
      batchCode: existing.batchCode ?? null,
      supplierName: existing.supplierName ?? null,
      parLevel: existing.parLevel ?? null,
      branchZone: targetZone,
      notes: `Transferred from ${sourceLabel}${transferNote ? ` — ${transferNote}` : ''}`,
    });

    this.logActivity('transfer', existing.name, `Transferred ${transferQty} ${existing.unit} from ${sourceLabel} to ${destLabel}`);
    return { sourceItem: updatedSource, transferredItem: createdTarget };
  },

  // ---------------- Physical Stocktake & Variance Reconciliation ----------------
  reconcileStocktake(
    entries: {
      itemId: string;
      actualQuantity: number;
      zeroDisposition?: 'used' | 'expired';
      addShortageToBuyList?: boolean;
    }[]
  ) {
    let adjustedCount = 0;
    let shortageCount = 0;
    let totalVarianceRs = 0;

    const prefs = this.getPreferences();
    const pendingNames = new Set(
      this.getRestockList()
        .filter((r) => r.status === 'pending')
        .map((r) => r.name.toLowerCase())
    );

    for (const entry of entries) {
      if (!entry || !entry.itemId) continue;
      const item = this.getItemById(entry.itemId);
      if (!item || item.status !== 'active') continue;

      const expected = Number(item.quantity) || 0;
      const actual = Math.max(0, Number(entry.actualQuantity));
      if (isNaN(actual) || Math.abs(actual - expected) < 0.001) continue;

      adjustedCount += 1;
      const diff = actual - expected; // negative = shortage / shrinkage
      const baseQty = Number(item.originalQuantity || expected || 1);
      const unitValue = item.price !== null && baseQty > 0 ? item.price / baseQty : 0;
      const varianceRs = Math.round(diff * unitValue);
      totalVarianceRs += varianceRs;

      if (diff < 0) shortageCount += 1;

      if (actual <= 0) {
        if (entry.zeroDisposition === 'expired') {
          this.markItemExpired(item.id);
        } else {
          this.markItemUsed(item.id, {
            portion: 1,
            usedPortionName: 'Stocktake Audit (0 on hand)',
          });
        }
      } else {
        const auditNote = `Stocktake ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${expected} → ${actual} ${item.unit}`;
        this.updateItem(item.id, {
          quantity: Number(actual.toFixed(2)),
          originalQuantity: Math.max(Number(item.originalQuantity || expected), actual),
          notes: item.notes ? `${item.notes} • ${auditNote}` : auditNote,
        });
      }

      const needsBuy =
        entry.addShortageToBuyList &&
        (actual <= 0 ||
          (item.parLevel !== null && item.parLevel !== undefined && actual <= Number(item.parLevel)));

      if (needsBuy && !pendingNames.has(item.name.toLowerCase())) {
        this.saveRestockItem({
          name: item.name,
          category: item.category,
          targetQuantity: Math.max(1, Number(item.originalQuantity || expected || 1)),
          unit: item.unit,
          storage: item.storage,
          estimatedPrice: item.price ?? null,
          supplierName: item.supplierName ?? null,
          branchZone: item.branchZone ?? (prefs.branchLocation || null),
          parLevel: item.parLevel ?? null,
          sourceItemId: item.id,
          reason: actual <= 0 ? 'completed' : 'low-stock',
          priority: 'urgent',
          checked: false,
          status: 'pending',
          notes: 'Queued automatically from Stocktake Audit',
        });
        pendingNames.add(item.name.toLowerCase());
      }
    }

    if (adjustedCount > 0) {
      const sign = totalVarianceRs >= 0 ? '+' : '-';
      this.logActivity(
        'stocktake',
        'Physical Stocktake Audit',
        `Reconciled ${adjustedCount} SKU(s) (${shortageCount} shortage, variance ${sign}₹${Math.abs(totalVarianceRs)})`
      );
    }

    return {
      adjustedCount,
      shortageCount,
      totalVarianceRs,
      items: this.getAllItems(),
      restockList: this.getRestockList(),
    };
  },

  // ---------------- Daily Kitchen Checklists & Shift Handover ----------------
  getChecklists() {
    const rows = sqliteDb
      .prepare('SELECT * FROM checklists ORDER BY completed ASC, createdAt DESC')
      .all() as any[];
    return rows.map(mapChecklistItem);
  },

  saveChecklistItem(entry: any) {
    const nowIso = new Date().toISOString();
    const prepared = {
      id: entry.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: String(entry.title || '').trim() || 'Kitchen Task',
      category: entry.category || 'opening',
      completed: entry.completed ? 1 : 0,
      completedAt: entry.completed ? (entry.completedAt || nowIso) : null,
      assignedTo: entry.assignedTo ?? null,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt || nowIso,
      updatedAt: nowIso,
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO checklists (
        id, title, category, completed, completedAt, assignedTo, notes, createdAt, updatedAt
      ) VALUES (
        @id, @title, @category, @completed, @completedAt, @assignedTo, @notes, @createdAt, @updatedAt
      )
    `
      )
      .run(prepared);

    return mapChecklistItem(prepared);
  },

  toggleChecklistItem(id: string) {
    const row = sqliteDb.prepare('SELECT * FROM checklists WHERE id = ?').get(id) as any;
    if (!row) return null;
    const nextCompleted = row.completed ? 0 : 1;
    const nowIso = new Date().toISOString();
    sqliteDb
      .prepare('UPDATE checklists SET completed = ?, completedAt = ?, updatedAt = ? WHERE id = ?')
      .run(nextCompleted, nextCompleted ? nowIso : null, nowIso, id);
    return mapChecklistItem({ ...row, completed: nextCompleted, completedAt: nextCompleted ? nowIso : null, updatedAt: nowIso });
  },

  deleteChecklistItem(id: string) {
    sqliteDb.prepare('DELETE FROM checklists WHERE id = ?').run(id);
    return true;
  },

  resetDailyChecklists() {
    const nowIso = new Date().toISOString();
    sqliteDb
      .prepare("UPDATE checklists SET completed = 0, completedAt = NULL, updatedAt = ? WHERE category != 'handover'")
      .run(nowIso);
    this.logActivity('hygiene', 'Daily Shift Checklist', 'Reset daily opening/closing checks for new shift');
    return this.getChecklists();
  },

  // ---------------- Root-Cause Waste Logs ----------------
  getWasteLogs(limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const rows = sqliteDb
      .prepare('SELECT * FROM waste_logs ORDER BY loggedAt DESC LIMIT ?')
      .all(safeLimit) as any[];
    return rows.map(mapWasteLog);
  },

  logWaste(entry: any) {
    const nowIso = new Date().toISOString();
    const qtyWasted = Math.max(0.01, Number(entry.quantityWasted) || 1);
    let lossRs = Number(entry.lossRs);
    if (isNaN(lossRs) || lossRs < 0) lossRs = 0;

    let updatedItem: any = null;
    if (entry.itemId) {
      const existing = this.getItemById(entry.itemId);
      if (existing && existing.status === 'active') {
        const currQty = Number(existing.quantity) || 0;
        const origQty = Number(existing.originalQuantity || currQty || 1);
        const actualDeduct = Math.min(currQty, qtyWasted);
        if (lossRs === 0 && existing.price !== null && origQty > 0) {
          lossRs = Math.round((existing.price / origQty) * actualDeduct);
        }

        const remainingQty = Number(Math.max(0, currQty - actualDeduct).toFixed(2));
        const reasonLabel = String(entry.reason || 'expired');
        const wasteNote = `Waste (${reasonLabel}): ${actualDeduct} ${existing.unit} (₹${lossRs} loss)`;
        const mergedNotes = existing.notes ? `${existing.notes} • ${wasteNote}` : wasteNote;

        if (remainingQty <= 0.001) {
          updatedItem = this.updateItem(existing.id, {
            quantity: 0,
            status: 'expired',
            notes: mergedNotes,
          });
        } else {
          const remainPrice =
            existing.price !== null ? Math.max(0, existing.price - lossRs) : null;
          updatedItem = this.updateItem(existing.id, {
            quantity: remainingQty,
            price: remainPrice,
            notes: mergedNotes,
          });
        }
      }
    }

    const prepared = {
      id: entry.id || `waste-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemId: entry.itemId ?? null,
      itemName: String(entry.itemName || 'Kitchen Item').trim(),
      category: entry.category || 'Other',
      quantityWasted: qtyWasted,
      unit: entry.unit || 'unit',
      lossRs: Math.round(lossRs),
      reason: entry.reason || 'expired',
      loggedBy: entry.loggedBy ?? null,
      branchZone: entry.branchZone ?? null,
      notes: entry.notes ?? null,
      loggedAt: entry.loggedAt || nowIso,
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO waste_logs (
        id, itemId, itemName, category, quantityWasted, unit, lossRs, reason, loggedBy, branchZone, notes, loggedAt
      ) VALUES (
        @id, @itemId, @itemName, @category, @quantityWasted, @unit, @lossRs, @reason, @loggedBy, @branchZone, @notes, @loggedAt
      )
    `
      )
      .run(prepared);

    this.logActivity(
      'expired',
      prepared.itemName,
      `Logged ${prepared.quantityWasted} ${prepared.unit} waste (${prepared.reason}, ₹${prepared.lossRs})`
    );

    return { log: mapWasteLog(prepared), updatedItem };
  },

  deleteWasteLog(id: string) {
    sqliteDb.prepare('DELETE FROM waste_logs WHERE id = ?').run(id);
    return true;
  },

  // ---------------- Purchase Invoices & GRN Spend Ledger ----------------
  getInvoices(limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const rows = sqliteDb
      .prepare('SELECT * FROM invoices ORDER BY invoiceDate DESC, createdAt DESC LIMIT ?')
      .all(safeLimit) as any[];
    return rows.map(mapInvoice);
  },

  saveInvoice(entry: any) {
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const amountRs = Math.max(0, Number(entry.amountRs) || 0);
    const prepared = {
      id: entry.id || `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber: String(entry.invoiceNumber || `GRN-${Date.now().toString().slice(-5)}`).trim(),
      supplierName: String(entry.supplierName || 'Local Market / Kirana').trim(),
      invoiceDate: entry.invoiceDate || todayStr,
      dueDate: entry.dueDate ?? null,
      amountRs,
      category: entry.category || 'Mixed Groceries',
      paymentStatus:
        entry.paymentStatus === 'pending' || entry.paymentStatus === 'overdue' ? entry.paymentStatus : 'paid',
      itemsCount:
        entry.itemsCount !== null && entry.itemsCount !== undefined && !isNaN(Number(entry.itemsCount))
          ? Number(entry.itemsCount)
          : null,
      branchZone: entry.branchZone ?? null,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt || nowIso,
      updatedAt: nowIso,
    };

    sqliteDb
      .prepare(
        `
      INSERT OR REPLACE INTO invoices (
        id, invoiceNumber, supplierName, invoiceDate, dueDate, amountRs, category, paymentStatus, itemsCount, branchZone, notes, createdAt, updatedAt
      ) VALUES (
        @id, @invoiceNumber, @supplierName, @invoiceDate, @dueDate, @amountRs, @category, @paymentStatus, @itemsCount, @branchZone, @notes, @createdAt, @updatedAt
      )
    `
      )
      .run(prepared);

    this.logActivity(
      'restocked',
      prepared.supplierName,
      `Invoice ${prepared.invoiceNumber} — ₹${amountRs.toLocaleString('en-IN')} (${prepared.paymentStatus.toUpperCase()})`
    );
    return mapInvoice(prepared);
  },

  updateInvoiceStatus(id: string, paymentStatus: 'paid' | 'pending' | 'overdue') {
    const row = sqliteDb.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!row) return null;
    const nowIso = new Date().toISOString();
    sqliteDb
      .prepare('UPDATE invoices SET paymentStatus = ?, updatedAt = ? WHERE id = ?')
      .run(paymentStatus, nowIso, id);
    return mapInvoice({ ...row, paymentStatus, updatedAt: nowIso });
  },

  deleteInvoice(id: string) {
    sqliteDb.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    return true;
  },

  // ---------------- Full JSON Backup & Restore ----------------
  exportBackupJson() {
    return {
      version: 4,
      exportedAt: new Date().toISOString(),
      preferences: this.getPreferences(),
      items: this.getAllItems(),
      customRecipes: this.getAllCustomRecipes(),
      restockList: this.getRestockList(),
      mealPlans: this.getMealPlans(),
      suppliers: this.getSuppliers(),
      storageLogs: this.getStorageLogs(150),
      checklists: this.getChecklists(),
      wasteLogs: this.getWasteLogs(200),
      invoices: this.getInvoices(200),
      activityLogs: this.getActivityLogs(100),
    };
  },

  restoreBackupJson(snapshot: any) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Invalid backup JSON payload');
    }
    const MAX_RESTORE_ROWS = 2000;
    const cap = (arr: any[]): any[] => arr.slice(0, MAX_RESTORE_ROWS);

    if (snapshot.preferences && typeof snapshot.preferences === 'object') {
      this.updatePreferences(snapshot.preferences);
    }
    if (Array.isArray(snapshot.items)) {
      sqliteDb.exec('DELETE FROM items;');
      this.insertItems(cap(snapshot.items));
    }
    if (Array.isArray(snapshot.customRecipes)) {
      sqliteDb.exec('DELETE FROM custom_recipes;');
      for (const r of cap(snapshot.customRecipes)) {
        this.saveCustomRecipe(r);
      }
    }
    if (Array.isArray(snapshot.restockList)) {
      sqliteDb.exec('DELETE FROM restock_list;');
      for (const r of cap(snapshot.restockList)) {
        this.saveRestockItem(r);
      }
    }
    if (Array.isArray(snapshot.mealPlans)) {
      sqliteDb.exec('DELETE FROM meal_plans;');
      for (const m of cap(snapshot.mealPlans)) {
        this.saveMealPlan(m);
      }
    }
    if (Array.isArray(snapshot.suppliers)) {
      sqliteDb.exec('DELETE FROM suppliers;');
      for (const s of cap(snapshot.suppliers)) {
        this.saveSupplier(s);
      }
    }
    if (Array.isArray(snapshot.storageLogs)) {
      sqliteDb.exec('DELETE FROM storage_logs;');
      for (const l of cap(snapshot.storageLogs)) {
        this.addStorageLog(l);
      }
    }
    if (Array.isArray(snapshot.checklists)) {
      sqliteDb.exec('DELETE FROM checklists;');
      for (const c of cap(snapshot.checklists)) {
        this.saveChecklistItem(c);
      }
    }
    if (Array.isArray(snapshot.wasteLogs)) {
      sqliteDb.exec('DELETE FROM waste_logs;');
      for (const w of cap(snapshot.wasteLogs)) {
        if (w && typeof w === 'object') {
          this.logWaste({ ...w, itemId: null });
        }
      }
    }
    if (Array.isArray(snapshot.invoices)) {
      sqliteDb.exec('DELETE FROM invoices;');
      for (const inv of cap(snapshot.invoices)) {
        this.saveInvoice(inv);
      }
    }
    this.logActivity('restocked', 'Full Database Restore', `Restored backup (${Array.isArray(snapshot.items) ? Math.min(snapshot.items.length, MAX_RESTORE_ROWS) : 0} items)`);
    return this.exportBackupJson();
  },
};

function defaultShelfLifeDays(category: string, storage: string): number {
  const table: Record<string, { fridge: number; pantry: number; freezer: number }> = {
    Dairy: { fridge: 5, pantry: 1, freezer: 30 },
    'Leafy Greens': { fridge: 4, pantry: 1, freezer: 14 },
    Vegetables: { fridge: 7, pantry: 4, freezer: 60 },
    Fruits: { fridge: 6, pantry: 3, freezer: 60 },
    'Bakery & Bread': { fridge: 7, pantry: 4, freezer: 60 },
    'Cooked Leftovers': { fridge: 3, pantry: 1, freezer: 30 },
    'Eggs, Meat & Poultry': { fridge: 14, pantry: 1, freezer: 90 },
    'Pulses & Dal': { fridge: 365, pantry: 180, freezer: 365 },
    'Grains & Flours': { fridge: 180, pantry: 120, freezer: 365 },
    'Spices & Condiments': { fridge: 365, pantry: 240, freezer: 365 },
    'Snacks & Packaged': { fridge: 180, pantry: 120, freezer: 180 },
    Beverages: { fridge: 10, pantry: 90, freezer: 90 },
  };
  const rule = table[category] || { fridge: 7, pantry: 14, freezer: 60 };
  if (storage === 'pantry') return rule.pantry;
  if (storage === 'freezer') return rule.freezer;
  return rule.fridge;
}

function mapRestockItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    targetQuantity: Number(row.targetQuantity) || 1,
    unit: row.unit || 'pack',
    storage: row.storage || 'fridge',
    estimatedPrice: row.estimatedPrice !== null && row.estimatedPrice !== undefined ? Number(row.estimatedPrice) : null,
    supplierName: row.supplierName || undefined,
    branchZone: row.branchZone || undefined,
    parLevel: row.parLevel !== null && row.parLevel !== undefined ? Number(row.parLevel) : null,
    sourceItemId: row.sourceItemId || undefined,
    reason: row.reason || 'manual',
    priority: row.priority === 'urgent' ? 'urgent' : 'normal',
    checked: Boolean(row.checked),
    status: row.status === 'stocked' ? 'stocked' : 'pending',
    notes: row.notes || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

function mapCustomRecipe(row: any) {
  let ingredients = [];
  try {
    ingredients = typeof row.ingredients === 'string' ? JSON.parse(row.ingredients) : row.ingredients || [];
  } catch {}

  let instructions = [];
  try {
    instructions = typeof row.instructions === 'string' ? JSON.parse(row.instructions) : row.instructions || [];
  } catch {}

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    image: row.image || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80',
    timeMinutes: Number(row.timeMinutes) || 15,
    servings: Number(row.servings) || 2,
    difficulty: row.difficulty || 'Easy',
    diet: row.diet || 'veg',
    cuisine: row.cuisine || 'Homestyle',
    ingredients,
    instructions,
    notes: row.notes || undefined,
    cookedCount: Number(row.cookedCount) || 0,
    lastCookedAt: row.lastCookedAt || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    source: 'custom' as const,
  };
}

function mapItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit,
    purchaseDate: row.purchaseDate,
    estimatedExpiryDate: row.estimatedExpiryDate,
    printedExpiryDate: row.printedExpiryDate || undefined,
    storage: row.storage,
    price: row.price !== null ? Number(row.price) : null,
    status: row.status,
    originalQuantity: row.originalQuantity !== null && row.originalQuantity !== undefined ? Number(row.originalQuantity) : undefined,
    savedMoney: row.savedMoney !== null && row.savedMoney !== undefined ? Number(row.savedMoney) : 0,
    usedAt: row.usedAt || undefined,
    source: row.source,
    barcode: row.barcode || undefined,
    notes: row.notes || undefined,
    imageUrl: row.imageUrl || undefined,
    batchCode: row.batchCode || undefined,
    supplierName: row.supplierName || undefined,
    parLevel: row.parLevel !== null && row.parLevel !== undefined ? Number(row.parLevel) : null,
    branchZone: row.branchZone || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

function mapMealPlan(row: any) {
  let ingredients: string[] = [];
  try {
    ingredients = typeof row.ingredients === 'string' ? JSON.parse(row.ingredients) : row.ingredients || [];
  } catch {}
  return {
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    slot: row.slot,
    recipeId: row.recipeId || undefined,
    recipeTitle: row.recipeTitle,
    servings: Number(row.servings) || 2,
    ingredients,
    notes: row.notes || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

function evaluateStorageTempStatus(zoneType: string, tempC: number): 'pass' | 'warning' | 'alert' {
  if (zoneType === 'freezer') {
    if (tempC <= -18) return 'pass';
    if (tempC <= -14) return 'warning';
    return 'alert';
  }
  if (zoneType === 'pantry') {
    if (tempC >= 10 && tempC <= 25) return 'pass';
    if (tempC >= 8 && tempC <= 30) return 'warning';
    return 'alert';
  }
  if (zoneType === 'hot-hold') {
    if (tempC >= 63) return 'pass';
    if (tempC >= 57) return 'warning';
    return 'alert';
  }
  // Default: fridge / walk-in cooler (FSSAI safe range 0°C – 4°C)
  if (tempC >= 0 && tempC <= 4.5) return 'pass';
  if (tempC >= -1 && tempC <= 7) return 'warning';
  return 'alert';
}

function mapSupplier(row: any) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName || undefined,
    phone: row.phone || undefined,
    whatsapp: row.whatsapp || undefined,
    email: row.email || undefined,
    categories: row.categories || undefined,
    leadTimeDays: Number(row.leadTimeDays) || 1,
    paymentTerms: row.paymentTerms || undefined,
    notes: row.notes || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

function mapStorageLog(row: any) {
  return {
    id: row.id,
    zoneName: row.zoneName,
    zoneType: row.zoneType || 'fridge',
    temperatureC: Number(row.temperatureC),
    humidityPct: row.humidityPct !== null && row.humidityPct !== undefined ? Number(row.humidityPct) : null,
    status: row.status || 'pass',
    checkedBy: row.checkedBy || undefined,
    branchZone: row.branchZone || undefined,
    notes: row.notes || undefined,
    loggedAt: row.loggedAt,
  };
}

function mapChecklistItem(row: any) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || 'opening',
    completed: Boolean(row.completed),
    completedAt: row.completedAt || null,
    assignedTo: row.assignedTo || undefined,
    notes: row.notes || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

function mapWasteLog(row: any) {
  return {
    id: row.id,
    itemId: row.itemId || undefined,
    itemName: row.itemName,
    category: row.category || 'Other',
    quantityWasted: Number(row.quantityWasted) || 0,
    unit: row.unit || 'unit',
    lossRs: Number(row.lossRs) || 0,
    reason: row.reason || 'expired',
    loggedBy: row.loggedBy || undefined,
    branchZone: row.branchZone || undefined,
    notes: row.notes || undefined,
    loggedAt: row.loggedAt,
  };
}

function mapInvoice(row: any) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    supplierName: row.supplierName,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate || undefined,
    amountRs: Number(row.amountRs) || 0,
    category: row.category || 'Mixed Groceries',
    paymentStatus: row.paymentStatus || 'paid',
    itemsCount: row.itemsCount !== null && row.itemsCount !== undefined ? Number(row.itemsCount) : null,
    branchZone: row.branchZone || undefined,
    notes: row.notes || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

