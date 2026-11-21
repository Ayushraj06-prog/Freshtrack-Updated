/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertTriangle,
  Clock,
  Sparkles,
  PlusCircle,
  Package,
  UtensilsCrossed,
  ArrowUpDown,
  Download,
  Building2,
  RefreshCw,
  ShoppingCart,
  Snowflake,
  XCircle,
  CheckSquare,
  Square,
  Printer,
  ClipboardCheck,
  ArrowLeftRight,
  CalendarPlus,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getRemainingDays, SHELF_LIFE_DATABASE } from '../data/shelfLifeData';
import { InventoryItem, ItemCategory, StorageLocation } from '../types/inventory';
import { UseItemModal } from './UseItemModal';
import { CustomRecipeModal } from './CustomRecipeModal';
import { CompletedAndBuyPanel } from './CompletedAndBuyPanel';
import { TransferStockModal } from './TransferStockModal';
import { LogWasteModal } from './LogWasteModal';
import { QuickLeftoverModal } from './QuickLeftoverModal';
import { exportExpiryCalendarIcs } from '../utils/icsExport';
import { safeImageUrl } from '../utils/security';

interface InventoryViewProps {
  onOpenAddModal: () => void;
  setActiveTab: (tab: string) => void;
  initialStatusFilter?: 'active' | 'urgent' | 'low-stock' | 'used' | 'restock' | 'all' | null;
  onClearStatusJump?: () => void;
  onOpenLabelPrinter?: (ids?: string[]) => void;
  onOpenStocktake?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onOpenAddModal,
  setActiveTab,
  initialStatusFilter,
  onClearStatusJump,
  onOpenLabelPrinter,
  onOpenStocktake,
}) => {
  const {
    items,
    restockList,
    markAsUsed,
    markMultipleAsUsed,
    markAsExpired,
    markMultipleAsExpired,
    freezeAndExtendItem,
    markMultipleAsFrozen,
    deleteItem,
    updateItem,
    addToRestockList,
    preferences,
    stats,
    exportCsv,
  } = useInventory();

  const isCommercial = preferences.operationScale !== 'household';
  const isEnterprise = preferences.operationScale === 'enterprise';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStorage, setSelectedStorage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<
    'active' | 'urgent' | 'low-stock' | 'used' | 'expired' | 'restock' | 'all'
  >('active');
  const [fifoSort, setFifoSort] = useState<boolean>(true);
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatusFilter) {
      setSelectedStatus(initialStatusFilter);
      onClearStatusJump?.();
    }
  }, [initialStatusFilter, onClearStatusJump]);

  const pendingBuyCount = useMemo(
    () => restockList.filter((r) => r.status === 'pending').length,
    [restockList]
  );

  const pendingBuyNames = useMemo(
    () => new Set(restockList.filter((r) => r.status === 'pending').map((r) => r.name.toLowerCase())),
    [restockList]
  );

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [usingItem, setUsingItem] = useState<InventoryItem | null>(null);
  const [wastingItem, setWastingItem] = useState<InventoryItem | null>(null);
  const [transferringItem, setTransferringItem] = useState<InventoryItem | null>(null);
  const [isLeftoverModalOpen, setIsLeftoverModalOpen] = useState(false);
  const [isCustomRecipeOpen, setIsCustomRecipeOpen] = useState(false);
  const [customRecipeItemId, setCustomRecipeItemId] = useState<string | null>(null);

  const handleExportIcs = () => {
    const count = exportExpiryCalendarIcs(items);
    if (count > 0) {
      setQueuedNotice(`Exported ${count} upcoming expiry alert${count === 1 ? '' : 's'} to .ics calendar file!`);
    } else {
      setQueuedNotice('No active items expiring within the next 14 days to export.');
    }
    setTimeout(() => setQueuedNotice(null), 4500);
  };

  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    items.forEach((i) => {
      if (i.branchZone) zones.add(i.branchZone);
    });
    if (preferences.branchLocation) zones.add(preferences.branchLocation);
    return Array.from(zones);
  }, [items, preferences.branchLocation]);

  // Filter & FIFO sort items
  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      // Storage filter
      if (selectedStorage !== 'all' && item.storage !== selectedStorage) return false;

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Branch / Zone filter
      if (selectedZone !== 'all' && (item.branchZone || preferences.branchLocation || 'Main Kitchen') !== selectedZone) {
        return false;
      }

      // Status filter
      if (selectedStatus === 'active' && item.status !== 'active') return false;
      if (selectedStatus === 'used' && item.status !== 'used') return false;
      if (selectedStatus === 'expired' && item.status !== 'expired') return false;
      if (selectedStatus === 'urgent') {
        if (item.status !== 'active') return false;
        const days = getRemainingDays(item.estimatedExpiryDate);
        if (days > 2) return false;
      }
      if (selectedStatus === 'low-stock') {
        if (item.status !== 'active') return false;
        if (item.parLevel === null || item.parLevel === undefined || Number(item.quantity) > Number(item.parLevel)) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.includes(q)) ||
          (item.batchCode && item.batchCode.toLowerCase().includes(q)) ||
          (item.supplierName && item.supplierName.toLowerCase().includes(q)) ||
          (item.branchZone && item.branchZone.toLowerCase().includes(q))
        );
      }

      return true;
    });

    if (isCommercial && fifoSort) {
      return [...filtered].sort((a, b) => a.estimatedExpiryDate.localeCompare(b.estimatedExpiryDate));
    }
    return filtered;
  }, [
    items,
    selectedStorage,
    selectedCategory,
    selectedZone,
    selectedStatus,
    searchQuery,
    isCommercial,
    fifoSort,
    preferences.branchLocation,
  ]);

  return (
    <div className="space-y-5 pb-24">
      {/* Top Controls: Search & Primary Action */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, milk, curd, paneer, atta, barcodes..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8DE] rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
            >
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'restock' ? 'active' : 'restock')}
            className={`px-3 py-2.5 border text-xs font-bold rounded-2xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px] ${
              selectedStatus === 'restock'
                ? 'bg-stone-900 text-[#A3E635] border-stone-900'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span className="truncate">Buy &amp; Restock</span>
            {pendingBuyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0">
                {pendingBuyCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsLeftoverModalOpen(true)}
            className="px-3 py-2.5 bg-white hover:bg-stone-50 text-stone-800 border border-[#E2E8DE] text-xs font-bold rounded-2xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
          >
            <Clock className="w-4 h-4 text-[#2C5F2D] shrink-0" />
            <span className="truncate">{isCommercial ? 'Prep Timer' : 'Log Leftover'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCustomRecipeItemId(null);
              setIsCustomRecipeOpen(true);
            }}
            className="px-3 py-2.5 bg-[#EAF3E6] hover:bg-[#d8edd1] text-[#2C5F2D] border border-[#6B9B4F]/40 text-xs font-bold rounded-2xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
          >
            <UtensilsCrossed className="w-4 h-4 text-[#2C5F2D] shrink-0" />
            <span className="truncate">Cook My Recipe</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3 py-2.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold rounded-2xl shadow-md shadow-[#2C5F2D]/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{isCommercial ? 'Add Stock' : 'Add Items'}</span>
          </button>
        </div>
      </div>

      {/* Quick Queued Notification */}
      {queuedNotice && (
        <div className="p-3 bg-[#EAF3E6] border border-[#6B9B4F] rounded-2xl text-xs font-bold text-[#2C5F2D] flex items-center justify-between">
          <span>{queuedNotice}</span>
          <button
            type="button"
            onClick={() => setSelectedStatus('restock')}
            className="underline font-extrabold cursor-pointer"
          >
            Open Buy List &rarr;
          </button>
        </div>
      )}

      {/* Commercial Operations Strip (Restaurant & Enterprise) */}
      {isCommercial && selectedStatus !== 'restock' && (
        <div className="bg-white border border-[#E2E8DE] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFifoSort((v) => !v)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                fifoSort
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>FIFO Priority: {fifoSort ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatus(selectedStatus === 'low-stock' ? 'active' : 'low-stock')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedStatus === 'low-stock'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Low Stock ({stats.lowStockCount ?? 0})</span>
            </button>

            {isEnterprise && (
              <div className="flex items-center gap-1.5 bg-stone-50 border border-[#E2E8DE] rounded-xl px-2.5 py-1">
                <Building2 className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-stone-700 focus:outline-none"
                >
                  <option value="all">All Zones / Branches</option>
                  {availableZones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {isEnterprise && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[11px] tabular-nums">
                At Risk (≤48h): ₹{(stats.valueAtRiskRs ?? 0).toLocaleString('en-IN')}
              </span>
            )}
            {onOpenStocktake && (
              <button
                type="button"
                onClick={onOpenStocktake}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-[#E2E8DE] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <span>Stocktake Audit</span>
              </button>
            )}
            {onOpenLabelPrinter && (
              <button
                type="button"
                onClick={() => onOpenLabelPrinter()}
                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#A3E635]" />
                <span>FIFO Labels</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportIcs}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-[#E2E8DE] font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Export 14-day expiry reminders to Google, Apple, or Outlook Calendar"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-[#2C5F2D]" />
              <span>Calendar (.ics)</span>
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="px-3 py-1.5 rounded-xl bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isEnterprise ? 'FSSAI / Reorder CSV' : 'Export Stock CSV'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Storage & Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs max-w-full">
        {selectedStatus !== 'restock' && (
          <>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'fridge', label: 'Fridge ❄️' },
              { id: 'pantry', label: 'Pantry 🍞' },
              { id: 'freezer', label: 'Freezer 🧊' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStorage(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedStorage === tab.id
                    ? 'bg-[#2C5F2D] text-white shadow-xs'
                    : 'bg-white border border-[#E2E8DE] text-stone-600 hover:bg-stone-50'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <div className="h-5 w-px bg-stone-300 mx-1 shrink-0" />
          </>
        )}

        {/* Status Pills */}
        {[
          { id: 'active', label: 'Active Fresh' },
          { id: 'urgent', label: `Expiring ≤48h (${stats.urgentCount})` },
          { id: 'used', label: 'Cooked/Saved (₹)' },
          { id: 'expired', label: `Spoiled (${stats.expiredCount})` },
          { id: 'restock', label: `Completed & Buy List (${pendingBuyCount})` },
        ].map((st) => (
          <button
            key={st.id}
            onClick={() => {
              setSelectedStatus(st.id as any);
              setSelectedIds([]);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedStatus === st.id
                ? st.id === 'restock'
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : st.id === 'expired'
                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                  : 'bg-[#EAF3E6] text-[#2C5F2D] border border-[#6B9B4F]'
                : 'bg-white border border-[#E2E8DE] text-stone-500 hover:bg-stone-50'
            }`}
          >
            {st.label}
          </button>
        ))}

        {/* Multi-select toggle + Stocktake + Print Labels + Category Dropdown */}
        {selectedStatus !== 'restock' && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {!isCommercial && onOpenStocktake && (
              <button
                type="button"
                onClick={onOpenStocktake}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-[#E2E8DE] text-stone-700 hover:bg-stone-50 flex items-center gap-1 cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <span>Stocktake</span>
              </button>
            )}
            {!isCommercial && (
              <button
                type="button"
                onClick={handleExportIcs}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-[#E2E8DE] text-stone-700 hover:bg-stone-50 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                title="Export 14-day expiry reminders to Calendar (.ics)"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <span>Calendar</span>
              </button>
            )}
            {!isCommercial && onOpenLabelPrinter && (
              <button
                type="button"
                onClick={() => onOpenLabelPrinter()}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-[#E2E8DE] text-stone-700 hover:bg-stone-50 flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#2C5F2D]" />
                <span>Labels</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectionMode((v) => !v);
                setSelectedIds([]);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                selectionMode
                  ? 'bg-stone-900 text-[#A3E635]'
                  : 'bg-white border border-[#E2E8DE] text-stone-700 hover:bg-stone-50'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectionMode ? 'Done Selecting' : 'Batch Select'}</span>
            </button>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#E2E8DE] rounded-xl text-xs font-semibold text-stone-700 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {SHELF_LIFE_DATABASE.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Batch Multi-Select Action Bar */}
      {selectionMode && selectedStatus !== 'restock' && (
        <div className="bg-stone-900 text-white rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredItems.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredItems.map((i) => i.id));
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[#A3E635] font-bold cursor-pointer"
            >
              {selectedIds.length === filteredItems.length && filteredItems.length > 0
                ? 'Unselect All'
                : `Select All (${filteredItems.length})`}
            </button>
            <span className="font-bold text-stone-200">{selectedIds.length} selected</span>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await markMultipleAsUsed(selectedIds);
                  setQueuedNotice(`Marked ${selectedIds.length} item(s) as Used / Saved.`);
                  setTimeout(() => setQueuedNotice(null), 4000);
                  setSelectedIds([]);
                  setSelectionMode(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#A3E635] text-[#2C5F2D] font-extrabold cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bulk Mark Used</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await markMultipleAsFrozen(selectedIds);
                  setQueuedNotice(`Froze & extended shelf life for ${selectedIds.length} item(s).`);
                  setTimeout(() => setQueuedNotice(null), 4000);
                  setSelectedIds([]);
                  setSelectionMode(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-500 text-white font-bold cursor-pointer flex items-center gap-1"
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>Freeze &amp; Extend</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const chosen = items.filter((i) => selectedIds.includes(i.id));
                  for (const it of chosen) {
                    if (!pendingBuyNames.has(it.name.toLowerCase())) {
                      await addToRestockList({
                        name: it.name,
                        category: it.category,
                        targetQuantity: Number(it.originalQuantity || it.quantity || 1),
                        unit: it.unit,
                        storage: it.storage,
                        estimatedPrice: it.price,
                        supplierName: it.supplierName ?? null,
                        branchZone: it.branchZone ?? (preferences.branchLocation || null),
                        parLevel: it.parLevel ?? null,
                        sourceItemId: it.id,
                        reason: 'manual',
                        priority: 'normal',
                      });
                    }
                  }
                  setQueuedNotice(`Saved ${chosen.length} item(s) to Need-to-Buy list.`);
                  setTimeout(() => setQueuedNotice(null), 4000);
                  setSelectedIds([]);
                  setSelectionMode(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-stone-900 font-extrabold cursor-pointer flex items-center gap-1"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>+ Buy List</span>
              </button>

              {onOpenLabelPrinter && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenLabelPrinter(selectedIds);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-white font-bold cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5 text-[#A3E635]" />
                  <span>Print Labels</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  await markMultipleAsExpired(selectedIds);
                  setQueuedNotice(`Marked ${selectedIds.length} item(s) as Spoiled / Wasted.`);
                  setTimeout(() => setQueuedNotice(null), 4000);
                  setSelectedIds([]);
                  setSelectionMode(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold cursor-pointer flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Mark Spoiled</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completed & Need-to-Buy Procurement Workspace */}
      {selectedStatus === 'restock' ? (
        <CompletedAndBuyPanel />
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item, idx) => {
            const remDays = getRemainingDays(item.estimatedExpiryDate);
            const isUsed = item.status === 'used';
            const isExpired = item.status === 'expired';
            const isUrgent = item.status === 'active' && remDays <= 2;
            const isWarning = item.status === 'active' && remDays > 2 && remDays <= 4;
            const isBelowPar =
              item.status === 'active' &&
              item.parLevel !== null &&
              item.parLevel !== undefined &&
              Number(item.quantity) <= Number(item.parLevel);
            const isFifoFirst = isCommercial && fifoSort && item.status === 'active' && idx === 0;

            const isChecked = selectedIds.includes(item.id);
            const canFreeze = item.status === 'active' && item.storage !== 'freezer';

            return (
              <div
                key={item.id}
                onClick={
                  selectionMode
                    ? () =>
                        setSelectedIds((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        )
                    : undefined
                }
                className={`p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between group ${
                  selectionMode ? 'cursor-pointer' : ''
                } ${
                  isChecked
                    ? 'ring-2 ring-[#2C5F2D] bg-[#EAF3E6]/60 border-[#2C5F2D]'
                    : isUsed
                    ? 'bg-stone-50/70 border-stone-200 opacity-80'
                    : isExpired
                    ? 'bg-rose-50/60 border-rose-200'
                    : isUrgent
                    ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                    : 'bg-white border-[#E2E8DE] hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {selectionMode && (
                        <span className="mt-1 text-[#2C5F2D] shrink-0">
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-stone-400" />}
                        </span>
                      )}
                      {safeImageUrl(item.imageUrl) ? (
                        <img
                          src={safeImageUrl(item.imageUrl)}
                          alt={item.name}
                          className="w-12 h-12 object-contain rounded-xl bg-white p-1 border border-stone-200 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isExpired
                              ? 'bg-rose-100 text-rose-700'
                              : isUrgent
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-[#EAF3E6] text-[#2C5F2D]'
                          }`}
                        >
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isFifoFirst && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-white">
                              #1 Use First (FIFO)
                            </span>
                          )}
                          {isBelowPar && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                              Low Stock • Par {item.parLevel}
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {item.category}
                          </span>
                          <span className="text-[10px] font-semibold text-stone-500 capitalize">
                            &bull; {item.storage}
                          </span>
                          {isCommercial && item.branchZone && (
                            <span className="text-[10px] font-bold text-[#2C5F2D] bg-[#EAF3E6] px-1.5 py-0.5 rounded">
                              {item.branchZone}
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-sm text-stone-900 mt-1 truncate">
                          {item.name}
                        </h3>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-600 flex-wrap">
                          <span className="font-bold text-stone-800">
                            {item.quantity} {item.unit}
                          </span>
                          {item.price !== null && (
                            <>
                              <span>&bull;</span>
                              <span className="font-bold text-[#2C5F2D]">₹{item.price}</span>
                            </>
                          )}
                          {isCommercial && item.batchCode && (
                            <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                              Lot: {item.batchCode}
                            </span>
                          )}
                          {isCommercial && item.supplierName && (
                            <span className="text-[10px] text-stone-500">
                              &bull; {item.supplierName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expiry Badge */}
                    <div className="text-right shrink-0">
                      {isUsed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cooked (Saved)
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                          Spoiled / Wasted
                        </span>
                      ) : isUrgent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-black shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {remDays < 0 ? `Overdue ${Math.abs(remDays)}d` : remDays === 0 ? 'Expires Today!' : `${remDays}d left`}
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          {remDays} days left
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                          Fresh ({remDays}d)
                        </span>
                      )}
                      <p className="text-[10px] text-stone-400 mt-1">
                        Exp: {item.estimatedExpiryDate}
                      </p>
                    </div>
                  </div>

                  {/* Partial Usage Progress Bar if item has been partially cooked */}
                  {item.status === 'active' && item.originalQuantity && item.originalQuantity > item.quantity && (
                    <div className="mt-2.5 pt-2 border-t border-stone-100 bg-[#EAF3E6]/60 -mx-4 px-4 py-2 rounded-xl">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-stone-700 flex items-center gap-1">
                          <UtensilsCrossed className="w-3 h-3 text-[#2C5F2D]" />
                          <span>Partially Used: {item.quantity} {item.unit} left</span>
                        </span>
                        <span className="text-[#2C5F2D] font-black">
                          {Math.round((item.quantity / item.originalQuantity) * 100)}% left
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#2C5F2D] rounded-full transition-all"
                          style={{ width: `${Math.round((item.quantity / item.originalQuantity) * 100)}%` }}
                        />
                      </div>
                      {item.savedMoney && item.savedMoney > 0 ? (
                        <p className="text-[10px] text-[#2C5F2D] font-bold mt-1">
                          ✨ ₹{item.savedMoney} saved so far from cooked portions
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Notes / Usage Log Display */}
                  {item.notes && (
                    <div className="mt-2 text-[10px] text-stone-500 bg-stone-50 px-2.5 py-1 rounded-lg truncate">
                      📝 {item.notes}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-stone-100 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {item.status === 'active' && (
                      <button
                        onClick={() => setTransferringItem(item)}
                        className="p-1.5 text-stone-400 hover:text-[#2C5F2D] hover:bg-[#EAF3E6] rounded-lg transition-colors cursor-pointer"
                        title="Transfer / Split Batch to another Storage or Zone"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            deleteItem(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Delete?
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 rounded-lg bg-stone-100 text-stone-600 text-[10px] font-bold cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canFreeze && isUrgent && (
                      <button
                        onClick={async () => {
                          await freezeAndExtendItem(item.id);
                          setQueuedNotice(`Moved "${item.name}" to Freezer & extended shelf life!`);
                          setTimeout(() => setQueuedNotice(null), 4000);
                        }}
                        className="px-2 py-1 text-[10px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Move to Freezer & extend expiry automatically"
                      >
                        <Snowflake className="w-3 h-3" />
                        <span>Freeze</span>
                      </button>
                    )}

                    {item.status === 'active' && (
                      <button
                        onClick={() => setWastingItem(item)}
                        className="px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Log Spoiled / Root-Cause Waste"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Spoiled</span>
                      </button>
                    )}
                  </div>

                  {item.status === 'active' ? (
                    <div className="flex items-center gap-1.5 ml-auto">
                      {(isCommercial || isBelowPar) && !pendingBuyNames.has(item.name.toLowerCase()) && (
                        <button
                          onClick={async () => {
                            await addToRestockList({
                              name: item.name,
                              category: item.category,
                              targetQuantity: Number(item.originalQuantity || item.quantity || 1),
                              unit: item.unit,
                              storage: item.storage,
                              estimatedPrice: item.price,
                              supplierName: item.supplierName ?? null,
                              branchZone: item.branchZone ?? (preferences.branchLocation || null),
                              parLevel: item.parLevel ?? null,
                              sourceItemId: item.id,
                              reason: isBelowPar ? 'low-stock' : 'manual',
                              priority: isBelowPar ? 'urgent' : 'normal',
                              checked: false,
                              status: 'pending',
                            });
                            setQueuedNotice(`Saved "${item.name}" to your Need-to-Buy list.`);
                            setTimeout(() => setQueuedNotice(null), 4000);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>+ Buy List</span>
                        </button>
                      )}

                      <button
                        onClick={() => setActiveTab('recipes')}
                        className="px-2.5 py-1 text-[11px] font-bold text-[#2C5F2D] hover:bg-[#EAF3E6] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Recipes</span>
                      </button>

                      <button
                        onClick={() => setUsingItem(item)}
                        className="px-3 py-1.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cook / Use</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 ml-auto">
                      {!pendingBuyNames.has(item.name.toLowerCase()) ? (
                        <button
                          onClick={async () => {
                            await addToRestockList({
                              name: item.name,
                              category: item.category,
                              targetQuantity: Number(item.originalQuantity || item.quantity || 1),
                              unit: item.unit,
                              storage: item.storage,
                              estimatedPrice: item.price,
                              supplierName: item.supplierName ?? null,
                              branchZone: item.branchZone ?? (preferences.branchLocation || null),
                              parLevel: item.parLevel ?? null,
                              sourceItemId: item.id,
                              reason: isExpired ? 'expired' : 'completed',
                              priority: isExpired ? 'urgent' : 'normal',
                              checked: false,
                              status: 'pending',
                            });
                            setQueuedNotice(`Saved "${item.name}" to your Need-to-Buy list.`);
                            setTimeout(() => setQueuedNotice(null), 4000);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>+ Buy List</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-[#2C5F2D] bg-[#EAF3E6] px-2.5 py-1 rounded-lg">
                          ✓ In Buy List
                        </span>
                      )}
                      <button
                        onClick={() => setSelectedStatus('restock')}
                        className="px-3 py-1.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-[11px] font-bold rounded-xl cursor-pointer"
                      >
                        Restock &rarr;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-10 border border-[#E2E8DE] text-center max-w-md mx-auto my-6 space-y-3">
          <Package className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-extrabold text-stone-800 text-base">No items found</h3>
          <p className="text-xs text-stone-500">
            {searchQuery
              ? `No items match "${searchQuery}". Try clearing search.`
              : 'Your kitchen pantry is empty. Scan a grocery bill or barcode to populate items!'}
          </p>
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-[#2C5F2D] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Add Items Now
          </button>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 p-5 space-y-4">
            <h3 className="font-extrabold text-stone-900 text-base">Edit Item in Database</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Item Name</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: Number(e.target.value) || 1 })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={editingItem.price ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value ? Number(e.target.value) : null })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={editingItem.estimatedExpiryDate}
                  onChange={(e) => setEditingItem({ ...editingItem, estimatedExpiryDate: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Storage Location</label>
                <select
                  value={editingItem.storage}
                  onChange={(e) => setEditingItem({ ...editingItem, storage: e.target.value as StorageLocation })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl capitalize"
                >
                  <option value="fridge">Fridge ❄️</option>
                  <option value="pantry">Pantry 🍞</option>
                  <option value="freezer">Freezer 🧊</option>
                </select>
              </div>

              {isCommercial && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Batch / Lot Code</label>
                    <input
                      type="text"
                      value={editingItem.batchCode || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, batchCode: e.target.value })}
                      placeholder="e.g. LOT-204"
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Par Level (Reorder)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editingItem.parLevel ?? ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          parLevel: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Min qty"
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Supplier</label>
                    <input
                      type="text"
                      value={editingItem.supplierName || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, supplierName: e.target.value })}
                      placeholder="e.g. Metro Cash & Carry"
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">
                      {isEnterprise ? 'Branch / Warehouse Zone' : 'Prep Station / Zone'}
                    </label>
                    <input
                      type="text"
                      value={editingItem.branchZone || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, branchZone: e.target.value })}
                      placeholder={preferences.branchLocation || 'Main Walk-In'}
                      className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2 text-stone-600 font-bold text-xs bg-stone-100 hover:bg-stone-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateItem(editingItem.id, editingItem);
                  setEditingItem(null);
                }}
                className="flex-1 py-2 text-white font-bold text-xs bg-[#2C5F2D] hover:bg-[#204721] rounded-xl shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cooking & Portion Modal */}
      {usingItem && (
        <UseItemModal
          item={usingItem}
          onClose={() => setUsingItem(null)}
          onConfirm={(id, options) => markAsUsed(id, options)}
          onOpenCustomRecipe={(itemId) => {
            setUsingItem(null);
            setCustomRecipeItemId(itemId);
            setIsCustomRecipeOpen(true);
          }}
        />
      )}

      {/* Transfer / Split Batch Modal */}
      {transferringItem && (
        <TransferStockModal
          item={transferringItem}
          onClose={() => setTransferringItem(null)}
          onSuccess={(msg) => {
            setQueuedNotice(msg);
            setTimeout(() => setQueuedNotice(null), 4500);
          }}
        />
      )}

      {/* Root-Cause Waste Log Modal */}
      {wastingItem && (
        <LogWasteModal
          item={wastingItem}
          onClose={() => setWastingItem(null)}
          onSuccess={(msg) => {
            setQueuedNotice(msg);
            setTimeout(() => setQueuedNotice(null), 5000);
          }}
        />
      )}

      {/* 1-Click Cooked Leftovers & Prep Batch Timer Modal */}
      <QuickLeftoverModal
        isOpen={isLeftoverModalOpen}
        onClose={() => setIsLeftoverModalOpen(false)}
        onSaved={(_id, name) => {
          setQueuedNotice(`Started Use-By timer for "${name}" in Cooked Leftovers.`);
          setTimeout(() => setQueuedNotice(null), 4500);
        }}
        onPrintLabel={onOpenLabelPrinter ? (id) => onOpenLabelPrinter([id]) : undefined}
      />

      {/* Standalone Custom Recipe Creator Modal */}
      <CustomRecipeModal
        isOpen={isCustomRecipeOpen}
        onClose={() => {
          setIsCustomRecipeOpen(false);
          setCustomRecipeItemId(null);
        }}
        initialSelectedItemId={customRecipeItemId}
      />
    </div>
  );
};
