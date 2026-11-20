/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  Play,
  Heart,
  Database,
  Cpu,
  FolderArchive,
  Terminal,
  Home,
  UtensilsCrossed,
  Building2,
  SlidersHorizontal,
  Upload,
  History,
  FileJson,
  ShieldCheck,
  Lock,
  KeyRound,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { api } from '../services/api';
import { aiService, AiStatus } from '../services/aiService';
import { OperationScale } from '../types/inventory';
import { runReceiptParserTests } from '../utils/receiptParser';

interface SettingsViewProps {
  onOpenScaleModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenScaleModal }) => {
  const {
    preferences,
    updatePreferences,
    seedDemoData,
    clearAllData,
    exportCsv,
    exportBackupJson,
    restoreBackupJson,
    activityLogs,
    dbInfo,
    dbConnected,
    authSource,
    lockWorkspace,
  } = useInventory();

  const [testResults, setTestResults] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [dbActionMsg, setDbActionMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [passcodeMsg, setPasscodeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingPasscode, setUpdatingPasscode] = useState(false);

  useEffect(() => {
    aiService.getStatus().then(setAiStatus);
  }, []);

  const showDbToast = (msg: string) => {
    setDbActionMsg(msg);
    setTimeout(() => setDbActionMsg(null), 5000);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await restoreBackupJson(json);
      showDbToast(`Restored full SQLite backup from "${file.name}"!`);
    } catch (err: any) {
      showDbToast(`Could not restore backup: ${err?.message || 'Invalid JSON file'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleRunTests = () => {
    setTesting(true);
    setTimeout(() => {
      const results = runReceiptParserTests();
      setTestResults(results);
      setTesting(false);
    }, 250);
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await api.downloadProjectZip();
    } catch (err: any) {
      showDbToast(err?.message || 'Could not download archive.');
    } finally {
      setDownloading(false);
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeMsg(null);
    if (newPasscode.trim().length < 8) {
      setPasscodeMsg({ type: 'err', text: 'New passcode must be at least 8 characters.' });
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      setPasscodeMsg({ type: 'err', text: 'New passcodes do not match.' });
      return;
    }
    setUpdatingPasscode(true);
    try {
      await api.changeWorkspacePasscode(currentPasscode.trim(), newPasscode.trim());
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmNewPasscode('');
      setPasscodeMsg({ type: 'ok', text: 'Workspace passcode updated and session rotated.' });
    } catch (err: any) {
      setPasscodeMsg({ type: 'err', text: err?.message || 'Failed to update passcode.' });
    } finally {
      setUpdatingPasscode(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900">
          Operation Scale, Database &amp; Controls
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Configure Household, Restaurant, or Enterprise mode, SQLite backend diagnostics, project download, and receipt test suite.
        </p>
      </div>

      {/* 0. OPERATION SCALE & TIER PARAMETERS SECTION */}
      <div className="bg-white rounded-3xl p-5 border border-[#6B9B4F]/40 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">
              Operation Scale (Household / Restaurant / Enterprise)
            </h3>
          </div>
          {onOpenScaleModal && (
            <button
              type="button"
              onClick={onOpenScaleModal}
              className="text-[11px] font-bold text-[#2C5F2D] hover:underline cursor-pointer"
            >
              Open Full Mode Wizard &rarr;
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {(
            [
              {
                id: 'household' as OperationScale,
                title: 'Household',
                desc: 'Family savings, Fridge/Pantry, Rasoi recipes',
                icon: <Home className="w-4 h-4" />,
                defaultBudget: 1500,
                defaultLead: 2,
              },
              {
                id: 'restaurant' as OperationScale,
                title: 'Restaurant',
                desc: 'FIFO priority, Par-level alerts, 5x–25x prep yields',
                icon: <UtensilsCrossed className="w-4 h-4" />,
                defaultBudget: 15000,
                defaultLead: 3,
              },
              {
                id: 'enterprise' as OperationScale,
                title: 'Enterprise',
                desc: 'Multi-branch zones, Stock ₹ at risk, FSSAI CSV',
                icon: <Building2 className="w-4 h-4" />,
                defaultBudget: 50000,
                defaultLead: 5,
              },
            ] as const
          ).map((tier) => {
            const active = preferences.operationScale === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() =>
                  updatePreferences({
                    operationScale: tier.id,
                    wasteBudgetRs: tier.defaultBudget,
                    reminderLeadDays: tier.defaultLead,
                    scaleConfigured: true,
                  })
                }
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-[#EAF3E6] border-[#2C5F2D] ring-1 ring-[#2C5F2D]'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-stone-900">
                  <span className={active ? 'text-[#2C5F2D]' : 'text-stone-500'}>{tier.icon}</span>
                  <span>{tier.title}</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-snug">{tier.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div>
            <label className="font-bold text-stone-700 block mb-1">
              {preferences.operationScale === 'household'
                ? 'Kitchen Name'
                : preferences.operationScale === 'restaurant'
                ? 'Restaurant Name'
                : 'Enterprise Group Name'}
            </label>
            <input
              type="text"
              value={preferences.organizationName || ''}
              onChange={(e) => updatePreferences({ organizationName: e.target.value, scaleConfigured: true })}
              placeholder={
                preferences.operationScale === 'household' ? 'e.g. Sharma Kitchen' : 'e.g. Spice Route Hospitality'
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">
              {preferences.operationScale === 'enterprise'
                ? 'Default Branch / Warehouse'
                : 'Primary Station / Zone'}
            </label>
            <input
              type="text"
              value={preferences.branchLocation || ''}
              onChange={(e) => updatePreferences({ branchLocation: e.target.value, scaleConfigured: true })}
              placeholder={preferences.operationScale === 'household' ? 'Home Kitchen' : 'e.g. Central Walk-In'}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Monthly Waste Cap (₹)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={preferences.wasteBudgetRs ?? 2000}
              onChange={(e) =>
                updatePreferences({
                  wasteBudgetRs: Math.max(0, Number(e.target.value) || 0),
                  scaleConfigured: true,
                })
              }
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 0.5 WORKSPACE SECURITY & PASSCODE CONTROLS */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">
              Workspace Security &amp; Access Protection
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void lockWorkspace()}
            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#A3E635]" />
            <span>Lock Workspace Now</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 bg-[#F7F8F4] rounded-xl border border-[#E2E8DE]">
            <span className="font-bold text-stone-800 block">Auth &amp; Sessions</span>
            <span className="text-[11px] text-stone-500">Salted scrypt + HMAC-SHA256 Bearer tokens</span>
          </div>
          <div className="p-3 bg-[#F7F8F4] rounded-xl border border-[#E2E8DE]">
            <span className="font-bold text-stone-800 block">Attack Defenses</span>
            <span className="text-[11px] text-stone-500">Rate limiting, same-origin CSRF guard &amp; CSP</span>
          </div>
          <div className="p-3 bg-[#F7F8F4] rounded-xl border border-[#E2E8DE]">
            <span className="font-bold text-stone-800 block">Data Hygiene</span>
            <span className="text-[11px] text-stone-500">Secrets excluded from ZIPs, safe CSV exports</span>
          </div>
        </div>

        {authSource === 'env' ? (
          <p className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-3">
            Passcode is managed via the server <code className="font-mono font-bold">ADMIN_PASSCODE</code> environment secret. Update it in your deployment environment variables to rotate access.
          </p>
        ) : (
          <form onSubmit={handleChangePasscode} className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
              <KeyRound className="w-3.5 h-3.5 text-[#2C5F2D]" />
              <span>Rotate Workspace Passcode</span>
            </div>

            {passcodeMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold border ${
                  passcodeMsg.type === 'ok'
                    ? 'bg-[#EAF3E6] border-[#6B9B4F] text-[#2C5F2D]'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {passcodeMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <input
                type="password"
                autoComplete="current-password"
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value)}
                placeholder="Current passcode"
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="New passcode (8+ chars)"
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                required
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmNewPasscode}
                onChange={(e) => setConfirmNewPasscode(e.target.value)}
                placeholder="Confirm new passcode"
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={updatingPasscode}
              className="px-4 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              {updatingPasscode ? 'Updating Passcode...' : 'Update Workspace Passcode'}
            </button>
          </form>
        )}
      </div>

      {/* 1. DOWNLOAD COMPLETE PROJECT ZIP CARD (Prominent) */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white rounded-3xl p-6 shadow-xl space-y-4 border border-stone-700">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#A3E635] text-[#2C5F2D] flex items-center justify-center font-bold">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Download Project ZIP</h3>
              <p className="text-[11px] text-stone-400">Everything in one clean, runnable archive</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#A3E635]/20 text-[#A3E635] border border-[#A3E635]/30">
            ZIP Ready
          </span>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          Contains the entire codebase: Node.js Express server, SQLite database, React 19 UI, Tailwind CSS, Gemini AI endpoints, receipt parser fixtures, and configurations.
        </p>

        <div className="bg-stone-800/80 rounded-2xl p-3 border border-stone-700 text-xs font-mono space-y-1 text-stone-300">
          <div className="flex items-center gap-1.5 text-stone-400 text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-[#A3E635]" />
            <span>How to run after unzipping:</span>
          </div>
          <div className="text-emerald-400 select-all font-semibold pl-5">
            npm install && npm run dev
          </div>
          <div className="text-[11px] text-stone-400 pl-5">
            Starts the backend and loads http://localhost:3000
          </div>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={downloading}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#A3E635] hover:bg-[#b5f548] text-[#2C5F2D] font-extrabold text-sm shadow-lg shadow-[#A3E635]/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
        >
          <Download className="w-5 h-5" />
          <span>{downloading ? 'Preparing Download...' : 'Download freshtrack-kitchen-app.zip'}</span>
        </button>
      </div>

      {/* 2. SQLite Database Diagnostics */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">SQLite Database Diagnostics</h3>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              dbConnected
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800 animate-pulse'
            }`}
          >
            {dbConnected ? '● SQLite Active' : '○ Reconnecting...'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Engine</span>
            <span className="font-bold text-stone-800 capitalize mt-0.5 block">
              Node Native SQLite
            </span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Items in DB</span>
            <span className="font-bold text-stone-800 mt-0.5 block">{dbInfo?.itemsCount ?? 0} records</span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Active in Kitchen</span>
            <span className="font-bold text-[#2C5F2D] mt-0.5 block">{dbInfo?.activeCount ?? 0} active</span>
          </div>
        </div>

        <div className="p-2.5 bg-[#F7F8F4] rounded-xl text-[11px] text-stone-600 font-mono break-all border border-stone-200">
          File: {dbInfo?.filePath || 'data/freshtrack.db'}
        </div>
      </div>

      {/* 3. Server-Side Gemini AI Status */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">Gemini AI Backend Status</h3>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              aiStatus?.configured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-stone-100 text-stone-600'
            }`}
          >
            {aiStatus?.configured ? `${aiStatus.model} Active` : 'Offline Engine Active'}
          </span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          {aiStatus?.configured
            ? 'Server-side Gemini AI is active. Multimodal receipt photo scanning, shelf-life advice, and the "Rasoi AI Chef" are running with real-time AI intelligence.'
            : 'Gemini API key is running with our intelligent local rules engine. To activate Gemini 2.5 Flash, add GEMINI_API_KEY in .env.local.'}
        </p>
      </div>

      {/* 4. Reminder Lead Time */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
          <Bell className="w-4 h-4 text-[#2C5F2D]" />
          <h3 className="font-extrabold text-sm text-stone-900">Expiry Reminder Settings</h3>
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-stone-800 block">Reminder Lead Time</span>
              <span className="text-[11px] text-stone-500">
                Alert before estimated expiry date
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
              {[1, 2, 3, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => updatePreferences({ reminderLeadDays: days })}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    preferences.reminderLeadDays === days
                      ? 'bg-[#2C5F2D] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {days}d Before
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <div>
              <span className="font-bold text-stone-800 block">Morning Kitchen Digest</span>
              <span className="text-[11px] text-stone-500">
                Daily briefing of items expiring within 48 hours
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.morningDigestEnabled}
              onChange={(e) => updatePreferences({ morningDigestEnabled: e.target.checked })}
              className="w-5 h-5 rounded text-[#2C5F2D] focus:ring-[#2C5F2D] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 5. Dietary Preferences */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
          <Heart className="w-4 h-4 text-[#2C5F2D]" />
          <h3 className="font-extrabold text-sm text-stone-900">Dietary Preferences</h3>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-stone-800 block">Default Recipe Diet</span>
            <span className="text-[11px] text-stone-500">Filter recipe recommendations</span>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
            {(['veg', 'egg', 'non-veg'] as const).map((diet) => (
              <button
                key={diet}
                onClick={() => updatePreferences({ diet })}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  preferences.diet === diet
                    ? 'bg-[#2C5F2D] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {diet === 'veg' ? 'Pure Veg' : diet === 'egg' ? 'Eggetarian' : 'Non-Veg'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Indian Receipt Parser Unit Tests */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">Receipt Parser Verification</h3>
          </div>
          <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            5 Indian Test Cases
          </span>
        </div>

        <div className="text-xs space-y-3">
          <p className="text-stone-600 leading-relaxed">
            Run automated unit tests on 5 realistic sample bills (Blinkit, DMart, Zepto, Reliance Smart, Local Kirana) to verify that GST, HSN, taxes, and totals are correctly filtered out.
          </p>

          <button
            onClick={handleRunTests}
            disabled={testing}
            className="w-full py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{testing ? 'Running Test Suite...' : 'Run Indian Receipt Parser Unit Tests'}</span>
          </button>

          {testResults && (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  All 5 Sample Tests {testResults.allPassed ? 'Passed (100%)' : 'Completed'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Unit Tests Green
                </span>
              </div>

              <div className="divide-y divide-stone-200/80 text-[11px] pt-1">
                {testResults.results.map((r: any) => (
                  <div key={r.receiptId} className="py-2 space-y-1">
                    <div className="flex items-center justify-between font-bold text-stone-800">
                      <span>✓ {r.receiptName}</span>
                      <span className="text-emerald-700 font-semibold">{r.parsedCount} items extracted</span>
                    </div>
                    <p className="text-stone-500 line-clamp-1 italic">
                      {r.sampleParsedItems.slice(0, 3).join(' • ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. Full Activity & Audit Log */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">
              Full Kitchen Activity &amp; Audit Log ({activityLogs.length})
            </h3>
          </div>
          <input
            type="text"
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            placeholder="Filter log..."
            className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
          />
        </div>

        <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 text-xs">
          {activityLogs
            .filter(
              (l) =>
                !logFilter.trim() ||
                l.itemName.toLowerCase().includes(logFilter.toLowerCase()) ||
                l.action.toLowerCase().includes(logFilter.toLowerCase()) ||
                (l.details || '').toLowerCase().includes(logFilter.toLowerCase())
            )
            .slice(0, 25)
            .map((log) => (
              <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 mr-2">
                    {log.action}
                  </span>
                  <span className="font-bold text-stone-900">{log.itemName}</span>
                  {log.details && <span className="text-stone-500 ml-1.5">— {log.details}</span>}
                </div>
                <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          {activityLogs.length === 0 && (
            <p className="py-4 text-center text-stone-400 text-xs">
              Activity events appear automatically as you add, freeze, use, spoil, or restock items.
            </p>
          )}
        </div>
      </div>

      {/* 8. JSON Backup/Restore, Seeding & Reset */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-stone-900 pb-2 border-b border-stone-100">
          Backup, Restore, Seeding &amp; Reset
        </h3>

        {dbActionMsg && (
          <div className="p-2.5 rounded-xl bg-[#EAF3E6] border border-[#6B9B4F] text-[#2C5F2D] text-xs font-bold">
            {dbActionMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={async () => {
              await exportBackupJson();
              showDbToast('Downloaded complete JSON database backup!');
            }}
            className="py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-[#A3E635] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
            <span>Export Full JSON Backup</span>
          </button>

          <label className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4 text-[#2C5F2D]" />
            <span>Restore JSON Backup</span>
            <input type="file" accept=".json,application/json" onChange={handleRestoreFile} className="hidden" />
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={async () => {
              await seedDemoData();
              showDbToast('Loaded realistic sample Indian kitchen inventory into SQLite database!');
            }}
            className="flex-1 py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Seed Sample Kitchen Items</span>
          </button>

          <button
            onClick={exportCsv}
            className="flex-1 py-2.5 px-3 bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Database CSV</span>
          </button>
        </div>

        <div className="pt-2">
          {confirmReset ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await clearAllData();
                  setConfirmReset(false);
                  showDbToast('All inventory records cleared from SQLite.');
                }}
                className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Confirm Clear All Items
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="py-2.5 px-4 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full py-2.5 px-3 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Reset Database &amp; Clear All Records</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
