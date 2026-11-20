/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Full-Stack Entry Point
 * Runs hardened Express backend with SQLite database and mounts Vite middlewares in dev mode.
 */

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { apiRouter } from './server/apiRouter.ts';
import { securityHeadersMiddleware } from './server/security.ts';

dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Hide Express server fingerprint and trust reverse proxy headers
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Global security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
  app.use(securityHeadersMiddleware);

  // Mount Hardened Backend API
  app.use('/api', apiRouter);

  // Serve public static assets (dotfiles blocked)
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir, { dotfiles: 'deny', index: false }));

  // Development vs Production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: !hmrDisabled,
        ws: { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { dotfiles: 'deny' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Centralized error handler — never expose stack traces
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'Request payload too large.' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ success: false, error: 'Malformed JSON request body.' });
    }
    console.error('[FreshTrack][ServerError]', err);
    return res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[FreshTrack] Server running at http://0.0.0.0:${PORT}`);
    console.log(`[FreshTrack] Security middleware & SQLite engine active`);
  });
}

startServer().catch((err) => {
  console.error('[FreshTrack] Failed to start server:', err);
  process.exit(1);
});
