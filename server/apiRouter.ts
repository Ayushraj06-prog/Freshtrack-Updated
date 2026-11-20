/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Hardened Backend API Router
 * - Workspace Passcode Authentication (scrypt + HMAC-SHA256 Bearer sessions)
 * - Sliding-window rate limiting (global API, auth brute-force protection, AI quota, ZIP downloads)
 * - Same-origin enforcement on state-changing requests
 * - Recursive prototype-pollution key stripping & bounded payload sizes
 * - Safe sanitized error responses (no internal SQLite/stack leakage)
 */

import express from 'express';
import fs from 'node:fs';
import { db, seedKitchenData } from './db.ts';
import { aiController } from './ai.ts';
import { generateProjectZip } from './zipBuilder.ts';
import {
  createRateLimiter,
  sameOriginMiddleware,
  stripUnsafeKeys,
  safeServerError,
} from './security.ts';
import {
  extractBearerToken,
  getSecurityStatus,
  hashPasscode,
  issueSessionToken,
  requireAuth,
  revokeSessionToken,
  validatePasscodePolicy,
  verifyPasscode,
  verifySessionToken,
} from './auth.ts';

export const apiRouter = express.Router();

// Rate limiters
const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 240,
  message: 'Too many requests. Please slow down and try again shortly.',
});

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
});

const aiRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  message: 'AI scan rate limit reached. Please wait a few minutes before retrying.',
});

const zipRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 6,
  message: 'Archive download limit reached. Please try again in a few minutes.',
});

// Tight default JSON body parser (2MB), with larger 12MB parser strictly for multimodal vision/restore routes
const standardJson = express.json({ limit: '2mb' });
const largePayloadJson = express.json({ limit: '12mb' });

const LARGE_BODY_PATHS = new Set([
  '/ai/parse-receipt',
  '/ai/scan-product',
  '/restore',
]);

apiRouter.use((req, res, next) => {
  if (LARGE_BODY_PATHS.has(req.path)) {
    return largePayloadJson(req, res, next);
  }
  return standardJson(req, res, next);
});

// Strip prototype-pollution keys from all JSON bodies
apiRouter.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = stripUnsafeKeys(req.body);
  }
  next();
});

// Enforce same-origin on state-changing requests + general rate limit
apiRouter.use(sameOriginMiddleware);
apiRouter.use(generalApiLimiter);

function clampLimit(raw: unknown, defaultVal: number, maxVal = 500): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return defaultVal;
  return Math.min(Math.floor(n), maxVal);
}

// ============================================================
// PUBLIC ENDPOINTS (Health + Authentication Handshake Only)
// ============================================================

// 1. Minimal Health Check (no internal filesystem paths or inventory counts leaked)
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// 2. Authentication Status, First-Run Claim, Login & Logout
apiRouter.get('/auth/status', (req, res) => {
  try {
    const status = getSecurityStatus();
    const token = extractBearerToken(req);
    const session = verifySessionToken(token);
    res.json({
      success: true,
      configured: status.configured,
      source: status.source,
      authenticated: Boolean(session),
      expiresAt: session ? new Date(session.exp).toISOString() : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('auth.status', err) });
  }
});

// First-run workspace passcode claim (only allowed once while workspace is unclaimed)
apiRouter.post('/auth/setup', authRateLimiter, (req, res) => {
  try {
    const status = getSecurityStatus();
    if (status.configured) {
      return res.status(409).json({
        success: false,
        error: 'Workspace passcode is already configured. Please sign in instead.',
      });
    }
    const { passcode } = req.body || {};
    const policy = validatePasscodePolicy(passcode);
    if (!policy.ok) {
      return res.status(400).json({ success: false, error: policy.error });
    }
    const hashed = hashPasscode(passcode.trim());
    db.setPasscodeHash(hashed);
    const session = issueSessionToken();
    db.logActivity('security', 'Workspace Security Enabled', 'Admin passcode configured via scrypt');
    return res.status(201).json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      source: 'database',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: safeServerError('auth.setup', err) });
  }
});

