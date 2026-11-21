/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Mobile & Desktop PWA Install Experience
 * - Captures native Android/Chrome/Edge `beforeinstallprompt` via global store
 * - Provides guided Android & iOS Safari "Add to Home Screen" modal when native prompt isn't active
 * - Auto-hides install prompts when already launched in standalone app mode
 */

import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  X,
  WifiOff,
  Share,
  Download,
  MoreVertical,
  PlusSquare,
  CheckCircle2,
  Copy,
  Check,
  Monitor,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  DevicePlatform,
  getPWAState,
  subscribePWAState,
  triggerNativeInstall,
  PWAState,
} from '../services/pwaInstallStore';

const BANNER_DISMISS_KEY = 'freshtrack_install_banner_dismissed';

export function usePWAInstall() {
  const [pwa, setPwa] = useState<PWAState>(() => getPWAState());

  useEffect(() => {
    setPwa(getPWAState());
    return subscribePWAState(setPwa);
  }, []);

  const install = async () => {
    const result = await triggerNativeInstall();
    return result === 'accepted';
  };

  return {
    isInstallable: Boolean(pwa.deferredPrompt),
    isInstalled: pwa.isInstalled,
    isIOS: pwa.isIOS,
    isAndroid: pwa.isAndroid,
    platform: pwa.platform,
    isEmbedded: pwa.isEmbedded,
    swReady: pwa.swReady,
    offlineReady: pwa.offlineReady,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, platform, isEmbedded, install } = usePWAInstall();
  const [activePlatform, setActivePlatform] = useState<DevicePlatform>(platform);
  const [installing, setInstalling] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActivePlatform(platform);
    }
  }, [isOpen, platform]);

  if (!isOpen) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleNativeInstall = async () => {
    setInstalling(true);
    try {
      const accepted = await install();
      if (accepted) {
        onClose();
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleCopyLink = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-pwa-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white border border-[#E2E8DE] p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="FreshTrack App Icon"
              className="w-12 h-12 rounded-2xl border border-[#E2E8DE] shrink-0"
            />
            <div>
              <h3 id="install-pwa-title" className="text-base font-extrabold text-stone-900">
                Install FreshTrack App
              </h3>
              <p className="text-xs text-stone-500">
                Add to your mobile home screen for full-screen, offline-ready access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install dialog"
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-[#EAF3E6] border border-[#6B9B4F]/40 text-[#2C5F2D] flex items-center gap-3 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>FreshTrack is already installed and running as a standalone app!</span>
          </div>
        ) : (
          <>
            {/* 1-Tap Native Install CTA when Chromium/Android prompt is ready */}
            {isInstallable && (
              <button
                type="button"
                onClick={handleNativeInstall}
                disabled={installing}
                className="w-full py-3 px-4 rounded-2xl bg-[#2C5F2D] hover:bg-[#204721] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-[#A3E635]" />
                <span>{installing ? 'Installing App...' : 'Install Now (1-Tap)'}</span>
              </button>
            )}

            {/* Embedded iframe notice */}
            {isEmbedded && !isInstallable && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                <span className="font-bold block mb-0.5">Tip for installing on your phone:</span>
                Copy the app link below and open it directly in <strong>Chrome (Android)</strong> or <strong>Safari (iPhone)</strong> so your browser shows the native Home Screen install prompt.
              </div>
            )}

            {/* Platform Switcher */}
            <div className="grid grid-cols-3 gap-1.5 bg-[#F4F6F0] p-1 rounded-2xl border border-[#E2E8DE] text-xs font-bold">
              {(
                [
                  { id: 'android', label: 'Android', icon: <Smartphone className="w-3.5 h-3.5" /> },
                  { id: 'ios', label: 'iPhone / iPad', icon: <Share className="w-3.5 h-3.5" /> },
                  { id: 'desktop', label: 'Desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePlatform(tab.id)}
                  className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activePlatform === tab.id
                      ? 'bg-[#2C5F2D] text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Platform-Specific Instructions */}
            {activePlatform === 'android' && (
              <ol className="text-xs text-stone-700 space-y-2.5 bg-[#F7F8F4] border border-[#E2E8DE] rounded-2xl p-4">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open FreshTrack in <strong>Google Chrome</strong>, <strong>Edge</strong>, or <strong>Samsung Internet</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap the browser menu <MoreVertical className="w-3.5 h-3.5 inline text-stone-900" /> in the top-right corner.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>) and confirm <strong>Install</strong>.
                  </span>
                </li>
              </ol>
            )}

            {activePlatform === 'ios' && (
              <ol className="text-xs text-stone-700 space-y-2.5 bg-[#F7F8F4] border border-[#E2E8DE] rounded-2xl p-4">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open FreshTrack in <strong>Safari</strong> on your iPhone or iPad.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Tap the <strong>Share</strong> <Share className="w-3.5 h-3.5 inline text-stone-900" /> button at the bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Scroll down, tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-stone-900" />, then tap <strong>Add</strong>.
                  </span>
                </li>
              </ol>
            )}

            {activePlatform === 'desktop' && (
              <ol className="text-xs text-stone-700 space-y-2.5 bg-[#F7F8F4] border border-[#E2E8DE] rounded-2xl p-4">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Open FreshTrack in <strong>Chrome</strong> or <strong>Microsoft Edge</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Click the <strong>Install icon</strong> on the right side of the browser address bar (or use the menu &rarr; <strong>Cast, save, and share &rarr; Install page as app</strong>).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2C5F2D] text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Or copy the link below to open and install FreshTrack on your mobile phone.
                  </span>
                </li>
              </ol>
            )}

            {/* Benefits Strip */}
            <div className="grid grid-cols-3 gap-2 text-[11px] text-center">
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <Smartphone className="w-4 h-4 text-[#2C5F2D] mx-auto mb-1" />
                <span className="font-bold text-stone-800 block">Full-Screen</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <Zap className="w-4 h-4 text-[#2C5F2D] mx-auto mb-1" />
                <span className="font-bold text-stone-800 block">1-Tap Launch</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <ShieldCheck className="w-4 h-4 text-[#2C5F2D] mx-auto mb-1" />
                <span className="font-bold text-stone-800 block">Offline Ready</span>
              </div>
            </div>

            {/* Copy App Link + Close */}
            <div className="flex items-center gap-2 pt-1">
              {appUrl && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link for Phone</span>
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowModal(true);
      }
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install FreshTrack as a standalone mobile or desktop app"
        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] border border-[#6B9B4F]/40 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>

      <InstallAppModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

/** Compact mobile/tablet banner surfaced prominently for mobile browser users */
export const MobileInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(BANNER_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showModal, setShowModal] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, '1');
    } catch {}
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) setShowModal(true);
      return;
    }
    setShowModal(true);
  };

  return (
    <>
      <div className="lg:hidden bg-[#2C5F2D] text-white rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3 border border-[#204721] shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/pwa-192x192.png"
            alt="FreshTrack"
            className="w-9 h-9 rounded-xl bg-white/10 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-extrabold leading-tight truncate">
              Use FreshTrack as a Mobile App
            </p>
            <p className="text-[11px] text-white/80 leading-tight truncate">
              Full-screen scanner, offline mode &amp; home-screen launch
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#A3E635] hover:bg-[#b5f548] text-[#2C5F2D] text-xs font-extrabold cursor-pointer transition-colors"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <InstallAppModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

/** Dedicated Install App Settings Card */
export const InstallAppSettingsCard: React.FC = () => {
  const { isInstallable, isInstalled, swReady, offlineReady, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleInstallAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) setShowModal(true);
      return;
    }
    setShowModal(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-[#6B9B4F]/40 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <img
            src="/pwa-192x192.png"
            alt="FreshTrack App"
            className="w-9 h-9 rounded-xl border border-[#E2E8DE]"
          />
          <div>
            <h3 className="font-extrabold text-sm text-stone-900">
              Install Mobile &amp; Desktop App (PWA)
            </h3>
            <p className="text-[11px] text-stone-500">
              Install on Android or iPhone home screen to use FreshTrack like a native app
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            isInstalled
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-[#EAF3E6] text-[#2C5F2D]'
          }`}
        >
          {isInstalled ? 'Installed Standalone' : 'Ready to Install'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-3 bg-[#F7F8F4] rounded-xl border border-[#E2E8DE]">
          <span className="font-bold text-stone-800 block">Display Mode</span>
          <span className="text-[11px] text-stone-500">
            {isInstalled ? 'Standalone App Window' : 'Browser Tab (Installable)'}
          </span>
        </div>
        <div className="p-3 bg-[#F7F8F4] rounded-xl border border-[#E2E8DE]">
          <span className="font-bold text-stone-800 block">Service Worker</span>
          <span className="text-[11px] text-stone-500">
            {offlineReady ? 'Offline Cache Active' : swReady ? 'Registered & Ready' : 'Auto-Update Enabled'}
          </span>
        </div>
        <div className="p-3 bg-[#F7F8F4] rounded-xl border border-[#E2E8DE]">
          <span className="font-bold text-stone-800 block">Supported Devices</span>
          <span className="text-[11px] text-stone-500">Android Chrome, iOS Safari, Desktop</span>
        </div>
      </div>

      {isInstalled ? (
        <div className="p-3 rounded-2xl bg-[#EAF3E6] border border-[#6B9B4F]/40 text-[#2C5F2D] text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>You are using the installed FreshTrack app in full-screen standalone mode.</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleInstallAction}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-[#A3E635]" />
            <span>{isInstallable ? 'Install FreshTrack App Now' : 'Install on Phone (Android / iOS)'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">App Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Mobile Link</span>
              </>
            )}
          </button>
        </div>
      )}

      <InstallAppModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-stone-900 text-amber-300 border border-amber-400/40 px-3.5 py-2 text-xs font-bold shadow-xl">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Viewing cached kitchen data</span>
    </div>
  );
};
