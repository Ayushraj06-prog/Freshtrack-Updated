/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  X,
  Search,
  Minus,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { StocktakeEntryPayload } from '../types/inventory';

interface StocktakeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StocktakeModal: React.FC<StocktakeModalProps> = ({ isOpen, onClose }) => {
  const { items, reconcileStocktake } = useInventory();

  const activeItems = useMemo(
    () =>
      items
        .filter((i) => i.status === 'active')
        .sort((a, b) => a.storage.localeCompare(b.storage) || a.name.localeCompare(b.name)),
    [items]
  );

  const [storageFilter, setStorageFilter] = useState<'all' | 'fridge' | 'pantry' | 'freezer'>('all');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [zeroDisposition, setZeroDisposition] = useState<'used' | 'expired'>('used');
  const [autoQueueShortages, setAutoQueueShortages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, number> = {};
    for (const it of activeItems) {
      init[it.id] = Number(it.quantity) || 0;
    }
    setCounts(init);
    setSummaryMsg(null);
  }, [isOpen, activeItems]);

  if (!isOpen) return null;

  const visibleItems = activeItems.filter((it) => {
    if (storageFilter !== 'all' && it.storage !== storageFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        it.name.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        (it.branchZone && it.branchZone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Compute live audit variance across all active items
  const auditSummary = activeItems.reduce(
    (acc, it) => {
      const expected = Number(it.quantity) || 0;
      const actual = counts[it.id] !== undefined ? counts[it.id] : expected;
      const diff = Number((actual - expected).toFixed(2));
      if (Math.abs(diff) >= 0.001) {
        acc.adjustedCount += 1;
        if (diff < 0) acc.shortageCount += 1;
        const baseQty = Number(it.originalQuantity || expected || 1);
        const unitVal = it.price !== null && baseQty > 0 ? it.price / baseQty : 0;
        acc.varianceRs += Math.round(diff * unitVal);
      }
      return acc;
    },
    { adjustedCount: 0, shortageCount: 0, varianceRs: 0 }
  );

  const adjustCount = (id: string, delta: number, unit: string) => {
    const step = ['g', 'gm', 'ml'].includes(unit.toLowerCase()) ? 50 : 1;
    setCounts((prev) => {
      const curr = prev[id] ?? 0;
      const next = Math.max(0, Number((curr + delta * step).toFixed(2)));
      return { ...prev, [id]: next };
    });
  };

  const handleReconcile = async () => {
    const entries: StocktakeEntryPayload[] = [];
    for (const it of activeItems) {
      const expected = Number(it.quantity) || 0;
      const actual = counts[it.id] !== undefined ? counts[it.id] : expected;
      if (Math.abs(actual - expected) >= 0.001) {
        entries.push({
          itemId: it.id,
          actualQuantity: actual,
          zeroDisposition,
          addShortageToBuyList: autoQueueShortages,
        });
      }
    }
    if (entries.length === 0) {
      setSummaryMsg('No quantity differences detected — your inventory already matches your physical count!');
      return;
    }

    setSaving(true);
    try {
      const res = await reconcileStocktake(entries);
      const sign = res.totalVarianceRs >= 0 ? '+' : '-';
      setSummaryMsg(
        `Reconciled ${res.adjustedCount} item(s) (${res.shortageCount} shortage, net variance ${sign}₹${Math.abs(res.totalVarianceRs)}). Database updated!`
      );
    } catch (err: any) {
      setSummaryMsg(`Stocktake failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E2E8DE] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8DE] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-stone-900">
                Physical Stocktake &amp; Variance Audit
              </h3>
              <p className="text-xs text-stone-500">
                Walk through your fridge, pantry, or store room and sync actual physical counts to SQLite in one click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Strip & Filters */}
        <div className="px-5 py-3 bg-[#F7F8F4] border-b border-[#E2E8DE] space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white rounded-2xl p-2.5 border border-[#E2E8DE]">
              <span className="text-[10px] font-semibold text-stone-500 block">Items Changed</span>
              <span className="text-base font-black text-stone-900 tabular-nums">
                {auditSummary.adjustedCount} <span className="text-[11px] font-medium text-stone-400">/ {activeItems.length}</span>
              </span>
            </div>
            <div className="bg-white rounded-2xl p-2.5 border border-[#E2E8DE]">
              <span className="text-[10px] font-semibold text-stone-500 block">Shortages Found</span>
              <span className="text-base font-black text-amber-700 tabular-nums">{auditSummary.shortageCount}</span>
            </div>
            <div className="bg-white rounded-2xl p-2.5 border border-[#E2E8DE]">
              <span className="text-[10px] font-semibold text-stone-500 block">Estimated Variance</span>
              <span
                className={`text-base font-black tabular-nums ${
                  auditSummary.varianceRs < 0
                    ? 'text-rose-700'
                    : auditSummary.varianceRs > 0
                    ? 'text-emerald-700'
                    : 'text-stone-800'
                }`}
              >
                {auditSummary.varianceRs > 0 ? '+' : auditSummary.varianceRs < 0 ? '-' : ''}₹
                {Math.abs(auditSummary.varianceRs).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E2E8DE] text-xs">
              {(['all', 'fridge', 'pantry', 'freezer'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStorageFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize cursor-pointer ${
                    storageFilter === st ? 'bg-[#2C5F2D] text-white' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter items to count..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E2E8DE] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
              />
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {summaryMsg && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-[#EAF3E6] border border-[#6B9B4F] text-xs font-bold text-[#2C5F2D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{summaryMsg}</span>
          </div>
        )}

        {/* Item Count Rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-stone-100">
          {visibleItems.length > 0 ? (
            visibleItems.map((it) => {
              const expected = Number(it.quantity) || 0;
              const actual = counts[it.id] !== undefined ? counts[it.id] : expected;
              const diff = Number((actual - expected).toFixed(2));
              const changed = Math.abs(diff) >= 0.001;

              return (
                <div
                  key={it.id}
                  className={`py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs ${
                    changed ? 'bg-amber-50/40 -mx-2 px-2 rounded-xl' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-stone-900 truncate">{it.name}</p>
                    <p className="text-[11px] text-stone-500 capitalize">
                      {it.storage}
                      {it.branchZone ? ` · ${it.branchZone}` : ''} · System: <strong className="text-stone-700 tabular-nums">{expected} {it.unit}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCounts((prev) => ({ ...prev, [it.id]: 0 }))}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        actual === 0
                          ? 'bg-rose-600 text-white'
                          : 'bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600'
                      }`}
                    >
                      0 Out
                    </button>

                    <button
                      type="button"
                      onClick={() => adjustCount(it.id, -1, it.unit)}
                      className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                      aria-label="Decrease count"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={actual}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setCounts((prev) => ({ ...prev, [it.id]: val }));
                      }}
                      className="w-16 text-center py-1 bg-white border border-stone-300 rounded-lg font-extrabold text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                    />

                    <button
                      type="button"
                      onClick={() => adjustCount(it.id, 1, it.unit)}
                      className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                      aria-label="Increase count"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-16 text-right font-bold tabular-nums text-[11px]">
                      {changed ? (
                        <span className={diff < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                          {diff > 0 ? `+${diff}` : diff} {it.unit}
                        </span>
                      ) : (
                        <span className="text-stone-400">Match</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-10 text-center text-xs text-stone-500">
              No active items match this storage filter.
            </p>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 bg-[#F7F8F4] border-t border-[#E2E8DE] space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-600">When count is 0:</span>
              <button
                type="button"
                onClick={() => setZeroDisposition('used')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                  zeroDisposition === 'used' ? 'bg-[#2C5F2D] text-white' : 'bg-white border border-stone-200 text-stone-600'
                }`}
              >
                Mark Used / Finished
              </button>
              <button
                type="button"
                onClick={() => setZeroDisposition('expired')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer flex items-center gap-1 ${
                  zeroDisposition === 'expired' ? 'bg-rose-600 text-white' : 'bg-white border border-stone-200 text-stone-600'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Mark Spoiled / Shrinkage</span>
              </button>
            </div>

            <label className="flex items-center gap-1.5 font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={autoQueueShortages}
                onChange={(e) => setAutoQueueShortages(e.target.checked)}
                className="accent-[#2C5F2D] w-4 h-4"
              />
              <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto-add depleted/low items to Buy List</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 font-bold hover:bg-stone-200 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={saving || auditSummary.adjustedCount === 0}
              onClick={handleReconcile}
              className="px-5 py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {saving
                  ? 'Reconciling...'
                  : `Reconcile ${auditSummary.adjustedCount} Variance${auditSummary.adjustedCount === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