apiRouter.post('/auth/login', authRateLimiter, (req, res) => {
  try {
    const status = getSecurityStatus();
    if (!status.configured) {
      return res.status(409).json({
        success: false,
        error: 'Workspace passcode has not been set up yet.',
      });
    }
    const { passcode } = req.body || {};
    if (typeof passcode !== 'string' || !verifyPasscode(passcode)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid workspace passcode.',
      });
    }
    const session = issueSessionToken();
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      source: status.source,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: safeServerError('auth.login', err) });
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  try {
    const token = extractBearerToken(req);
    revokeSessionToken(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('auth.logout', err) });
  }
});

// ============================================================
// AUTHENTICATION BARRIER — ALL ROUTES BELOW REQUIRE VALID SESSION
// ============================================================
apiRouter.use(requireAuth);

apiRouter.post('/auth/change-passcode', authRateLimiter, (req, res) => {
  try {
    const status = getSecurityStatus();
    if (status.source === 'env') {
      return res.status(403).json({
        success: false,
        error: 'Passcode is managed by the server ADMIN_PASSCODE environment secret.',
      });
    }
    const { currentPasscode, newPasscode } = req.body || {};
    if (typeof currentPasscode !== 'string' || !verifyPasscode(currentPasscode)) {
      return res.status(401).json({
        success: false,
        error: 'Current passcode is incorrect.',
      });
    }
    const policy = validatePasscodePolicy(newPasscode);
    if (!policy.ok) {
      return res.status(400).json({ success: false, error: policy.error });
    }
    db.setPasscodeHash(hashPasscode(newPasscode.trim()));
    // Revoke previous token and issue a fresh token
    revokeSessionToken(extractBearerToken(req));
    const session = issueSessionToken();
    db.logActivity('security', 'Workspace Passcode Changed', 'Updated scrypt passcode hash');
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: safeServerError('auth.changePasscode', err) });
  }
});

// Database Diagnostic Info (authenticated)
apiRouter.get('/db/info', (_req, res) => {
  try {
    const engine = db.getEngine();
    const allItems = db.getAllItems();
    res.json({
      engine: engine.type,
      filePath: engine.path,
      itemsCount: allItems.length,
      activeCount: allItems.filter((i) => i.status === 'active').length,
      usedCount: allItems.filter((i) => i.status === 'used').length,
      expiredCount: allItems.filter((i) => i.status === 'expired').length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('db.info', err) });
  }
});

// Download Sanitized Source Archive as ZIP (authenticated + rate-limited; excludes .env & SQLite DB)
apiRouter.get('/download-zip', zipRateLimiter, (_req, res) => {
  try {
    const zipPath = generateProjectZip();
    const stat = fs.statSync(zipPath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="freshtrack-kitchen-app.zip"');
    res.setHeader('Content-Length', stat.size);

    const readStream = fs.createReadStream(zipPath);
    readStream.on('error', (streamErr) => {
      console.error('[Security][zipStream]', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to stream archive.' });
      }
    });
    readStream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('download-zip', err) });
  }
});

// 3. Inventory Items CRUD
apiRouter.get('/items', (_req, res) => {
  try {
    const items = db.getAllItems();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('items.get', err) });
  }
});

apiRouter.post('/items', (req, res) => {
  try {
    if (Array.isArray(req.body?.items)) {
      if (req.body.items.length > 200) {
        return res.status(400).json({ success: false, error: 'Maximum 200 items per batch.' });
      }
      const created = db.insertItems(req.body.items);
      return res.status(201).json({ success: true, count: created.length, items: created });
    }
    if (!req.body?.name || typeof req.body.name !== 'string') {
      return res.status(400).json({ success: false, error: 'Item name is required.' });
    }
    const created = db.insertItem(req.body);
    return res.status(201).json({ success: true, item: created });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.post', err) });
  }
});

apiRouter.put('/items/:id', (req, res) => {
  try {
    const updated = db.updateItem(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.put', err) });
  }
});

apiRouter.delete('/items/:id', (req, res) => {
  try {
    db.deleteItem(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('items.delete', err) });
  }
});

