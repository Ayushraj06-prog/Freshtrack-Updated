/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Workspace Security Gate
 * Enforces server-verified authentication before rendering any inventory, supplier, or financial data.
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, KeyRound, Leaf, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react';
import { api } from '../services/api';
import { InstallAppModal, usePWAInstall } from './PWAInstallButton';

interface SecurityGateProps {
  mode: 'loading' | 'setup' | 'locked';
  source: 'env' | 'database' | 'unclaimed';
  onAuthenticated: () => Promise<void>;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({ mode, source, onAuthenticated }) => {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const isSetup = mode === 'setup';
  const meetsLength = passcode.trim().length >= 8;
  const hasMix = /[A-Za-z]/.test(passcode) && /[0-9]/.test(passcode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSetup) {
      if (!meetsLength) {
        setError('Passcode must be at least 8 characters long.');
        return;
      }
      if (passcode !== confirmPasscode) {
        setError('Passcodes do not match.');
        return;
      }
    } else if (!passcode.trim()) {
      setError('Enter your workspace passcode to unlock.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSetup) {
        await api.setupWorkspacePasscode(passcode.trim());
      } else {
        await api.loginWorkspace(passcode.trim());
      }
      setPasscode('');
      setConfirmPasscode('');
      await onAuthenticated();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-dvh pt-safe pb-safe bg-[#F4F6F0] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E2E8DE] rounded-3xl p-8 w-full max-w-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#2C5F2D] text-white flex items-center justify-center mx-auto">
            <Leaf className="w-6 h-6 text-[#A3E635]" />
          </div>
          <p className="font-extrabold text-stone-900 text-base">Verifying Workspace Security</p>
          <p className="text-xs text-stone-500">Checking encrypted session with FreshTrack backend...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pt-safe pb-safe bg-[#F4F6F0] flex items-center justify-center p-4 selection:bg-[#2C5F2D] selection:text-white">
      <div className="w-full max-w-md bg-white border border-[#E2E8DE] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#E2E8DE]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#2C5F2D] flex items-center justify-center text-white shrink-0">
              <Leaf className="w-5 h-5 text-[#A3E635]" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-[#2C5F2D]">FreshTrack India</h1>
              <p className="text-xs text-stone-500">Zero-Waste Kitchen &amp; Commercial Inventory</p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center shrink-0">
            {isSetup ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
        </div>

        {/* Title & Context */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
            {isSetup ? 'Secure Your Kitchen Workspace' : 'Workspace Locked'}
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {isSetup
              ? 'Create an admin passcode to protect your inventory, suppliers, invoices, and AI scanner routes. Your passcode is salted and hashed with scrypt on the server.'
              : source === 'env'
              ? 'Sign in with the server ADMIN_PASSCODE to access inventory, invoices, and procurement controls.'
              : 'Enter your workspace passcode to unlock your inventory, vendor records, and analytics.'}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="workspace-passcode" className="text-xs font-bold text-stone-700 block">
              {isSetup ? 'Create Admin Passcode' : 'Workspace Passcode'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="workspace-passcode"
                type={showPasscode ? 'text' : 'password'}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={isSetup ? 'At least 8 characters (letters + numbers)' : 'Enter passcode'}
                className="w-full pl-10 pr-11 py-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE] text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2C5F2D] focus:bg-white"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowPasscode((prev) => !prev)}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isSetup && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="confirm-passcode" className="text-xs font-bold text-stone-700 block">
                  Confirm Passcode
                </label>
                <input
                  id="confirm-passcode"
                  type={showPasscode ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Re-enter passcode"
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE] text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#2C5F2D] focus:bg-white"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500 pt-0.5">
                <span className={`flex items-center gap-1 font-semibold ${meetsLength ? 'text-emerald-700' : 'text-stone-400'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  8+ characters
                </span>
                <span className={`flex items-center gap-1 font-semibold ${hasMix ? 'text-emerald-700' : 'text-stone-400'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Letters &amp; numbers recommended
                </span>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#2C5F2D] hover:bg-[#204721] disabled:opacity-60 text-white font-extrabold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isSetup ? <ShieldCheck className="w-4 h-4 text-[#A3E635]" /> : <Lock className="w-4 h-4 text-[#A3E635]" />}
            <span>
              {submitting
                ? isSetup
                  ? 'Securing Workspace...'
                  : 'Verifying...'
                : isSetup
                ? 'Set Passcode & Enter Workspace'
                : 'Unlock Workspace'}
            </span>
          </button>
        </form>

        {/* Security Assurance Footer */}
        <div className="pt-4 border-t border-[#E2E8DE] space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-500">
            <div className="bg-[#F7F8F4] rounded-xl px-3 py-2 border border-[#E2E8DE]/70">
              <span className="font-bold text-stone-700 block">Salted scrypt + HMAC</span>
              <span>Signed 24h session tokens</span>
            </div>
            <div className="bg-[#F7F8F4] rounded-xl px-3 py-2 border border-[#E2E8DE]/70">
              <span className="font-bold text-stone-700 block">Brute-Force Protected</span>
              <span>Rate-limited &amp; CSRF guarded</span>
            </div>
          </div>

          {!isInstalled && (
            <button
              type="button"
              onClick={async () => {
                if (isInstallable) {
                  const ok = await install();
                  if (!ok) setShowInstallModal(true);
                } else {
                  setShowInstallModal(true);
                }
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] border border-[#6B9B4F]/40 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span>Install FreshTrack as Mobile App</span>
            </button>
          )}
        </div>
      </div>

      <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
};
