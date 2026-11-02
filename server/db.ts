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
    usedAt TEXT,
    source TEXT NOT NULL,
    barcode TEXT,
    notes TEXT,
    imageUrl TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY,
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
`);

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

  // Seed default preferences
  sqliteDb.prepare(`
    INSERT OR REPLACE INTO preferences (id, diet, reminderLeadDays, morningDigestEnabled, morningDigestTime, defaultStorage, updatedAt)
    VALUES ('default', 'veg', 2, 1, '08:30', 'fridge', ?)
  `).run(now);
}

// ---------------- SQLite Public Interface ----------------

export const db = {
  getEngine() {
    return {
      type: 'sqlite',
      version: '3.x (native node:sqlite DatabaseSync)',
      path: dbFilePath,
    };
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
    const prepared = {
      id: item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: item.name,
      category: item.category,
      quantity: Number(item.quantity) || 1,
      unit: item.unit || 'pack',
      purchaseDate: item.purchaseDate || nowIso.split('T')[0],
      estimatedExpiryDate: item.estimatedExpiryDate,
      printedExpiryDate: item.printedExpiryDate || null,
      storage: item.storage || 'fridge',
      price: item.price !== null && item.price !== undefined && !isNaN(item.price) ? Number(item.price) : null,
      status: item.status || 'active',
      usedAt: item.usedAt || null,
      source: item.source || 'manual',
      barcode: item.barcode || null,
      notes: item.notes || null,
      imageUrl: item.imageUrl || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO items (
        id, name, category, quantity, unit, purchaseDate, estimatedExpiryDate,
        printedExpiryDate, storage, price, status, usedAt, source, barcode, notes, imageUrl, createdAt, updatedAt
      ) VALUES (
        @id, @name, @category, @quantity, @unit, @purchaseDate, @estimatedExpiryDate,
        @printedExpiryDate, @storage, @price, @status, @usedAt, @source, @barcode, @notes, @imageUrl, @createdAt, @updatedAt
      )
    `);
    stmt.run(prepared);
    return prepared;
  },

  insertItems(items: any[]) {
    return items.map((item) => this.insertItem(item));
  },

  updateItem(id: string, updates: any) {
    const existing = this.getItemById(id);
    if (!existing) return null;

    const merged = {
      ...existing,
      ...updates,
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
        usedAt = @usedAt,
        source = @source,
        barcode = @barcode,
        notes = @notes,
        imageUrl = @imageUrl,
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

  markItemUsed(id: string) {
    return this.updateItem(id, {
      status: 'used',
      usedAt: new Date().toISOString(),
    });
  },

  markItemsUsed(ids: string[]) {
    const nowIso = new Date().toISOString();
    return ids.map((id) => this.updateItem(id, { status: 'used', usedAt: nowIso })).filter(Boolean);
  },

  markItemExpired(id: string) {
    return this.updateItem(id, {
      status: 'expired',
      updatedAt: new Date().toISOString(),
    });
  },

  clearAllItems() {
    sqliteDb.exec('DELETE FROM items;');
    return true;
  },

  // Preferences
  getPreferences() {
    const defaults = {
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
        id, diet, reminderLeadDays, morningDigestEnabled, morningDigestTime, defaultStorage, updatedAt
      ) VALUES (
        'default', @diet, @reminderLeadDays, @morningDigestEnabled, @morningDigestTime, @defaultStorage, @updatedAt
      )
    `);
    stmt.run({
      diet: merged.diet,
      reminderLeadDays: merged.reminderLeadDays,
      morningDigestEnabled: merged.morningDigestEnabled ? 1 : 0,
      morningDigestTime: merged.morningDigestTime,
      defaultStorage: merged.defaultStorage,
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

    for (const item of items) {
      if (item.source === 'barcode' || item.source === 'receipt') {
        totalScansLogged++;
      }

      if (item.status === 'active') {
        activeCount++;
        const exp = new Date(item.estimatedExpiryDate);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) {
          urgentCount++;
        } else {
          freshCount++;
        }
      } else if (item.status === 'used') {
        usedCount++;
        if (item.price !== null && !isNaN(item.price)) {
          moneySavedRs += item.price;
        } else {
          unpricedUsedCount++;
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
    };
  },
};

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
    usedAt: row.usedAt || undefined,
    source: row.source,
    barcode: row.barcode || undefined,
    notes: row.notes || undefined,
    imageUrl: row.imageUrl || undefined,
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}
