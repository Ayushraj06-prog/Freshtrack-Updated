/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Server Security Layer
 * Security headers, same-origin validation, sliding-window rate limiting,
 * URL/input sanitization, and prototype-pollution protection.
 */

import type { Request, Response, NextFunction } from 'express';

/** Apply hardened HTTP security headers while remaining compatible with embedded previews */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), payment=(), usb=(), camera=(self), microphone=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content-Security-Policy tuned for Vite React SPA + AI Studio iframe + OCR camera previews
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' ws: wss: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://aistudio.google.com https://*.aistudio.google.com https://*.google.com https://*.run.app",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Prevent caching of sensitive API responses
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}

/** Reject cross-origin state-changing requests (CSRF / unauthorized cross-site API abuse) */
export function sameOriginMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const origin = req.headers.origin;
  if (!origin) {
    // Non-browser or same-origin requests without Origin header are allowed when authenticated
    return next();
  }

  try {
    const parsedOrigin = new URL(origin);
    const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
    const expectedHost = (forwardedHost || req.headers.host || '').toLowerCase();
    const originHost = parsedOrigin.host.toLowerCase();

    const isLocalOrigin =
      (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1') &&
      (expectedHost.startsWith('localhost') || expectedHost.startsWith('127.0.0.1'));

    if (originHost === expectedHost || isLocalOrigin) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Cross-origin request blocked by server security policy.',
    });
  } catch {
    return res.status(403).json({
      success: false,
      error: 'Invalid request origin.',
    });
  }
}

interface RateBucket {
  count: number;
  resetAt: number;
}

/** Extract stable client IP respecting reverse proxies */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/** Lightweight sliding-window in-memory rate limiter */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
}) {
  const buckets = new Map<string, RateBucket>();

  // Periodic cleanup to avoid unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.max(30_000, options.windowMs));
  cleanupInterval.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${getClientIp(req)}:${req.baseUrl || ''}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: options.message,
        retryAfterSeconds: retryAfterSec,
      });
    }

    return next();
  };
}

/** Strip dangerous prototype-pollution keys recursively from untrusted JSON payloads */
export function stripUnsafeKeys<T>(input: T, depth = 0): T {
  if (depth > 12 || input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripUnsafeKeys(item, depth + 1)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = stripUnsafeKeys(value, depth + 1);
  }
  return clean as T;
}

/** Sanitize plain text fields (remove control characters & enforce reasonable max length) */
export function sanitizeText(value: unknown, maxLen = 300): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

/**
 * Validate dynamic image URLs to block javascript:, vbscript:, data:text/html, and SVG script payloads.
 * Allows only https:, http:, safe relative '/' paths, and raster base64 data URIs (png/jpeg/webp).
 */
export function sanitizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048 && !trimmed.startsWith('data:image/')) return null;

  // Safe local relative path (block protocol-relative '//evil.com')
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Strict raster data URL allowlist (never allow SVG/HTML data URLs)
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 5_000_000 ? trimmed : null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/** Return safe client-facing error message without leaking internal paths or SQLite details */
export function safeServerError(context: string, err: unknown): string {
  console.error(`[Security][${context}]`, err);
  return 'An internal server error occurred. Please try again.';
}
