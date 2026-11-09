/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack Backend API Router
 * Endpoints for SQLite Database CRUD, Gemini AI, Analytics, and Project ZIP Download.
 */

import express from 'express';
import fs from 'node:fs';
import { db } from './db.ts';
import { aiController } from './ai.ts';
import { generateProjectZip } from './zipBuilder.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json({ limit: '25mb' }));

// 1. Health & Database Diagnostic Info
apiRouter.get('/health', (req, res) => {
  const engine = db.getEngine();
  res.json({
    status: 'ok',
    database: engine,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

apiRouter.get('/db/info', (req, res) => {
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
});

// 2. Download Entire Project as ZIP
apiRouter.get('/download-zip', (req, res) => {
  try {
    const zipPath = generateProjectZip();
    const stat = fs.statSync(zipPath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="freshtrack-kitchen-app.zip"`
    );
    res.setHeader('Content-Length', stat.size);

    const readStream = fs.createReadStream(zipPath);
    readStream.pipe(res);
  } catch (err: any) {
    console.error('Failed to create/send zip:', err);
    res.status(500).json({ success: false, error: 'Could not generate zip archive: ' + err.message });
  }
});

// 3. Inventory Items CRUD
apiRouter.get('/items', (req, res) => {
  try {
    const items = db.getAllItems();
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/items', (req, res) => {
  try {
    if (Array.isArray(req.body.items)) {
      const created = db.insertItems(req.body.items);
      return res.status(201).json({ success: true, count: created.length, items: created });
    }
    const created = db.insertItem(req.body);
    res.status(201).json({ success: true, item: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.put('/items/:id', (req, res) => {
  try {
    const updated = db.updateItem(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/items/:id', (req, res) => {
  try {
    db.deleteItem(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/items/:id/use', (req, res) => {
  try {
    const updated = db.markItemUsed(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/items/:id/expire', (req, res) => {
  try {
    const updated = db.markItemExpired(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/items/bulk-use', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids must be an array' });
    }
    const updated = db.markItemsUsed(ids);
    res.json({ success: true, count: updated.length, items: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/items/seed', (req, res) => {
  try {
    const { seedKitchenData } = require('./db.ts');
    seedKitchenData();
    const items = db.getAllItems();
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/items/clear', (req, res) => {
  try {
    db.clearAllItems();
    res.json({ success: true, message: 'All items deleted from SQLite database' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Preferences
apiRouter.get('/preferences', (req, res) => {
  try {
    const preferences = db.getPreferences();
    res.json({ success: true, preferences });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.put('/preferences', (req, res) => {
  try {
    const updated = db.updatePreferences(req.body);
    res.json({ success: true, preferences: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Aggregate Analytics & Savings Stats
apiRouter.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Gemini AI Endpoints
apiRouter.get('/ai/status', (req, res) => {
  res.json(aiController.getStatus());
});

apiRouter.post('/ai/parse-receipt', async (req, res) => {
  try {
    const items = await aiController.parseReceipt(req.body);
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ai/suggest-recipes', async (req, res) => {
  try {
    const { expiringItems = [], allKitchenItems = [], diet = 'veg' } = req.body;
    const recipes = await aiController.suggestRecipes({ expiringItems, allKitchenItems, diet });
    res.json({ success: true, count: recipes.length, recipes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ai/estimate-shelf-life', async (req, res) => {
  try {
    const result = await aiController.estimateShelfLife(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ai/scan-product', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }
    const product = await aiController.scanProductPhoto({ imageBase64, mimeType });
    res.json({ success: true, product });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