apiRouter.post('/items/:id/use', (req, res) => {
  try {
    const { portion, usedQuantity, usedPortionName } = req.body || {};
    const updated = db.markItemUsed(req.params.id, { portion, usedQuantity, usedPortionName });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.use', err) });
  }
});

apiRouter.post('/items/:id/expire', (req, res) => {
  try {
    const updated = db.markItemExpired(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.expire', err) });
  }
});

apiRouter.post('/items/:id/freeze', (req, res) => {
  try {
    const updated = db.freezeAndExtendItem(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.freeze', err) });
  }
});

apiRouter.post('/items/bulk-use', (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length > 500) {
      return res.status(400).json({ success: false, error: 'ids must be an array (max 500)' });
    }
    const updated = db.markItemsUsed(ids);
    return res.json({ success: true, count: updated.length, items: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.bulkUse', err) });
  }
});

apiRouter.post('/items/bulk-expire', (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length > 500) {
      return res.status(400).json({ success: false, error: 'ids must be an array (max 500)' });
    }
    const updated = db.markItemsExpired(ids);
    return res.json({ success: true, count: updated.length, items: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.bulkExpire', err) });
  }
});

apiRouter.post('/items/bulk-freeze', (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length > 500) {
      return res.status(400).json({ success: false, error: 'ids must be an array (max 500)' });
    }
    const updated = db.markItemsFrozen(ids);
    return res.json({ success: true, count: updated.length, items: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.bulkFreeze', err) });
  }
});

apiRouter.post('/items/seed', (_req, res) => {
  try {
    seedKitchenData();
    const items = db.getAllItems();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('items.seed', err) });
  }
});

apiRouter.post('/items/clear', (_req, res) => {
  try {
    db.clearAllItems();
    res.json({ success: true, message: 'All items deleted from database' });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('items.clear', err) });
  }
});

// 4. Preferences
apiRouter.get('/preferences', (_req, res) => {
  try {
    const preferences = db.getPreferences();
    res.json({ success: true, preferences });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('preferences.get', err) });
  }
});

apiRouter.put('/preferences', (req, res) => {
  try {
    const updated = db.updatePreferences(req.body || {});
    res.json({ success: true, preferences: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('preferences.put', err) });
  }
});

// 5. Aggregate Analytics & Savings Stats
apiRouter.get('/stats', (_req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('stats.get', err) });
  }
});

// 6. Gemini AI Endpoints (authenticated + rate-limited)
apiRouter.get('/ai/status', (_req, res) => {
  res.json(aiController.getStatus());
});

apiRouter.post('/ai/parse-receipt', aiRateLimiter, async (req, res) => {
  try {
    const items = await aiController.parseReceipt(req.body || {});
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('ai.parseReceipt', err) });
  }
});

apiRouter.post('/ai/suggest-recipes', aiRateLimiter, async (req, res) => {
  try {
    const { expiringItems = [], allKitchenItems = [], diet = 'veg' } = req.body || {};
    const recipes = await aiController.suggestRecipes({
      expiringItems: Array.isArray(expiringItems) ? expiringItems.slice(0, 40) : [],
      allKitchenItems: Array.isArray(allKitchenItems) ? allKitchenItems.slice(0, 80) : [],
      diet,
    });
    res.json({ success: true, count: recipes.length, recipes });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('ai.suggestRecipes', err) });
  }
});

apiRouter.post('/ai/estimate-shelf-life', aiRateLimiter, async (req, res) => {
  try {
    const result = await aiController.estimateShelfLife(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('ai.estimateShelfLife', err) });
  }
});

apiRouter.post('/ai/scan-product', aiRateLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }
    const product = await aiController.scanProductPhoto({ imageBase64, mimeType });
    return res.json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, error: safeServerError('ai.scanProduct', err) });
  }
});

