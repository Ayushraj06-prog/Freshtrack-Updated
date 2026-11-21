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
  Package,
  Layers,
  Building2,
  ClipboardCheck,
  SlidersHorizontal,
  IndianRupee,
  RefreshCw,
  ShoppingCart,
  History,
  Leaf,
  Droplets,
  CalendarPlus,
  TrendingDown,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { api } from '../services/api';
import { getRemainingDays } from '../data/shelfLifeData';
import { InventoryItem, WasteReason } from '../types/inventory';
import { UseItemModal } from './UseItemModal';
import { exportExpiryCalendarIcs } from '../utils/icsExport';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddModal: () => void;
  onOpenScaleModal?: () => void;
  onOpenRestockList?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  onOpenAddModal,
  onOpenScaleModal,
  onOpenRestockList,
}) => {
  const { items, restockList, activityLogs, wasteLogs, addToRestockList, stats, markAsUsed, dbInfo, preferences, exportCsv } =
    useInventory();
  const [usingItem, setUsingItem] = useState<InventoryItem | null>(null);
  const [icsNotice, setIcsNotice] = useState<string | null>(null);
  const pendingBuyNames = new Set(restockList.filter((r) => r.status === 'pending').map((r) => r.name.toLowerCase()));
  const pendingBuyCount = restockList.filter((r) => r.status === 'pending').length;

  const WASTE_REASON_LABELS: Record<WasteReason, string> = {
    expired: 'Expired / Spoiled',
    overproduction: 'Overproduction',
    'trim-loss': 'Trim / Prep Loss',
    'cold-chain': 'Cold-Chain Issue',
    'damaged-delivery': 'Damaged Delivery',
    'plate-waste': 'Plate Waste',
    other: 'Other Loss',
  };

  const wasteByReason = Object.values(
    wasteLogs.reduce((acc, log) => {
      const r = log.reason || 'other';
      if (!acc[r]) {
        acc[r] = { reason: r, label: WASTE_REASON_LABELS[r] || r, totalLossRs: 0, incidents: 0 };
      }
      acc[r].totalLossRs += Number(log.lossRs) || 0;
      acc[r].incidents += 1;
      return acc;
    }, {} as Record<string, { reason: string; label: string; totalLossRs: number; incidents: number }>)
  ).sort((a, b) => b.totalLossRs - a.totalLossRs || b.incidents - a.incidents);

  const totalStructuredWasteRs = wasteByReason.reduce((s, r) => s + r.totalLossRs, 0);
  const maxReasonLoss = Math.max(1, ...wasteByReason.map((r) => r.totalLossRs));

  const scale = preferences.operationScale || 'household';
  const isCommercial = scale !== 'household';
  const isEnterprise = scale === 'enterprise';

  const urgentItems = items
    .filter((i) => i.status === 'active' && getRemainingDays(i.estimatedExpiryDate) <= 2)
    .sort((a, b) => (a.estimatedExpiryDate > b.estimatedExpiryDate ? 1 : -1));

  const lowStockItems = items.filter(
    (i) =>
      i.status === 'active' &&
      i.parLevel !== null &&
      i.parLevel !== undefined &&
      Number(i.quantity) <= Number(i.parLevel)
  );

  // Category breakdown
  const categoryCounts = items
    .filter((i) => i.status === 'active')
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Branch/Zone & Supplier breakdown for Enterprise/Restaurant
  const zoneCounts = items
    .filter((i) => i.status === 'active')
    .reduce((acc, item) => {
      const zone = item.branchZone || preferences.branchLocation || 'Main Kitchen';
      acc[zone] = (acc[zone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const wasteBudget = preferences.wasteBudgetRs || (isEnterprise ? 50000 : isCommercial ? 15000 : 1500);
  const wastePercent = wasteBudget > 0 ? Math.min(100, Math.round((stats.moneyWastedRs / wasteBudget) * 100)) : 0;

  // Expiry Horizon Breakdown for Active Stock
  const activeItems = items.filter((i) => i.status === 'active');
  const horizonBuckets = activeItems.reduce(
    (acc, item) => {
      const rem = getRemainingDays(item.estimatedExpiryDate);
      if (rem <= 0) acc.overdueToday += 1;
      else if (rem <= 2) acc.urgent1to2 += 1;
      else if (rem <= 7) acc.soon3to7 += 1;
      else acc.safeOver7 += 1;
      return acc;
    },
    { overdueToday: 0, urgent1to2: 0, soon3to7: 0, safeOver7: 0 }
  );
  const totalHorizon = Math.max(1, activeItems.length);

  // Sustainability & ESG Impact from consumed (used) & partially saved items
  const estimateItemWeightKg = (item: InventoryItem): number => {
    const qty = Number(item.originalQuantity || item.quantity || 1);
    const u = (item.unit || '').toLowerCase();
    if (u.includes('kg') || u === 'l' || u.includes('litre') || u.includes('liter')) return qty;
    if (u === 'g' || u === 'gm' || u === 'gms' || u === 'ml') return qty / 1000;
    if (u.includes('dozen')) return qty * 0.65;
    if (u.includes('bunch')) return qty * 0.2;
    return qty * 0.35; // standard pack/piece weight estimate
  };

  const rescuedFoodKg = items.reduce((sum, item) => {
    if (item.status === 'used') {
      return sum + estimateItemWeightKg(item);
    }
    if (item.status === 'active' && item.originalQuantity && item.originalQuantity > item.quantity) {
      const ratioUsed = (item.originalQuantity - item.quantity) / item.originalQuantity;
      return sum + estimateItemWeightKg(item) * ratioUsed;
    }
    return sum;
  }, 0);

  const co2PreventedKg = Number((rescuedFoodKg * 2.5).toFixed(1));
  const waterSavedLiters = Math.round(rescuedFoodKg * 1000);
  const mealsRescued = Math.round(rescuedFoodKg / 0.45);

  // Category Valuation vs At-Risk / Spoiled Breakdown
  const categoryValuation = Object.values(
    items.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) {
        acc[cat] = { category: cat, activeRs: 0, riskOrSpoiledRs: 0, count: 0 };
      }
      const val = Number(item.price || 0);
      if (item.status === 'active') {
        acc[cat].activeRs += val;
        acc[cat].count += 1;
        if (getRemainingDays(item.estimatedExpiryDate) <= 2) {
          acc[cat].riskOrSpoiledRs += val;
        }
      } else if (item.status === 'expired') {
        acc[cat].riskOrSpoiledRs += val;
      }
      return acc;
    }, {} as Record<string, { category: string; activeRs: number; riskOrSpoiledRs: number; count: number }>)
  )
    .filter((c) => c.activeRs > 0 || c.riskOrSpoiledRs > 0)
    .sort((a, b) => b.activeRs + b.riskOrSpoiledRs - (a.activeRs + a.riskOrSpoiledRs))
    .slice(0, 6);

  const maxCategoryValue = Math.max(
    1,
    ...categoryValuation.map((c) => Math.max(c.activeRs, c.riskOrSpoiledRs))
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Top Welcome / Hero Banner */}
      <div className="bg-gradient-to-br from-[#2C5F2D] via-[#204721] to-[#163517] rounded-3xl p-6 text-white shadow-xl shadow-[#2C5F2D]/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs capitalize">
                {scale === 'enterprise'
                  ? '🏢 Enterprise Multi-Branch Ops'
                  : scale === 'restaurant'
                  ? '🍽️ Restaurant Commercial Kitchen'
                  : '🏠 Household Zero-Waste Kitchen'}
              </span>
              {preferences.organizationName && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#A3E635]/20 text-[#A3E635] text-[11px] font-bold border border-[#A3E635]/30">
                  {preferences.organizationName}
                </span>
              )}
              <span className="text-white/80 text-xs font-semibold">
                ● SQLite DB: {dbInfo?.itemsCount ?? 0} items tracked
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isEnterprise
                ? `Active Stock Valuation: ₹${(stats.totalActiveValueRs ?? 0).toLocaleString('en-IN')}`
                : isCommercial
                ? `Kitchen Margin Saved: ₹${stats.moneySavedRs.toLocaleString('en-IN')}`
                : `Total Household Savings: ₹${stats.moneySavedRs.toLocaleString('en-IN')}`}
            </h1>
            <p className="text-xs sm:text-sm text-white/80 max-w-xl leading-relaxed">
              {isEnterprise
                ? `Monitoring ${Object.keys(zoneCounts).length} branch/warehouse zone(s), FIFO spoilage risk, par-level reorders, and FSSAI compliance logs.`
                : isCommercial
                ? 'FIFO prep prioritization, par-level reorder alerts, and batch waste cap monitoring tailored for commercial kitchens.'
                : 'Every vegetable and grocery item marked as consumed prevents waste and adds directly to your household monthly savings.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenScaleModal && (
              <button
                onClick={onOpenScaleModal}
                className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#A3E635]" />
                <span>Switch Scale</span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="px-4 py-2.5 rounded-2xl bg-[#A3E635] text-[#2C5F2D] hover:bg-[#b5f548] text-xs font-extrabold shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isCommercial ? 'Add Stock / Batch' : 'Add Items'}</span>
            </button>

            <button
              onClick={() => setActiveTab('recipes')}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 backdrop-blur-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Utensils className="w-4 h-4" />
              <span>{isCommercial ? 'Batch Prep' : 'Cook Ideas'}</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
            <div className="flex items-center justify-between text-white/70 text-xs font-medium">
              <span>{isCommercial ? 'Cost Recovered' : 'Money Saved'}</span>
              <TrendingUp className="w-4 h-4 text-[#A3E635]" />
            </div>
            <div className="text-xl font-black mt-1">₹{stats.moneySavedRs.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-white/70 mt-0.5">
              {stats.usedCount} batches/items utilized
            </div>
          </div>

          {isCommercial ? (
            <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
              <div className="flex items-center justify-between text-white/70 text-xs font-medium">
                <span>Value at Risk (≤48h)</span>
                <IndianRupee className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xl font-black mt-1">
                ₹{(stats.valueAtRiskRs ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-white/70 mt-0.5">
                Across {stats.urgentCount} urgent FIFO item(s)
              </div>
            </div>
          ) : (
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
          )}

          {isCommercial ? (
            <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
              <div className="flex items-center justify-between text-white/70 text-xs font-medium">
                <span>Below Par Stock</span>
                <RefreshCw className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xl font-black mt-1">{stats.lowStockCount ?? 0} SKUs</div>
              <div className="text-[10px] text-white/70 mt-0.5">Need supplier reorder</div>
            </div>
          ) : (
            <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
              <div className="flex items-center justify-between text-white/70 text-xs font-medium">
                <span>Urgent Attention</span>
                <AlertTriangle className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xl font-black mt-1">{stats.urgentCount} items</div>
              <div className="text-[10px] text-white/70 mt-0.5">Expiring in ≤ 48 hours</div>
            </div>
          )}

          <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs">
            <div className="flex items-center justify-between text-white/70 text-xs font-medium">
              <span>{isEnterprise ? 'Total Active Valuation' : 'Active in Kitchen'}</span>
              <Package className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-xl font-black mt-1">
              {isEnterprise
                ? `₹${(stats.totalActiveValueRs ?? 0).toLocaleString('en-IN')}`
                : `${stats.activeCount} items`}
            </div>
            <div className="text-[10px] text-white/70 mt-0.5">
              {stats.activeCount} active SKUs &bull; {stats.freshCount} fresh
            </div>
          </div>
        </div>
      </div>

      {/* Visual Expiry Horizon & Sustainability / ESG Impact Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expiry Horizon Stacked Bar */}
        <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-stone-900">Expiry Horizon Distribution</h3>
              <p className="text-[11px] text-stone-500">
                Active stock urgency timeline across {activeItems.length} tracked item{activeItems.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const count = exportExpiryCalendarIcs(items);
                  setIcsNotice(
                    count > 0
                      ? `Downloaded .ics calendar file with ${count} upcoming expiry alert${count === 1 ? '' : 's'}.`
                      : 'No active items expiring in the next 14 days.'
                  );
                  setTimeout(() => setIcsNotice(null), 4000);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Download .ics calendar reminders for Google, Apple & Outlook Calendar"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Export .ics</span>
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs font-bold text-[#2C5F2D] hover:underline cursor-pointer shrink-0"
              >
                Inspect FIFO &rarr;
              </button>
            </div>
          </div>
          {icsNotice && (
            <p className="text-[11px] font-bold text-[#2C5F2D] bg-[#EAF3E6] px-3 py-1.5 rounded-xl">
              {icsNotice}
            </p>
          )}

          {activeItems.length > 0 ? (
            <>
              <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-stone-100">
                {horizonBuckets.overdueToday > 0 && (
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{ width: `${(horizonBuckets.overdueToday / totalHorizon) * 100}%` }}
                    title={`Overdue / Today: ${horizonBuckets.overdueToday}`}
                  />
                )}
                {horizonBuckets.urgent1to2 > 0 && (
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{ width: `${(horizonBuckets.urgent1to2 / totalHorizon) * 100}%` }}
                    title={`1–2 Days Left: ${horizonBuckets.urgent1to2}`}
                  />
                )}
                {horizonBuckets.soon3to7 > 0 && (
                  <div
                    className="bg-lime-500 h-full transition-all"
                    style={{ width: `${(horizonBuckets.soon3to7 / totalHorizon) * 100}%` }}
                    title={`3–7 Days Left: ${horizonBuckets.soon3to7}`}
                  />
                )}
                {horizonBuckets.safeOver7 > 0 && (
                  <div
                    className="bg-[#2C5F2D] h-full transition-all"
                    style={{ width: `${(horizonBuckets.safeOver7 / totalHorizon) * 100}%` }}
                    title={`Safe (>7 Days): ${horizonBuckets.safeOver7}`}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { label: 'Today / Overdue', count: horizonBuckets.overdueToday, dot: 'bg-rose-500' },
                  { label: '1–2 Days', count: horizonBuckets.urgent1to2, dot: 'bg-amber-500' },
                  { label: '3–7 Days', count: horizonBuckets.soon3to7, dot: 'bg-lime-500' },
                  { label: 'Safe (>7d)', count: horizonBuckets.safeOver7, dot: 'bg-[#2C5F2D]' },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className="p-2.5 rounded-2xl bg-[#F7F8F4] hover:bg-[#EAF3E6] border border-[#E2E8DE] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500">
                      <span className={`w-2 h-2 rounded-full ${b.dot}`} />
                      <span className="truncate">{b.label}</span>
                    </div>
                    <div className="text-base font-black text-stone-900 mt-0.5 tabular-nums">{b.count}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-stone-500 py-4 text-center">
              Add active inventory items to view your live expiry horizon.
            </p>
          )}
        </div>

        {/* Sustainability & ESG Impact Card */}
        <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-[#2C5F2D]" />
                <h3 className="font-extrabold text-sm text-stone-900">
                  {isCommercial ? 'Sustainability & ESG Impact' : 'Zero-Waste Environmental Impact'}
                </h3>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Calculated from {rescuedFoodKg.toFixed(1)} kg of rescued &amp; cooked kitchen food
              </p>
            </div>
            <span className="text-xs font-extrabold text-[#2C5F2D] tabular-nums">
              {stats.savingPercentage}% Saved
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE]">
              <span className="text-[10px] font-semibold text-stone-500 block">CO₂e Prevented</span>
              <span className="text-lg font-black text-[#2C5F2D] mt-0.5 block tabular-nums">
                {co2PreventedKg} <span className="text-xs font-bold text-stone-500">kg</span>
              </span>
              <span className="text-[10px] text-stone-400">2.5 kg / kg food</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE]">
              <span className="text-[10px] font-semibold text-stone-500 flex items-center gap-1">
                <Droplets className="w-3 h-3 text-sky-600" />
                <span>Water Saved</span>
              </span>
              <span className="text-lg font-black text-sky-800 mt-0.5 block tabular-nums">
                {waterSavedLiters >= 1000
                  ? `${(waterSavedLiters / 1000).toFixed(1)}k`
                  : waterSavedLiters}{' '}
                <span className="text-xs font-bold text-stone-500">L</span>
              </span>
              <span className="text-[10px] text-stone-400">Agri-water footprint</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE]">
              <span className="text-[10px] font-semibold text-stone-500 block">Meals Rescued</span>
              <span className="text-lg font-black text-stone-900 mt-0.5 block tabular-nums">
                {mealsRescued}
              </span>
              <span className="text-[10px] text-stone-400">~450g per meal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Waste Root-Cause & Financial Leakage Analytics */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <h3 className="font-extrabold text-sm text-stone-900">
                Waste Root-Cause &amp; Financial Leakage Breakdown
              </h3>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
              {wasteLogs.length > 0
                ? `${wasteLogs.length} structured waste event${wasteLogs.length === 1 ? '' : 's'} · ₹${totalStructuredWasteRs.toLocaleString('en-IN')} attributed leakage`
                : 'Log spoiled or trimmed stock from Inventory to pinpoint exactly where kitchen ₹ leaks.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className="text-xs font-bold text-[#2C5F2D] hover:underline cursor-pointer"
          >
            Log from Inventory &rarr;
          </button>
        </div>

        {wasteByReason.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-2.5">
              {wasteByReason.map((row) => {
                const sharePct =
                  totalStructuredWasteRs > 0
                    ? Math.round((row.totalLossRs / totalStructuredWasteRs) * 100)
                    : Math.round((row.incidents / Math.max(1, wasteLogs.length)) * 100);
                return (
                  <div key={row.reason} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2 tabular-nums">
                      <span className="font-bold text-stone-800">
                        {row.label}{' '}
                        <span className="text-[11px] font-normal text-stone-500">
                          · {row.incidents} event{row.incidents === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="font-extrabold text-rose-700">
                        ₹{row.totalLossRs.toLocaleString('en-IN')}{' '}
                        <span className="text-[11px] font-semibold text-stone-500">({sharePct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round(
                              (row.totalLossRs > 0 ? row.totalLossRs / maxReasonLoss : row.incidents / wasteLogs.length) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-5 divide-y divide-stone-100 border-t lg:border-t-0 lg:border-l border-stone-100 pt-3 lg:pt-0 lg:pl-4">
              <p className="text-[11px] font-bold text-stone-500 pb-2">Recent Attributed Losses</p>
              {wasteLogs.slice(0, 4).map((w) => (
                <div key={w.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-stone-900 truncate">{w.itemName}</p>
                    <p className="text-[11px] text-stone-500 truncate">
                      {WASTE_REASON_LABELS[w.reason] || w.reason} · {w.quantityWasted} {w.unit}
                      {w.loggedBy ? ` · ${w.loggedBy}` : ''}
                    </p>
                  </div>
                  <span className="font-extrabold text-rose-700 tabular-nums shrink-0">
                    -₹{w.lossRs.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 px-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-stone-600">
              No root-cause waste events recorded yet. Click <strong>Spoiled</strong> on any active item in Inventory to attribute partial or full losses (Expired, Overproduction, Trim Loss, Cold-Chain, Damaged Delivery).
            </span>
            {stats.moneyWastedRs > 0 && (
              <span className="font-bold text-rose-700 tabular-nums shrink-0">
                Historical expired: ₹{stats.moneyWastedRs.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Commercial Waste Budget Cap & FSSAI Compliance Bar (Restaurant & Enterprise) */}
      {isCommercial && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-stone-900">
                  Monthly Spoilage Cap vs Actual Loss
                </h3>
                <p className="text-[11px] text-stone-500">
                  Target cap: ₹{wasteBudget.toLocaleString('en-IN')} &bull; Actual expired loss: ₹{stats.moneyWastedRs.toLocaleString('en-IN')}
                </p>
              </div>
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-full ${
                  wastePercent >= 80
                    ? 'bg-rose-100 text-rose-800'
                    : wastePercent >= 50
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {wastePercent}% of Cap
              </span>
            </div>

            <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  wastePercent >= 80
                    ? 'bg-rose-500'
                    : wastePercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-[#2C5F2D]'
                }`}
                style={{ width: `${wastePercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Remaining buffer: ₹{Math.max(0, wasteBudget - stats.moneyWastedRs).toLocaleString('en-IN')}</span>
              <span>Utilization rate: {stats.savingPercentage}%</span>
            </div>
          </div>

          <div className="bg-[#EAF3E6] border border-[#6B9B4F]/40 rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[#2C5F2D]">
                <ClipboardCheck className="w-4 h-4" />
                <h3 className="font-extrabold text-sm">
                  {isEnterprise ? 'FSSAI / HACCP & Reorder Audit' : 'Kitchen Audit & Reorder Sheet'}
                </h3>
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                Export batch codes, suppliers, branch zones, expiry logs &amp; low-stock flags to CSV.
              </p>
            </div>
            <button
              onClick={exportCsv}
              className="w-full py-2.5 px-3 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Compliance CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Low-Stock Reorder Alerts (Restaurant & Enterprise) */}
      {isCommercial && lowStockItems.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-rose-600" />
              <h3 className="font-extrabold text-sm text-rose-950">
                Low-Stock Reorder Queue ({lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} at/below Par Level)
              </h3>
            </div>
            <button
              onClick={() => (onOpenRestockList ? onOpenRestockList() : setActiveTab('inventory'))}
              className="px-3 py-1.5 rounded-xl bg-rose-900 hover:bg-rose-950 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Open Buy &amp; Restock List ({pendingBuyCount})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {lowStockItems.slice(0, 6).map((item) => {
              const alreadyQueued = pendingBuyNames.has(item.name.toLowerCase());
              return (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-2xl border border-rose-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-stone-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-rose-700 font-semibold">
                      Stock: {item.quantity} {item.unit} (Par: {item.parLevel} {item.unit})
                    </p>
                    {item.supplierName && (
                      <p className="text-[10px] text-stone-500 truncate">Supplier: {item.supplierName}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (alreadyQueued) {
                        onOpenRestockList?.();
                      } else {
                        const targetPar = item.parLevel ?? Math.max(Number(item.quantity) || 1, 1);
                        const qtyToBuy = Math.max(Math.ceil(targetPar * 2 - Number(item.quantity)), 1);
                        addToRestockList({
                          name: item.name,
                          category: item.category,
                          targetQuantity: qtyToBuy,
                          unit: item.unit,
                          storage: item.storage,
                          estimatedPrice: item.price ?? null,
                          supplierName: item.supplierName,
                          parLevel: item.parLevel,
                          branchZone: item.branchZone,
                          reason: 'low-stock',
                          priority: 'urgent',
                          sourceItemId: item.id,
                        });
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black shrink-0 transition-colors cursor-pointer ${
                      alreadyQueued
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                    }`}
                  >
                    {alreadyQueued ? 'In Buy List' : '+ Buy List'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgent Expiry Action Card */}
      {urgentItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-extrabold text-sm text-amber-950">
                {isCommercial
                  ? `FIFO Priority Queue: ${urgentItems.length} batches need immediate prep!`
                  : `Action Required: ${urgentItems.length} items need cooking soon!`}
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('recipes')}
              className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isCommercial ? 'Batch Prep Ideas' : 'See Recipe Ideas'} &rarr;</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {urgentItems.slice(0, 3).map((item, idx) => {
              const rem = getRemainingDays(item.estimatedExpiryDate);
              return (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isCommercial && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white">
                          FIFO #{idx + 1}
                        </span>
                      )}
                      <p className="font-bold text-xs text-stone-900 truncate">{item.name}</p>
                    </div>
                    <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                      {rem <= 0 ? 'Expires Today!' : `${rem} day${rem > 1 ? 's' : ''} left`}
                      {item.batchCode ? ` • Lot ${item.batchCode}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setUsingItem(item)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                  >
                    {isCommercial ? 'Consume' : 'Cooked / Use'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Branch / Zone Breakdown (Enterprise) */}
      {isEnterprise && (
        <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#2C5F2D]" />
              <h3 className="font-extrabold text-sm text-stone-900">Branch &amp; Warehouse Zone Distribution</h3>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-bold text-[#2C5F2D] hover:underline cursor-pointer"
            >
              Filter by Zone &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {Object.entries(zoneCounts).map(([zone, count]) => (
              <div
                key={zone}
                onClick={() => setActiveTab('inventory')}
                className="p-3 bg-[#F7F8F4] hover:bg-[#EAF3E6] border border-[#E2E8DE] hover:border-[#6B9B4F] rounded-2xl transition-all cursor-pointer"
              >
                <span className="text-xs font-bold text-stone-800 block truncate">{zone}</span>
                <span className="text-[11px] text-stone-500 mt-0.5 block">
                  {count} active batch{count > 1 ? 'es' : ''}
                </span>
              </div>
            ))}
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

        <button
          type="button"
          onClick={() => void api.downloadProjectZip()}
          className="px-4 py-2.5 rounded-2xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold text-xs shadow-md shadow-[#2C5F2D]/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#A3E635]" />
          <span>Download .ZIP Archive</span>
        </button>
      </div>

      {/* Category Valuation vs Waste Risk & Staples Breakdown */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2C5F2D]" />
            <h3 className="font-extrabold text-sm text-stone-900">
              {isCommercial ? 'Category Stock Value vs Waste Risk (₹)' : 'Kitchen Staples & Value Breakdown'}
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="text-xs font-bold text-[#2C5F2D] hover:underline cursor-pointer"
          >
            View Inventory &rarr;
          </button>
        </div>

        {categoryValuation.length > 0 && (
          <div className="space-y-2.5 pb-3 border-b border-stone-100">
            {categoryValuation.map((row) => (
              <div key={row.category} className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-stone-800">
                    {row.category}{' '}
                    <span className="text-[11px] font-normal text-stone-400">({row.count} active)</span>
                  </span>
                  <div className="flex items-center gap-2 tabular-nums text-[11px]">
                    <span className="font-bold text-[#2C5F2D]">
                      ₹{row.activeRs.toLocaleString('en-IN')} active
                    </span>
                    {row.riskOrSpoiledRs > 0 && (
                      <span className="font-bold text-rose-700">
                        · ₹{row.riskOrSpoiledRs.toLocaleString('en-IN')} risk/lost
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden flex gap-0.5">
                  <div
                    className="h-full bg-[#2C5F2D] rounded-full transition-all"
                    style={{ width: `${Math.min(100, (row.activeRs / maxCategoryValue) * 100)}%` }}
                  />
                  {row.riskOrSpoiledRs > 0 && (
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (row.riskOrSpoiledRs / maxCategoryValue) * 100)}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <div
              key={cat}
              onClick={() => setActiveTab('inventory')}
              className="p-3 bg-stone-50 hover:bg-[#EAF3E6] border border-stone-200 hover:border-[#6B9B4F] rounded-2xl transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-stone-800 block truncate">{cat}</span>
              <span className="text-[11px] text-stone-500 mt-0.5 block tabular-nums">
                {count} item{count > 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Kitchen Activity & Audit Trail */}
      {activityLogs.length > 0 && (
        <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#2C5F2D]" />
              <h3 className="font-extrabold text-sm text-stone-900">
                {isCommercial ? 'Recent Kitchen Audit & Operations Log' : 'Recent Kitchen Activity'}
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="text-xs font-bold text-[#2C5F2D] hover:underline cursor-pointer"
            >
              View Full Log &rarr;
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {activityLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                      log.action === 'used' || log.action === 'restocked'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.action === 'frozen'
                        ? 'bg-sky-100 text-sky-800'
                        : log.action === 'expired'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {log.action}
                  </span>
                  <div className="min-w-0">
                    <span className="font-bold text-stone-900">{log.itemName}</span>
                    {log.details && (
                      <span className="text-stone-500 ml-1.5">— {log.details}</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
