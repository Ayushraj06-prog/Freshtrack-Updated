/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Utensils,
  PlusCircle,
  Download,
  Flame,
  CheckCircle2,
  Package,
  Layers,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getRemainingDays } from '../data/shelfLifeData';
import { InventoryItem } from '../types/inventory';
import { UseItemModal } from './UseItemModal';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenAddModal }) => {
  const { items, stats, markAsUsed, dbInfo } = useInventory();
  const [usingItem, setUsingItem] = useState<InventoryItem | null>(null);

  const urgentItems = items
    .filter((i) => i.status === 'active' && getRemainingDays(i.estimatedExpiryDate) <= 2)
    .sort((a, b) => (a.estimatedExpiryDate > b.estimatedExpiryDate ? 1 : -1));

  // Category breakdown
  const categoryCounts = items
    .filter((i) => i.status === 'active')
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Welcome / Hero Banner */}
      <div className="bg-gradient-to-br from-[#2C5F2D] via-[#204721] to-[#163517] rounded-3xl p-6 text-white shadow-xl shadow-[#2C5F2D]/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
                Zero-Waste Indian Kitchen
              </span>
              <span className="text-white/80 text-xs font-semibold">
                ● SQLite DB: {dbInfo?.itemsCount ?? 0} items tracked
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Total Household Savings: ₹{stats.moneySavedRs.toLocaleString('en-IN')}
            </h1>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl leading-relaxed">
              Every vegetable and grocery item marked as consumed prevents waste and adds directly to your household monthly savings.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2.5 rounded-2xl bg-[#A3E635] text-[#2C5F2D] hover:bg-[#b5f548] text-xs font-extrabold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Items</span>
            </button>

            <button
              onClick={() => setActiveTab('recipes')}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 backdrop-blur-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Utensils className="w-4 h-4" />
              <span>Cook Ideas</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
            <div className="flex items-center justify-between text-white/70 text-xs font-medium">
              <span>Money Saved</span>
              <TrendingUp className="w-4 h-4 text-[#A3E635]" />
            </div>
            <div className="text-xl font-black mt-1">₹{stats.moneySavedRs}</div>
            <div className="text-[10px] text-white/70 mt-0.5">
              {stats.usedCount} items saved from bin
            </div>
          </div>

          <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
            <div className="flex items-center justify-between text-white/70 text-xs font-medium">
              <span>Zero-Waste Streak</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black mt-1">{stats.zeroWasteStreakDays} Days</div>
            <div className="text-[10px] text-white/70 mt-0.5">
              {stats.savingPercentage}% waste prevented
            </div>
          </div>

          <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
            <div className="flex items-center justify-between text-white/70 text-xs font-medium">
              <span>Urgent Attention</span>
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
            <div className="text-xl font-black mt-1">{stats.urgentCount} items</div>
            <div className="text-[10px] text-white/70 mt-0.5">Expiring in ≤ 48 hours</div>
          </div>

          <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
            <div className="flex items-center justify-between text-white/70 text-xs font-medium">
              <span>Active in Kitchen</span>
              <Package className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-xl font-black mt-1">{stats.activeCount} items</div>
            <div className="text-[10px] text-white/70 mt-0.5">
              {stats.freshCount} items completely fresh
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Expiry Action Card */}
      {urgentItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-extrabold text-sm text-amber-950">
                Action Required: {urgentItems.length} items need cooking soon!
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('recipes')}
              className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>See Recipe Ideas &rarr;</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {urgentItems.slice(0, 3).map((item) => {
              const rem = getRemainingDays(item.estimatedExpiryDate);
              return (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-stone-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-amber-700 font-semibold">
                      {rem <= 0 ? 'Expires Today!' : `${rem} day${rem > 1 ? 's' : ''} left`}
                    </p>
                  </div>
                  <button
                    onClick={() => setUsingItem(item)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                  >
                    Cooked / Use
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Download & Local Running Card */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">
              Download Full Project Code &amp; SQLite Database
            </h3>
          </div>
          <p className="text-xs text-stone-500 max-w-xl">
            Get the full source code (Node.js + Express + React + SQLite) packaged in a clean, self-contained ZIP file ready to run on any computer with <code>npm install &amp;&amp; npm run dev</code>.
          </p>
        </div>

        <a
          href="/api/download-zip"
          download="freshtrack-kitchen-app.zip"
          className="px-4 py-2.5 rounded-2xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold text-xs shadow-md shadow-[#2C5F2D]/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#A3E635]" />
          <span>Download .ZIP Archive</span>
        </a>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">Kitchen Staples Breakdown</h3>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="text-xs font-bold text-[#2C5F2D] hover:underline cursor-pointer"
          >
            View Inventory &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <div
              key={cat}
              onClick={() => setActiveTab('inventory')}
              className="p-3 bg-stone-50 hover:bg-[#EAF3E6] border border-stone-200 hover:border-[#6B9B4F] rounded-2xl transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-stone-800 block truncate">{cat}</span>
              <span className="text-[11px] text-stone-500 mt-0.5 block">{count} item{count > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cooking & Portion Modal */}
      {usingItem && (
        <UseItemModal
          item={usingItem}
          onClose={() => setUsingItem(null)}
          onConfirm={(id, options) => markAsUsed(id, options)}
          onOpenCustomRecipe={() => {
            setUsingItem(null);
            setActiveTab('recipes');
          }}
        />
      )}
    </div>
  );
};