// 7. Custom Customer Recipes
apiRouter.get('/recipes/custom', (_req, res) => {
  try {
    const recipes = db.getAllCustomRecipes();
    res.json({ success: true, count: recipes.length, recipes });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('recipes.get', err) });
  }
});

apiRouter.post('/recipes/custom', (req, res) => {
  try {
    const recipe = db.saveCustomRecipe(req.body || {});
    res.status(201).json({ success: true, recipe });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('recipes.post', err) });
  }
});

apiRouter.delete('/recipes/custom/:id', (req, res) => {
  try {
    db.deleteCustomRecipe(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('recipes.delete', err) });
  }
});

apiRouter.post('/recipes/custom/:id/cook', (req, res) => {
  try {
    const deductions = Array.isArray(req.body?.deductions) ? req.body.deductions.slice(0, 100) : [];
    const result = db.cookCustomRecipe(req.params.id, deductions);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('recipes.cook', err) });
  }
});

// 8. Restock / Need-to-Buy Procurement List
apiRouter.get('/restock', (_req, res) => {
  try {
    const items = db.getRestockList();
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('restock.get', err) });
  }
});

apiRouter.post('/restock', (req, res) => {
  try {
    const item = db.saveRestockItem(req.body || {});
    res.status(201).json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('restock.post', err) });
  }
});

apiRouter.put('/restock/:id', (req, res) => {
  try {
    const updated = db.updateRestockItem(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Restock item not found' });
    }
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('restock.put', err) });
  }
});

apiRouter.delete('/restock/:id', (req, res) => {
  try {
    db.deleteRestockItem(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('restock.delete', err) });
  }
});

apiRouter.post('/restock/sync', (_req, res) => {
  try {
    const result = db.syncNeededRestockItems();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('restock.sync', err) });
  }
});

apiRouter.post('/restock/bulk-stock', (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length > 500) {
      return res.status(400).json({ success: false, error: 'ids must be an array (max 500)' });
    }
    const result = db.bulkStockRestockItems(ids);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('restock.bulkStock', err) });
  }
});

apiRouter.post('/restock/:id/stock', (req, res) => {
  try {
    const result = db.stockRestockItem(req.params.id, req.body || {});
    if (!result) {
      return res.status(404).json({ success: false, error: 'Restock item not found' });
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('restock.stock', err) });
  }
});

// 9. Weekly Meal & Prep Planner
apiRouter.get('/meal-plans', (_req, res) => {
  try {
    const plans = db.getMealPlans();
    res.json({ success: true, count: plans.length, plans });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('mealPlans.get', err) });
  }
});

apiRouter.post('/meal-plans', (req, res) => {
  try {
    const plan = db.saveMealPlan(req.body || {});
    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('mealPlans.post', err) });
  }
});

apiRouter.delete('/meal-plans/:id', (req, res) => {
  try {
    db.deleteMealPlan(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('mealPlans.delete', err) });
  }
});

apiRouter.post('/meal-plans/clear', (_req, res) => {
  try {
    db.clearMealPlans();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('mealPlans.clear', err) });
  }
});

// 10. Activity & Audit Log
apiRouter.get('/activity', (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 40, 200);
    const logs = db.getActivityLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('activity.get', err) });
  }
});

// 11. Full JSON Backup & Restore
apiRouter.get('/backup', (_req, res) => {
  try {
    const snapshot = db.exportBackupJson();
    res.json({ success: true, snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('backup.get', err) });
  }
});

apiRouter.post('/restore', (req, res) => {
  try {
    const payload = req.body?.snapshot || req.body;
    const restored = db.restoreBackupJson(payload);
    res.json({ success: true, snapshot: restored });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('backup.restore', err) });
  }
});

// 12. Suppliers & Vendors Directory
apiRouter.get('/suppliers', (_req, res) => {
  try {
    const suppliers = db.getSuppliers();
    res.json({ success: true, count: suppliers.length, suppliers });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('suppliers.get', err) });
  }
});

apiRouter.post('/suppliers', (req, res) => {
  try {
    const supplier = db.saveSupplier(req.body || {});
    res.status(201).json({ success: true, supplier });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('suppliers.post', err) });
  }
});

