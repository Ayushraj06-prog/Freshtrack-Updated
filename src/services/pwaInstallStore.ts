/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Global PWA Install & Service Worker Manager
 * Captures `beforeinstallprompt` from app boot (even before login/SecurityGate)
 * and registers the auto-updating service worker for standalone mobile installation.
 */

import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DevicePlatform = 'android' | 'ios' | 'desktop';

export interface PWAState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  platform: DevicePlatform;
  isEmbedded: boolean;
  swReady: boolean;
  offlineReady: boolean;
}

type Listener = (state: PWAState) => void;

function detectInitialState(): PWAState {
  if (typeof window === 'undefined') {
    return {
      deferredPrompt: null,
      isInstalled: false,
      isIOS: false,
      isAndroid: false,
      platform: 'desktop',
      isEmbedded: false,
      swReady: false,
      offlineReady: false,
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIPadOS =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  const isIOS = /iphone|ipad|ipod/.test(ua) || isIPadOS;
  const isAndroid = /android/.test(ua);
  const platform: DevicePlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  let isEmbedded = false;
  try {
    isEmbedded = window.self !== window.top;
  } catch {
    isEmbedded = true;
  }

  return {
    deferredPrompt: null,
    isInstalled: isStandalone,
    isIOS,
    isAndroid,
    platform,
    isEmbedded,
    swReady: false,
    offlineReady: false,
  };
}

let state: PWAState = detectInitialState();
let initialized = false;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch {}
  }
}

function updateState(patch: Partial<PWAState>) {
  state = { ...state, ...patch };
  emit();
}

export function initPWA(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Capture Chrome/Edge/Android native install prompt immediately at startup
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    updateState({ deferredPrompt: e as BeforeInstallPromptEvent });
  });

  window.addEventListener('appinstalled', () => {
    updateState({ isInstalled: true, deferredPrompt: null });
  });

  // Listen for display-mode changes (e.g., installed and launched standalone)
  try {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) updateState({ isInstalled: true, deferredPrompt: null });
    };
    mq.addEventListener?.('change', onChange);
  } catch {}

  // Register Service Worker with auto-update
  try {
    registerSW({
      immediate: true,
      onRegisteredSW() {
        updateState({ swReady: true });
      },
      onOfflineReady() {
        updateState({ swReady: true, offlineReady: true });
      },
    });
  } catch {
    // Graceful fallback if SW is unavailable in restricted context
  }
}

export function getPWAState(): PWAState {
  return state;
}

export function subscribePWAState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function triggerNativeInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!state.deferredPrompt) return 'unavailable';
  try {
    await state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      updateState({ isInstalled: true, deferredPrompt: null });
      return 'accepted';
    }
    return 'dismissed';
  } catch {
    return 'unavailable';
  }
}
