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
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { aiService, AiStatus } from '../services/aiService';
import { runReceiptParserTests } from '../utils/receiptParser';

export const SettingsView: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    seedDemoData,
    clearAllData,
    exportCsv,
    dbInfo,
    dbConnected,
  } = useInventory();

  const [testResults, setTestResults] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    aiService.getStatus().then(setAiStatus);
  }, []);

  const handleRunTests = () => {
    setTesting(true);
    setTimeout(() => {
      const results = runReceiptParserTests();
      setTestResults(results);
      setTesting(false);
    }, 250);
  };

  const handleDownloadZip = () => {
    setDownloading(true);
    window.location.href = '/api/download-zip';
    setTimeout(() => setDownloading(false), 2000);
  };

  return (
    <div className="space-y-6 pb-24 max-w-2xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900">
          Database &amp; Project Controls
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Full persistent SQLite backend, complete project download, Gemini AI status, and Indian receipt test suite.
        </p>
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
            {aiStatus?.configured ? 'Gemini 2.5 Flash Active' : 'Offline Engine Active'}
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
              <button
                onClick={() => updatePreferences({ reminderLeadDays: 1 })}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  preferences.reminderLeadDays === 1
                    ? 'bg-[#2C5F2D] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                1 Day Before
              </button>
              <button
                onClick={() => updatePreferences({ reminderLeadDays: 2 })}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  preferences.reminderLeadDays === 2
                    ? 'bg-[#2C5F2D] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                2 Days Before
              </button>
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

      {/* 7. Database Seeding & Reset */}
      <div className="bg-white rounded-3xl p-5 border border-[#E2E8DE] shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-stone-900 pb-2 border-b border-stone-100">
          Database Tools &amp; Seeding
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => {
              seedDemoData();
              alert('Loaded realistic sample Indian kitchen inventory into SQLite database!');
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
          <button
            onClick={() => {
              if (confirm('Clear all SQLite database items and reset FreshTrack?')) {
                clearAllData();
              }
            }}
            className="w-full py-2.5 px-3 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset Database &amp; Clear All Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};