apiRouter.delete('/suppliers/:id', (req, res) => {
  try {
    db.deleteSupplier(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('suppliers.delete', err) });
  }
});

// 13. Cold-Chain & FSSAI Storage Temperature / Hygiene Logs
apiRouter.get('/storage-logs', (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 60, 300);
    const logs = db.getStorageLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('storageLogs.get', err) });
  }
});

apiRouter.post('/storage-logs', (req, res) => {
  try {
    const log = db.addStorageLog(req.body || {});
    res.status(201).json({ success: true, log });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('storageLogs.post', err) });
  }
});

apiRouter.delete('/storage-logs/:id', (req, res) => {
  try {
    db.deleteStorageLog(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('storageLogs.delete', err) });
  }
});

// 14. Inter-Zone / Branch Stock Transfer
apiRouter.post('/items/:id/transfer', (req, res) => {
  try {
    const result = db.transferItem(req.params.id, req.body || {});
    if (!result) return res.status(404).json({ success: false, error: 'Item not found' });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: safeServerError('items.transfer', err) });
  }
});

// 15. Physical Stocktake & Variance Reconciliation
apiRouter.post('/stocktake', (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries.slice(0, 500) : [];
    const result = db.reconcileStocktake(entries);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('stocktake', err) });
  }
});

// 16. Daily Kitchen Checklists & Shift Handover Notes
apiRouter.get('/checklists', (_req, res) => {
  try {
    const checklists = db.getChecklists();
    res.json({ success: true, count: checklists.length, checklists });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('checklists.get', err) });
  }
});

apiRouter.post('/checklists', (req, res) => {
  try {
    const item = db.saveChecklistItem(req.body || {});
    res.status(201).json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('checklists.post', err) });
  }
});

apiRouter.post('/checklists/reset', (_req, res) => {
  try {
    const checklists = db.resetDailyChecklists();
    res.json({ success: true, checklists });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('checklists.reset', err) });
  }
});

apiRouter.post('/checklists/:id/toggle', (req, res) => {
  try {
    const item = db.toggleChecklistItem(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Checklist item not found' });
    return res.json({ success: true, item });
  } catch (err) {
    return res.status(500).json({ success: false, error: safeServerError('checklists.toggle', err) });
  }
});

apiRouter.delete('/checklists/:id', (req, res) => {
  try {
    db.deleteChecklistItem(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('checklists.delete', err) });
  }
});

// 17. Root-Cause Waste Logs
apiRouter.get('/waste-logs', (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 100, 500);
    const logs = db.getWasteLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('wasteLogs.get', err) });
  }
});

apiRouter.post('/waste-logs', (req, res) => {
  try {
    const result = db.logWaste(req.body || {});
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('wasteLogs.post', err) });
  }
});

apiRouter.delete('/waste-logs/:id', (req, res) => {
  try {
    db.deleteWasteLog(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('wasteLogs.delete', err) });
  }
});

// 18. Purchase Invoices & GRN Spend Ledger
apiRouter.get('/invoices', (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 100, 500);
    const invoices = db.getInvoices(limit);
    res.json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('invoices.get', err) });
  }
});

apiRouter.post('/invoices', (req, res) => {
  try {
    const invoice = db.saveInvoice(req.body || {});
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    res.status(400).json({ success: false, error: safeServerError('invoices.post', err) });
  }
});

apiRouter.post('/invoices/:id/status', (req, res) => {
  try {
    const status = req.body?.paymentStatus;
    if (!['paid', 'pending', 'overdue'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid paymentStatus' });
    }
    const invoice = db.updateInvoiceStatus(req.params.id, status);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    return res.json({ success: true, invoice });
  } catch (err) {
    return res.status(500).json({ success: false, error: safeServerError('invoices.status', err) });
  }
});

apiRouter.delete('/invoices/:id', (req, res) => {
  try {
    db.deleteInvoice(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, error: safeServerError('invoices.delete', err) });
  }
});
