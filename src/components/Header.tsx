/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bell,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Leaf,
  Database,
  Download,
  Home,
  UtensilsCrossed,
  Building2,
  Search,
  Lock,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { api } from '../services/api';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMorningDigest: () => void;
  onOpenAddModal: () => void;
  onOpenScaleModal: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenMorningDigest,
  onOpenAddModal,
  onOpenScaleModal,
  onOpenCommandPalette,
}) => {
  const { stats, notificationLog, dbConnected, dbInfo, preferences, lockWorkspace } = useInventory();
  const [showNotifications, setShowNotifications] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const scaleMeta =
    preferences.operationScale === 'enterprise'
      ? { label: 'Enterprise', icon: <Building2 className="w-3.5 h-3.5 text-amber-600" />, style: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' }
      : preferences.operationScale === 'restaurant'
      ? { label: 'Restaurant', icon: <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-700" />, style: 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100' }
      : { label: 'Household', icon: <Home className="w-3.5 h-3.5 text-[#2C5F2D]" />, style: 'bg-[#F7F8F4] text-stone-800 border-[#E2E8DE] hover:bg-[#EAF3E6]' };

  const handleDownloadZip = async () => {
    if (downloadingZip) return;
    setDownloadingZip(true);
    try {
      await api.downloadProjectZip();
    } catch (err) {
      console.error('ZIP download failed:', err);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8DE] shadow-xs">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div
          onClick={() => setActiveTab('inventory')}
          className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-[#2C5F2D] flex items-center justify-center text-white shadow-md shadow-[#2C5F2D]/20 group-hover:scale-105 transition-transform">
            <Leaf className="w-5 h-5 text-[#A3E635]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-[#2C5F2D]">
                FreshTrack
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#EAF3E6] text-[#2C5F2D] border border-[#6B9B4F]/30">
                India
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium -mt-0.5 hidden xs:block truncate max-w-[170px]">
              {preferences.organizationName
                ? preferences.organizationName
                : preferences.operationScale === 'enterprise'
                ? 'Enterprise Ops • ₹ Valuation'
                : preferences.operationScale === 'restaurant'
                ? 'Commercial FIFO Kitchen'
                : 'Zero Waste Kitchen • ₹ Savings'}
            </p>
          </div>
        </div>

        {/* Status Indicators & Download ZIP Button */}
        <div className="flex items-center gap-2">
          {/* Quick Search / Voice Command Palette Trigger */}
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title="Quick Search, Commands & Voice Stock Entry (Ctrl+K)"
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#F7F8F4] hover:bg-[#EAF3E6] text-stone-700 border border-[#E2E8DE] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-[#2C5F2D]" />
              <span className="hidden lg:inline">Quick Add / Search</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold text-stone-500 bg-white border border-stone-200 rounded-md">
                ⌘K
              </kbd>
            </button>
          )}

          {/* In-App PWA Install Button (hidden when already installed) */}
          <PWAInstallButton />

          {/* Operation Scale Switcher Pill */}
          <button
            type="button"
            onClick={onOpenScaleModal}
            title="Switch between Household, Restaurant, or Enterprise scale"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${scaleMeta.style}`}
          >
            {scaleMeta.icon}
            <span>{scaleMeta.label}</span>
          </button>

          {/* SQLite DB Status */}
          <div
            onClick={() => setActiveTab('settings')}
            title={dbConnected ? `SQLite Database: data/freshtrack.db (${dbInfo?.itemsCount ?? 0} items)` : 'Reconnecting to Database...'}
            className="hidden sm:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer items-center gap-1.5 bg-stone-50 border border-[#E2E8DE] text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-emerald-600' : 'text-amber-500 animate-pulse'}`} />
            <span>
              {dbConnected ? `SQLite DB (${dbInfo?.itemsCount ?? 0})` : 'Connecting...'}
            </span>
          </div>

          {/* Money Saved Counter */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="hidden md:flex px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#EAF3E6] text-[#2C5F2D] cursor-pointer hover:bg-[#d8ebd1] transition-colors items-center gap-1.5 border border-[#6B9B4F]/20"
          >
            <span className="font-extrabold">₹{stats.moneySavedRs.toLocaleString('en-IN')}</span>
            <span className="text-[11px] font-medium text-stone-600">Saved</span>
          </div>

          {/* Urgent Items Alert Pill */}
          {stats.urgentCount > 0 ? (
            <div
              onClick={() => setActiveTab('inventory')}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 cursor-pointer hover:bg-amber-200 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{stats.urgentCount} Expiring</span>
            </div>
          ) : (
            <div
              onClick={() => setActiveTab('inventory')}
              className="hidden lg:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Kitchen Fresh</span>
            </div>
          )}

          {/* Download Project ZIP Button (Authenticated) */}
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            title="Download sanitized project source archive (excludes secrets & database)"
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5 text-[#A3E635]" />
            <span className="hidden sm:inline">{downloadingZip ? 'Packaging...' : 'Download ZIP'}</span>
            <span className="sm:hidden">ZIP</span>
          </button>

          {/* Morning Digest Briefing */}
          <button
            type="button"
            onClick={onOpenMorningDigest}
            title="Open Morning Kitchen Digest"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold bg-[#2C5F2D]/10 text-[#2C5F2D] hover:bg-[#2C5F2D]/15 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2C5F2D]" />
            <span className="hidden md:inline">Digest</span>
          </button>

          {/* Lock Workspace */}
          <button
            type="button"
            onClick={() => void lockWorkspace()}
            title="Lock Workspace"
            aria-label="Lock Workspace"
            className="p-2 rounded-xl text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
          >
            <Lock className="w-4 h-4 text-stone-600" />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl text-stone-700 hover:bg-stone-100 active:scale-95 transition-all relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-stone-600" />
              {stats.urgentCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-stone-200 p-4 z-50 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h4 className="font-bold text-sm text-stone-800">Kitchen Reminders</h4>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    SQLite Synced
                  </span>
                </div>

                <div className="py-2 space-y-2.5 max-h-72 overflow-y-auto">
                  {notificationLog.length > 0 ? (
                    notificationLog.map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 rounded-xl bg-[#F7F8F4] border border-[#E2E8DE] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-800">{n.title}</span>
                          <span className="text-[10px] text-stone-400">{n.timestamp}</span>
                        </div>
                        <p className="text-stone-600 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-stone-500">
                      <CheckCircle className="w-8 h-8 text-[#6B9B4F] mx-auto mb-2 opacity-80" />
                      All items fresh! No urgent expiries in the next 48 hours.
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100 text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setActiveTab('recipes');
                    }}
                    className="text-xs font-semibold text-[#2C5F2D] hover:underline cursor-pointer"
                  >
                    View Recipes for Expiring Items &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
