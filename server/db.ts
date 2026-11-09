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
    originalQuantity REAL,
    savedMoney REAL DEFAULT 0,
    usedAt TEXT,
    source TEXT NOT NULL,
    barcode TEXT,
    notes TEXT,
    imageUrl TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// Safe migrations for existing SQLite databases
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN originalQuantity REAL;'); } catch {}
try { sqliteDb.exec('ALTER TABLE items ADD COLUMN savedMoney REAL DEFAULT 0;'); } catch {}

sqliteDb.exec(`
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
      imageUrl: item.imageUrl ?? null,
      createdAt: item.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO items (
        id, name, category, quantity, unit, purchaseDate, estimatedExpiryDate,
        printedExpiryDate, storage, price, status, originalQuantity, savedMoney, usedAt, source, barcode, notes, imageUrl, createdAt, updatedAt
      ) VALUES (
        @id, @name, @category, @quantity, @unit, @purchaseDate, @estimatedExpiryDate,
        @printedExpiryDate, @storage, @price, @status, @originalQuantity, @savedMoney, @usedAt, @source, @barcode, @notes, @imageUrl, @createdAt, @updatedAt
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
      imageUrl: (updates.imageUrl !== undefined ? updates.imageUrl : existing.imageUrl) ?? null,
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
      return this.updateItem(id, {
        status: 'used',
        quantity: 0,
        originalQuantity: origQty,
        savedMoney: newSavedMoney > 0 ? newSavedMoney : (existing.price || 0),
        usedAt: nowIso,
        notes: updatedNotes,
      });
    } else {
      // Partially used - remains active with updated quantity!
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
    const nowIso = new Date().toISOString();
    return ids.map((id) => this.markItemUsed(id, { portion: 1.0, usedPortionName: 'Finished 100%' })).filter(Boolean);
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

      // Accumulate any money saved from partial or full uses
      if (item.savedMoney && item.savedMoney > 0) {
        moneySavedRs += item.savedMoney;
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
      image: recipe.image ?? 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80',
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
};

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
    createdAt: row.createdAt || undefined,
    updatedAt: row.updatedAt || undefined,
  };
}

