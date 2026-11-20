/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Server-Side Authentication & Session Security
 * - Passcode hashing via Node crypto.scryptSync + random 16-byte salt + timingSafeEqual
 * - Supports ADMIN_PASSCODE environment secret (highest precedence) with a one-time
 *   first-run setup/claim flow stored hashed in SQLite when ADMIN_PASSCODE is unset
 * - Signed HMAC-SHA256 Bearer session tokens with expiry and logout revocation
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';

const MIN_PASSCODE_LENGTH = 8;
const MAX_PASSCODE_LENGTH = 128;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Ephemeral in-memory signing secret fallback if SESSION_SECRET env var is not configured
const SESSION_SIGNING_SECRET =
  (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : null) || crypto.randomBytes(32).toString('hex');

// Revoked session token IDs (cleared periodically after expiry)
const revokedTokens = new Map<string, number>();

const revokeCleanup = setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of revokedTokens.entries()) {
    if (exp <= now) revokedTokens.delete(jti);
  }
}, 15 * 60 * 1000);
revokeCleanup.unref?.();

function getEnvPasscode(): string | null {
  const val = process.env.ADMIN_PASSCODE;
  return val && val.trim().length > 0 ? val.trim() : null;
}

/** Hash a user passcode with scrypt and a 16-byte cryptographically random salt */
export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/** Constant-time verification against a stored scrypt hash */
export function verifyScryptHash(passcode: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(passcode, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Constant-time verification against a plain environment secret */
function verifyEnvPasscode(input: string, envSecret: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(envSecret).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Validate passcode policy */
export function validatePasscodePolicy(passcode: unknown): { ok: boolean; error?: string } {
  if (typeof passcode !== 'string') {
    return { ok: false, error: 'Passcode must be a text value.' };
  }
  const trimmed = passcode.trim();
  if (trimmed.length < MIN_PASSCODE_LENGTH) {
    return { ok: false, error: `Passcode must be at least ${MIN_PASSCODE_LENGTH} characters long.` };
  }
  if (trimmed.length > MAX_PASSCODE_LENGTH) {
    return { ok: false, error: `Passcode must be under ${MAX_PASSCODE_LENGTH} characters.` };
  }
  return { ok: true };
}

/** Verify candidate passcode against env secret (priority) or stored SQLite scrypt hash */
export function verifyPasscode(candidate: string): boolean {
  if (typeof candidate !== 'string' || !candidate.trim()) return false;
  const envPass = getEnvPasscode();
  if (envPass) {
    return verifyEnvPasscode(candidate.trim(), envPass);
  }
  const config = db.getAuthConfig();
  if (!config?.passcodeHash) return false;
  return verifyScryptHash(candidate.trim(), config.passcodeHash);
}

/** Check whether workspace security has been claimed/configured */
export function getSecurityStatus() {
  const envPass = getEnvPasscode();
  if (envPass) {
    return { configured: true, source: 'env' as const };
  }
  const config = db.getAuthConfig();
  if (config?.passcodeHash) {
    return { configured: true, source: 'database' as const };
  }
  return { configured: false, source: 'unclaimed' as const };
}

interface SessionPayload {
  sub: 'workspace-admin';
  jti: string;
  iat: number;
  exp: number;
}

/** Issue a signed HMAC-SHA256 Bearer session token */
export function issueSessionToken(): { token: string; expiresAt: string } {
  const now = Date.now();
  const exp = now + TOKEN_TTL_MS;
  const payload: SessionPayload = {
    sub: 'workspace-admin',
    jti: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');
  return {
    token: `${encoded}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

/** Verify a Bearer session token in constant time */
export function verifySessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBufA = Buffer.from(providedSig);
  const sigBufB = Buffer.from(expectedSig);
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (
      payload.sub !== 'workspace-admin' ||
      typeof payload.jti !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() >= payload.exp) return null;
    if (revokedTokens.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token || null;
  }
  return null;
}

export function revokeSessionToken(token: string | null | undefined): void {
  const payload = verifySessionToken(token);
  if (payload) {
    revokedTokens.set(payload.jti, payload.exp);
  }
}

/** Express middleware enforcing server-side Bearer authentication on protected routes */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please unlock your workspace to continue.',
    });
  }
  (req as any).authSession = payload;
  next();
}
