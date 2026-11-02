/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack Full-Stack Entry Point
 * Runs Express backend with SQLite database and mounts Vite middlewares in dev mode.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { apiRouter } from './server/apiRouter.ts';
import { generateProjectZip } from './server/zipBuilder.ts';

dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Generate initial project zip file in background
  try {
    generateProjectZip();
  } catch (e: any) {
    console.warn('Initial ZIP prebuild deferred:', e.message);
  }

  // Mount Backend API
  app.use('/api', apiRouter);

  // Serve public directory
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  // Development vs Production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FreshTrack] 🚀 Server running at http://0.0.0.0:${PORT}`);
    console.log(`[FreshTrack] 🗄️ Database: SQLite engine active in data/freshtrack.db`);
  });
}

startServer().catch((err) => {
  console.error('[FreshTrack] Failed to start server:', err);
  process.exit(1);
});
