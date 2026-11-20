/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Printer, X, CheckSquare, Square, Tag } from 'lucide-react';
import { InventoryItem } from '../types/inventory';
import { getRemainingDays } from '../data/shelfLifeData';

interface FifoLabelPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  initialSelectedIds?: string[];
  organizationName?: string;
}

/** Deterministic lightweight SVG barcode pattern for printed kitchen labels */
function renderBarcodeBars(seed: string): { x: number; w: number }[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: { x: number; w: number }[] = [];
  let cursor = 2;
  for (let i = 0; i < 28 && cursor < 114; i++) {
    hash = Math.imul(hash ^ (i * 31 + 17), 16777619);
    const width = (Math.abs(hash) % 3) + 1;
    const gap = ((Math.abs(hash >> 3) % 2) + 1) * 1.4;
    bars.push({ x: cursor, w: width });
    cursor += width + gap;
  }
  return bars;
}

export const FifoLabelPrinterModal: React.FC<FifoLabelPrinterModalProps> = ({
  isOpen,
  onClose,
  items,
  initialSelectedIds,
  organizationName,
}) => {
  const activeItems = useMemo(
    () =>
      items
        .filter((i) => i.status === 'active')
        .sort((a, b) => a.estimatedExpiryDate.localeCompare(b.estimatedExpiryDate)),
    [items]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) return initialSelectedIds;
    return activeItems.slice(0, 6).map((i) => i.id);
  });
  const [columns, setColumns] = useState<2 | 3>(2);
  const [preparedBy, setPreparedBy] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedIds(initialSelectedIds);
    } else {
      setSelectedIds(activeItems.slice(0, 6).map((i) => i.id));
    }
  }, [isOpen, initialSelectedIds, activeItems]);

  if (!isOpen) return null;

  const selectedItems = activeItems.filter((i) => selectedIds.includes(i.id));

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectUrgent = () => {
    setSelectedIds(
      activeItems
        .filter((i) => getRemainingDays(i.estimatedExpiryDate) <= 3)
        .map((i) => i.id)
    );
  };

  const selectAll = () => {
    setSelectedIds(activeItems.map((i) => i.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-[#E2E8DE] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8DE] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-stone-900">
                Print FIFO &amp; Use-By Container Labels
              </h3>
              <p className="text-xs text-stone-500">
                Standardized kitchen rotation stickers with USE BY dates, lot codes, storage zones, and barcodes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            aria-label="Close label printer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-3 bg-[#F7F8F4] border-b border-[#E2E8DE] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectUrgent}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8DE] hover:border-[#2C5F2D] font-bold text-stone-700 cursor-pointer"
            >
              Select Urgent (≤3d)
            </button>
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8DE] hover:border-[#2C5F2D] font-bold text-stone-700 cursor-pointer"
            >
              Select All ({activeItems.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8DE] hover:bg-stone-100 font-semibold text-stone-600 cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Initials / Staff name (optional)"
              className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8DE] text-xs w-44 focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
            />
            <div className="flex items-center p-0.5 bg-white border border-[#E2E8DE] rounded-lg">
              <button
                type="button"
                onClick={() => setColumns(2)}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  columns === 2 ? 'bg-[#2C5F2D] text-white' : 'text-stone-600'
                }`}
              >
                2 / Row
              </button>
              <button
                type="button"
                onClick={() => setColumns(3)}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  columns === 3 ? 'bg-[#2C5F2D] text-white' : 'text-stone-600'
                }`}
              >
                3 / Row
              </button>
            </div>
          </div>
        </div>

        {/* Body: Left Item Selector + Right Live Printable Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* Left selector list */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E2E8DE] overflow-y-auto p-3 space-y-1.5 max-h-56 lg:max-h-none">
            <p className="text-[11px] font-bold text-stone-500 px-1.5 pb-1">
              Active Items ({selectedIds.length} selected for printing)
            </p>
            {activeItems.map((item) => {
              const checked = selectedIds.includes(item.id);
              const rem = getRemainingDays(item.estimatedExpiryDate);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-start gap-2.5 cursor-pointer ${
                    checked
                      ? 'bg-[#EAF3E6] border-[#2C5F2D]'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span className="mt-0.5 text-[#2C5F2D] shrink-0">
                    {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-stone-400" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-stone-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-stone-500 tabular-nums mt-0.5">
                      {item.quantity} {item.unit} · Use by {item.estimatedExpiryDate} ({rem <= 0 ? 'Today' : `${rem}d`})
                    </p>
                  </div>
                </button>
              );
            })}
            {activeItems.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-8">No active inventory items to label.</p>
            )}
          </div>

          {/* Right printable sheet */}
          <div className="lg:col-span-8 overflow-y-auto p-4 sm:p-5 bg-stone-50">
            {selectedItems.length > 0 ? (
              <div
                id="fifo-print-sheet"
                className={`grid gap-3 ${
                  columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {selectedItems.map((item) => {
                  const rem = getRemainingDays(item.estimatedExpiryDate);
                  const lot = item.batchCode || item.barcode || item.id.slice(-6).toUpperCase();
                  const bars = renderBarcodeBars(`${item.name}-${lot}`);
                  return (
                    <div
                      key={item.id}
                      className="bg-white border-2 border-stone-900 rounded-xl p-3 flex flex-col justify-between gap-2 break-inside-avoid"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-stone-300 pb-1.5">
                          <span className="text-[10px] font-extrabold tracking-wide text-stone-600 truncate">
                            {organizationName || 'FreshTrack FIFO'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-stone-800 uppercase shrink-0">
                            {item.storage}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-stone-950 mt-1.5 leading-snug line-clamp-2">
                          {item.name}
                        </h4>

                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
                          <div className="bg-stone-100 rounded-lg px-2 py-1">
                            <span className="text-[9px] font-bold text-stone-500 block">STOCKED</span>
                            <span className="font-bold text-stone-900">{item.purchaseDate}</span>
                          </div>
                          <div
                            className={`rounded-lg px-2 py-1 ${
                              rem <= 2 ? 'bg-stone-900 text-white' : 'bg-[#EAF3E6] text-[#2C5F2D]'
                            }`}
                          >
                            <span className="text-[9px] font-bold opacity-80 block">USE BY</span>
                            <span className="font-black">{item.estimatedExpiryDate}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[10px] text-stone-600 font-medium tabular-nums">
                          <span>
                            Qty: <strong className="text-stone-900">{item.quantity} {item.unit}</strong>
                          </span>
                          <span>
                            Lot: <strong className="font-mono text-stone-900">{lot}</strong>
                          </span>
                        </div>
                        {(item.branchZone || preparedBy.trim()) && (
                          <p className="text-[10px] text-stone-500 mt-0.5 truncate">
                            {item.branchZone ? `Zone: ${item.branchZone}` : ''}
                            {item.branchZone && preparedBy.trim() ? ' · ' : ''}
                            {preparedBy.trim() ? `By: ${preparedBy.trim()}` : ''}
                          </p>
                        )}
                      </div>

                      {/* Crisp Barcode Footer */}
                      <div className="pt-1.5 border-t border-dashed border-stone-300 flex items-center justify-between gap-2">
                        <svg viewBox="0 0 120 22" className="h-5 w-28" aria-hidden="true">
                          {bars.map((b, i) => (
                            <rect key={i} x={b.x} y={1} width={b.w} height={20} fill="#1c1917" />
                          ))}
                        </svg>
                        <span className="text-[9px] font-mono text-stone-500 tabular-nums">
                          {rem <= 0 ? 'USE TODAY' : `FIFO · ${rem}D`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-14 text-xs text-stone-500">
                <Tag className="w-8 h-8 text-stone-300 mb-2" />
                <p className="font-bold text-stone-700">Select items on the left to preview printable FIFO labels.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#E2E8DE] bg-white flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500 tabular-nums">
            Ready to print <strong className="text-stone-900">{selectedItems.length}</strong> container sticker{selectedItems.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#A3E635]" />
              <span>Print Label Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
