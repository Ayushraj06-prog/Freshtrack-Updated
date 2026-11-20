/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Client Session Token Manager
 * Stores ephemeral HMAC-SHA256 Bearer token in sessionStorage (cleared when tab closes),
 * injects Authorization headers on all API requests, and broadcasts 401 lock events.
 */

const SESSION_TOKEN_KEY = 'freshtrack_session_token';

type UnauthorizedListener = () => void;
const listeners = new Set<UnauthorizedListener>();

let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored) {
      inMemoryToken = stored;
      return stored;
    }
  } catch {
    // sessionStorage may be restricted in some sandboxed contexts
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Fallback to in-memory only
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyUnauthorized() {
  clearAuthToken();
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

/** Authenticated fetch wrapper that attaches Bearer token and handles 401 lockouts */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    const urlStr = typeof input === 'string' ? input : input.toString();
    // Do not trigger global lock broadcast on login/change-passcode validation errors
    if (!urlStr.includes('/api/auth/login') && !urlStr.includes('/api/auth/change-passcode')) {
      notifyUnauthorized();
    }
  }

  return res;
}
