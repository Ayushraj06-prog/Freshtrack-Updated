/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  ShoppingCart,
  CheckCircle2,
  Plus,
  RefreshCw,
  Trash2,
  PackagePlus,
  Copy,
  Download,
  AlertTriangle,
  Check,
  History,
  X,
  ArrowRight,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateExpiryDate, estimateShelfLife, SHELF_LIFE_DATABASE } from '../data/shelfLifeData';
import { downloadSafeCsv } from '../utils/security';
import { InventoryItem, ItemCategory, RestockItem, StorageLocation } from '../types/inventory';

interface StockModalTarget {
  mode: 'from-restock' | 'from-completed';
  restockId?: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: string;
  price: number | null;
  storage: StorageLocation;
  estimatedExpiryDate: string;
  batchCode: string;
  supplierName: string;
  parLevel: string;
  branchZone: string;
}

export const CompletedAndBuyPanel: React.FC = () => {
  const {
    items,
    restockList,
    preferences,
    addItem,
    addToRestockList,
    updateRestockItem,
    removeFromRestockItem,
    syncNeededRestock,
    stockFromRestockList,
    bulkStockFromRestockList,
  } = useInventory();

  const isCommercial = preferences.operationScale !== 'household';
  const isEnterprise = preferences.operationScale === 'enterprise';

  // Quick Add to Buy List state
  const [buyName, setBuyName] = useState('');
  const [buyCategory, setBuyCategory] = useState<ItemCategory>('Vegetables');
  const [buyQty, setBuyQty] = useState(isCommercial ? '5' : '1');
  const [buyUnit, setBuyUnit] = useState('kg');
  const [buyStorage, setBuyStorage] = useState<StorageLocation>('fridge');
  const [buyPrice, setBuyPrice] = useState('');
  const [buySupplier, setBuySupplier] = useState('');
  const [buyParLevel, setBuyParLevel] = useState('');
  const [buyZone, setBuyZone] = useState(preferences.branchLocation || '');
  const [buyPriority, setBuyPriority] = useState<'normal' | 'urgent'>('normal');
  const [addingBuy, setAddingBuy] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [showStockedHistory, setShowStockedHistory] = useState(false);
  const [stockModal, setStockModal] = useState<StockModalTarget | null>(null);
  const [stockSaving, setStockSaving] = useState(false);

  const pendingBuyItems = useMemo(
    () => restockList.filter((r) => r.status === 'pending'),
    [restockList]
  );

  const recentlyStockedItems = useMemo(
    () => restockList.filter((r) => r.status === 'stocked'),
    [restockList]
  );

  const completedItems = useMemo(
    () =>
      items.filter(
        (i) => i.status === 'used' || i.status === 'expired' || Number(i.quantity) <= 0
      ),
    [items]
  );

  const pendingNamesSet = useMemo(
    () => new Set(pendingBuyItems.map((r) => r.name.toLowerCase())),
    [pendingBuyItems]
  );

  const checkedIds = useMemo(
    () => pendingBuyItems.filter((r) => r.checked).map((r) => r.id),
    [pendingBuyItems]
  );

  const totalEstimatedCost = useMemo(
    () =>
      pendingBuyItems.reduce(
        (sum, r) => sum + (r.estimatedPrice !== null && !isNaN(r.estimatedPrice) ? r.estimatedPrice : 0),
        0
      ),
    [pendingBuyItems]
  );

  const supplierGroups = useMemo(() => {
    const groups: Record<string, { supplier: string; items: RestockItem[]; totalRs: number }> = {};
    for (const r of pendingBuyItems) {
      const key = (r.supplierName || 'General Market / Kirana').trim();
      if (!groups[key]) {
        groups[key] = { supplier: key, items: [], totalRs: 0 };
      }
      groups[key].items.push(r);
      groups[key].totalRs += r.estimatedPrice && !isNaN(r.estimatedPrice) ? r.estimatedPrice : 0;
    }
    return Object.values(groups).sort((a, b) => b.totalRs - a.totalRs || b.items.length - a.items.length);
  }, [pendingBuyItems]);

  const showToast = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 4000);
  };

  const handleAddBuyItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyName.trim()) return;
    setAddingBuy(true);
    try {
      await addToRestockList({
        name: buyName.trim(),
        category: buyCategory,
        targetQuantity: Math.max(0.1, Number(buyQty) || 1),
        unit: buyUnit,
        storage: buyStorage,
        estimatedPrice: buyPrice ? Number(buyPrice) : null,
        supplierName: isCommercial && buySupplier.trim() ? buySupplier.trim() : null,
        parLevel: isCommercial && buyParLevel ? Number(buyParLevel) : null,
        branchZone: isCommercial ? (buyZone.trim() || preferences.branchLocation || null) : null,
        reason: 'manual',
        priority: buyPriority,
        checked: false,
        status: 'pending',
      });
      showToast(`Saved "${buyName.trim()}" to Need-to-Buy list.`);
      setBuyName('');
      setBuyPrice('');
    } finally {
      setAddingBuy(false);
    }
  };

  const handleSyncNeeded = async () => {
    setSyncing(true);
    try {
      const count = await syncNeededRestock();
      if (count > 0) {
        showToast(`Pulled ${count} completed / low-stock item${count > 1 ? 's' : ''} into your Buy List!`);
      } else {
        showToast('Buy List is already up-to-date with all completed & low-stock items.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleQueueCompletedItem = async (item: InventoryItem) => {
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
      reason: item.status === 'expired' ? 'expired' : 'completed',
      priority: item.parLevel !== null && item.parLevel !== undefined ? 'urgent' : 'normal',
      checked: false,
      status: 'pending',
    });
    showToast(`Added "${item.name}" to your Need-to-Buy list.`);
  };

  const openStockFromRestock = (r: RestockItem) => {
    const { days } = estimateShelfLife(r.name, r.category, r.storage);
    setStockModal({
      mode: 'from-restock',
      restockId: r.id,
      name: r.name,
      category: r.category,
      quantity: r.targetQuantity,
      unit: r.unit,
      price: r.estimatedPrice,
      storage: r.storage,
      estimatedExpiryDate: calculateExpiryDate(days),
      batchCode: '',
      supplierName: r.supplierName || '',
      parLevel: r.parLevel !== null && r.parLevel !== undefined ? String(r.parLevel) : '',
      branchZone: r.branchZone || preferences.branchLocation || '',
    });
  };

  const openStockFromCompleted = (item: InventoryItem) => {
    const { days } = estimateShelfLife(item.name, item.category, item.storage);
    setStockModal({
      mode: 'from-completed',
      name: item.name,
      category: item.category,
      quantity: Number(item.originalQuantity || item.quantity || 1),
      unit: item.unit,
      price: item.price,
      storage: item.storage,
      estimatedExpiryDate: calculateExpiryDate(days),
      batchCode: '',
      supplierName: item.supplierName || '',
      parLevel: item.parLevel !== null && item.parLevel !== undefined ? String(item.parLevel) : '',
      branchZone: item.branchZone || preferences.branchLocation || '',
    });
  };

  const handleConfirmStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal) return;
    setStockSaving(true);
    try {
      if (stockModal.mode === 'from-restock' && stockModal.restockId) {
        await stockFromRestockList(stockModal.restockId, {
          quantity: Math.max(0.1, Number(stockModal.quantity) || 1),
          unit: stockModal.unit,
          price: stockModal.price,
          storage: stockModal.storage,
          estimatedExpiryDate: stockModal.estimatedExpiryDate,
          batchCode: isCommercial && stockModal.batchCode.trim() ? stockModal.batchCode.trim() : null,
          supplierName: isCommercial && stockModal.supplierName.trim() ? stockModal.supplierName.trim() : null,
          parLevel: isCommercial && stockModal.parLevel ? Number(stockModal.parLevel) : null,
          branchZone: isCommercial ? (stockModal.branchZone.trim() || preferences.branchLocation || null) : null,
        });
      } else {
        await addItem({
          name: stockModal.name,
          category: stockModal.category,
          quantity: Math.max(0.1, Number(stockModal.quantity) || 1),
          unit: stockModal.unit,
          price: stockModal.price,
          storage: stockModal.storage,
          purchaseDate: new Date().toISOString().split('T')[0],
          estimatedExpiryDate: stockModal.estimatedExpiryDate,
          status: 'active',
          source: 'manual',
          batchCode: isCommercial && stockModal.batchCode.trim() ? stockModal.batchCode.trim() : null,
          supplierName: isCommercial && stockModal.supplierName.trim() ? stockModal.supplierName.trim() : null,
          parLevel: isCommercial && stockModal.parLevel ? Number(stockModal.parLevel) : null,
          branchZone: isCommercial ? (stockModal.branchZone.trim() || preferences.branchLocation || null) : null,
          notes: 'Restocked from Completed History',
        });
      }
      showToast(`Stocked "${stockModal.name}" (${stockModal.quantity} ${stockModal.unit}) into Active Inventory!`);
      setStockModal(null);
    } finally {
      setStockSaving(false);
    }
  };

  const handleBulkStockChecked = async () => {
    if (checkedIds.length === 0) return;
    const stocked = await bulkStockFromRestockList(checkedIds);
    showToast(`Stocked ${stocked.length} purchased item(s) directly into Active Inventory!`);
  };

  const handleCopyWhatsApp = async () => {
    if (pendingBuyItems.length === 0) return;
    const orgHeader = preferences.organizationName
      ? `Purchase / Restock Order — ${preferences.organizationName}`
      : 'FreshTrack Need-to-Buy List';
    const lines = pendingBuyItems.map(
      (r, idx) =>
        `${idx + 1}. ${r.name} — ${r.targetQuantity} ${r.unit}${
          r.supplierName ? ` (${r.supplierName})` : ''
        }${r.estimatedPrice ? ` ~₹${r.estimatedPrice}` : ''}${r.priority === 'urgent' ? ' [URGENT]' : ''}`
    );
    const text = `${orgHeader}\n${lines.join('\n')}\nEstimated Total: ₹${totalEstimatedCost.toLocaleString('en-IN')}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied Buy List to clipboard for WhatsApp / Supplier!');
    } catch {
      showToast('Could not access clipboard.');
    }
  };

  const handleExportBuyCsv = () => {
    if (pendingBuyItems.length === 0) return;
    const headers = ['Item Name', 'Category', 'Buy Qty', 'Unit', 'Storage', 'Est Price (INR)', 'Priority', 'Reason', 'Supplier', 'Branch/Zone'];
    const rows = pendingBuyItems.map((r) => [
      r.name,
      r.category,
      r.targetQuantity,
      r.unit,
      r.storage,
      r.estimatedPrice ?? '',
      r.priority,
      r.reason,
      r.supplierName || '',
      r.branchZone || preferences.branchLocation || '',
    ]);
    downloadSafeCsv(`freshtrack_buy_order_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Header Summary Strip */}
      <div className="bg-gradient-to-br from-[#2C5F2D] to-[#1d421e] text-white rounded-3xl p-5 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-[#A3E635]">
              {isCommercial ? 'Commercial Procurement & Restock' : 'Kitchen Restock & Buy List'}
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold mt-1">
              Completed Items, Need-to-Buy &amp; Instant Restock
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              See finished stock, save items you need to buy, send supplier orders, and stock purchased goods back into active inventory in 1 tap.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncNeeded}
              disabled={syncing}
              className="px-3.5 py-2 rounded-xl bg-[#A3E635] hover:bg-[#b5f548] text-[#2C5F2D] text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-70"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Pull Completed &amp; Low Stock</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-white/15 text-xs">
          <div className="bg-white/10 p-3 rounded-2xl">
            <span className="text-white/70 text-[11px] block">Need to Buy</span>
            <span className="text-lg font-black">{pendingBuyItems.length} items</span>
          </div>
          <div className="bg-white/10 p-3 rounded-2xl">
            <span className="text-white/70 text-[11px] block">Est. Order Total</span>
            <span className="text-lg font-black">₹{totalEstimatedCost.toLocaleString('en-IN')}</span>
          </div>
          <div className="bg-white/10 p-3 rounded-2xl">
            <span className="text-white/70 text-[11px] block">Completed / Depleted</span>
            <span className="text-lg font-black">{completedItems.length} items</span>
          </div>
          <div className="bg-white/10 p-3 rounded-2xl">
            <span className="text-white/70 text-[11px] block">Recently Restocked</span>
            <span className="text-lg font-black">{recentlyStockedItems.length} batches</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMsg && (
        <div className="p-3 bg-[#EAF3E6] border border-[#6B9B4F] rounded-2xl text-xs font-bold text-[#2C5F2D] flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
          <button onClick={() => setBannerMsg(null)} className="text-[11px] underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Save Item to Buy List Form */}
      <form
        onSubmit={handleAddBuyItem}
        className="bg-white border border-[#E2E8DE] rounded-3xl p-4 sm:p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#2C5F2D]" />
            <span>Save New Item to Need-to-Buy List</span>
          </h4>
          <span className="text-[11px] text-stone-400 font-medium">Persisted in SQLite</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <input
            type="text"
            required
            value={buyName}
            onChange={(e) => setBuyName(e.target.value)}
            placeholder={isCommercial ? 'Item (e.g. Amul Butter 5kg)' : 'Item to buy (e.g. Fresh Milk)'}
            className="col-span-2 sm:col-span-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none font-semibold"
          />

          <div className="flex gap-1">
            <input
              type="number"
              min="0.1"
              step="any"
              value={buyQty}
              onChange={(e) => setBuyQty(e.target.value)}
              className="w-16 px-2 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-center"
              title="Quantity to buy"
            />
            <select
              value={buyUnit}
              onChange={(e) => setBuyUnit(e.target.value)}
              className="flex-1 px-2 py-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="pack">pack</option>
              <option value="pcs">pcs</option>
              <option value="crate">crate</option>
              <option value="bunch">bunch</option>
            </select>
          </div>

          <select
            value={buyCategory}
            onChange={(e) => setBuyCategory(e.target.value as ItemCategory)}
            className="px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-medium"
          >
            {SHELF_LIFE_DATABASE.map((r) => (
              <option key={r.category} value={r.category}>
                {r.category}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder="Est. ₹"
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
          />

          <button
            type="submit"
            disabled={addingBuy}
            className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={buyStorage}
            onChange={(e) => setBuyStorage(e.target.value as StorageLocation)}
            className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-medium"
          >
            <option value="fridge">Store in Fridge ❄️</option>
            <option value="pantry">Store in Pantry 🍞</option>
            <option value="freezer">Store in Freezer 🧊</option>
          </select>

          <button
            type="button"
            onClick={() => setBuyPriority((p) => (p === 'urgent' ? 'normal' : 'urgent'))}
            className={`px-2.5 py-1.5 rounded-xl font-bold border cursor-pointer ${
              buyPriority === 'urgent'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-stone-50 text-stone-600 border-stone-200'
            }`}
          >
            {buyPriority === 'urgent' ? '🔥 Urgent Priority' : 'Normal Priority'}
          </button>

          {isCommercial && (
            <>
              <input
                type="text"
                value={buySupplier}
                onChange={(e) => setBuySupplier(e.target.value)}
                placeholder="Supplier (e.g. Hyperpure)"
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl flex-1 min-w-[140px]"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={buyParLevel}
                onChange={(e) => setBuyParLevel(e.target.value)}
                placeholder="Par Level"
                className="w-24 px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl"
              />
              {isEnterprise && (
                <input
                  type="text"
                  value={buyZone}
                  onChange={(e) => setBuyZone(e.target.value)}
                  placeholder="Branch / Zone"
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl flex-1 min-w-[130px]"
                />
              )}
            </>
          )}
        </div>
      </form>

      {/* Section 1: Need to Buy Queue */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#2C5F2D]" />
            <h4 className="font-extrabold text-sm text-stone-900">
              Need to Buy &amp; Stock ({pendingBuyItems.length})
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {checkedIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkStockChecked}
                className="px-3 py-1.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5 text-[#A3E635]" />
                <span>Stock Selected ({checkedIds.length})</span>
              </button>
            )}

            {pendingBuyItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Order</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportBuyCsv}
                  className="px-2.5 py-1.5 rounded-xl bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PO CSV</span>
                </button>
              </>
            )}

            {recentlyStockedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStockedHistory((v) => !v)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 font-bold cursor-pointer"
              >
                {showStockedHistory ? 'Hide Stocked' : `Stocked (${recentlyStockedItems.length})`}
              </button>
            )}
          </div>
        </div>

        {pendingBuyItems.length > 0 ? (
          <div className="space-y-2">
            {pendingBuyItems.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  entry.checked
                    ? 'bg-[#EAF3E6]/70 border-[#2C5F2D]'
                    : entry.priority === 'urgent'
                    ? 'bg-amber-50/50 border-amber-300'
                    : 'bg-stone-50/60 border-stone-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onChange={(e) => updateRestockItem(entry.id, { checked: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-[#2C5F2D] focus:ring-[#2C5F2D] cursor-pointer"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {entry.priority === 'urgent' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                          Urgent
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          entry.reason === 'low-stock'
                            ? 'bg-rose-100 text-rose-800'
                            : entry.reason === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : entry.reason === 'expired'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {entry.reason === 'low-stock'
                          ? 'Below Par'
                          : entry.reason === 'completed'
                          ? 'Completed'
                          : entry.reason === 'expired'
                          ? 'Replace Spoiled'
                          : 'Saved Manually'}
                      </span>
                      <span className="text-[10px] text-stone-500 font-semibold">
                        {entry.category} &bull; {entry.storage}
                      </span>
                      {isCommercial && entry.branchZone && (
                        <span className="text-[10px] font-bold text-[#2C5F2D] bg-[#EAF3E6] px-1.5 py-0.5 rounded">
                          {entry.branchZone}
                        </span>
                      )}
                    </div>

                    <p className="font-extrabold text-sm text-stone-900 mt-1 truncate">{entry.name}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-600">
                      <span className="font-bold text-stone-800">
                        Buy: {entry.targetQuantity} {entry.unit}
                      </span>
                      {entry.estimatedPrice !== null && (
                        <>
                          <span>&bull;</span>
                          <span className="font-bold text-[#2C5F2D]">Est. ₹{entry.estimatedPrice}</span>
                        </>
                      )}
                      {isCommercial && entry.supplierName && (
                        <span className="text-[11px] text-stone-500">&bull; Supplier: {entry.supplierName}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => openStockFromRestock(entry)}
                    className="px-3 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-[#A3E635]" />
                    <span>Buy &amp; Stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeFromRestockItem(entry.id)}
                    title="Remove from Buy List"
                    className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-stone-500 space-y-2">
            <ShoppingCart className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="font-bold text-stone-700">Your Need-to-Buy list is empty.</p>
            <p>
              Save an item above, click <strong>"Pull Completed &amp; Low Stock"</strong>, or mark a completed item below to queue it here.
            </p>
          </div>
        )}

        {/* Recently Stocked Archive */}
        {showStockedHistory && recentlyStockedItems.length > 0 && (
          <div className="pt-3 border-t border-stone-100 space-y-2">
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Recently Purchased &amp; Stocked
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recentlyStockedItems.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-stone-800 truncate">{r.name}</p>
                    <p className="text-[10px] text-emerald-700 font-semibold">
                      ✓ Stocked {r.targetQuantity} {r.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateRestockItem(r.id, { status: 'pending' })}
                      className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-[10px] font-bold cursor-pointer"
                    >
                      Order Again
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromRestockItem(r.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 1.5: Supplier / Vendor Order Split (when pending items exist) */}
      {supplierGroups.length > 0 && (
        <div className="bg-white border border-[#E2E8DE] rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-stone-900">
              Supplier / Vendor Order Breakdown ({supplierGroups.length})
            </h4>
            <span className="text-[11px] text-stone-500">
              Copy vendor-specific lists for WhatsApp or PO
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {supplierGroups.map((g) => (
              <div
                key={g.supplier}
                className="p-3 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE] flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-stone-900 truncate">{g.supplier}</p>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {g.items.length} item{g.items.length > 1 ? 's' : ''}
                    {g.totalRs > 0 ? ` • Est ₹${g.totalRs.toLocaleString('en-IN')}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const header = `${g.supplier} Order${preferences.organizationName ? ` — ${preferences.organizationName}` : ''}`;
                    const lines = g.items.map(
                      (it, idx) => `${idx + 1}. ${it.name} — ${it.targetQuantity} ${it.unit}${it.priority === 'urgent' ? ' [URGENT]' : ''}`
                    );
                    try {
                      await navigator.clipboard.writeText(`${header}\n${lines.join('\n')}`);
                      showToast(`Copied order for "${g.supplier}" (${g.items.length} items)!`);
                    } catch {
                      showToast('Could not access clipboard.');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#EAF3E6] border border-stone-200 hover:border-[#6B9B4F] text-[#2C5F2D] font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy PO</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Completed / Finished & Spoiled Items */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#2C5F2D]" />
            <h4 className="font-extrabold text-sm text-stone-900">
              Completed &amp; Depleted Items ({completedItems.length})
            </h4>
          </div>
          <span className="text-[11px] text-stone-500">
            Finished batches &amp; items ready to reorder
          </span>
        </div>

        {completedItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {completedItems.map((item) => {
              const alreadyInBuyList = pendingNamesSet.has(item.name.toLowerCase());
              const isExpired = item.status === 'expired';
              const origQty = item.originalQuantity || item.quantity || 1;
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/60 flex flex-col justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isExpired
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isExpired ? (
                            <>
                              <AlertTriangle className="w-3 h-3" /> Expired / Loss
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-stone-500 font-semibold">
                          {item.category} &bull; {item.storage}
                        </span>
                      </div>
                      <h5 className="font-extrabold text-sm text-stone-900 mt-1 truncate">{item.name}</h5>
                      <p className="text-[11px] text-stone-600 mt-0.5">
                        Last batch: <strong>{origQty} {item.unit}</strong>
                        {item.price !== null ? ` • ₹${item.price}` : ''}
                        {item.usedAt ? ` • Finished ${item.usedAt.split('T')[0]}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-200/70">
                    {alreadyInBuyList ? (
                      <span className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] font-bold text-center flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>In Buy List</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQueueCompletedItem(item)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-[#EAF3E6] border border-[#E2E8DE] hover:border-[#6B9B4F] text-stone-800 font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#2C5F2D]" />
                        <span>Add to Buy List</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openStockFromCompleted(item)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5 text-[#A3E635]" />
                      <span>Restock Now</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-stone-500">
            No completed or depleted items yet. When items are 100% consumed, they will appear here ready for reordering.
          </div>
        )}
      </div>

      {/* Stock Into Active Inventory Confirmation Modal */}
      {stockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmStock}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E2E8DE] p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF3E6] text-[#2C5F2D]">
                  Restock Into Active Kitchen
                </span>
                <h3 className="font-extrabold text-stone-900 text-base mt-1">{stockModal.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setStockModal(null)}
                className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Stock Qty</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={stockModal.quantity}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, quantity: Number(e.target.value) || 1 })
                  }
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Unit</label>
                <input
                  type="text"
                  required
                  value={stockModal.unit}
                  onChange={(e) => setStockModal({ ...stockModal, unit: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Cost Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={stockModal.price ?? ''}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Storage Location</label>
                <select
                  value={stockModal.storage}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, storage: e.target.value as StorageLocation })
                  }
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl capitalize"
                >
                  <option value="fridge">Fridge ❄️</option>
                  <option value="pantry">Pantry 🍞</option>
                  <option value="freezer">Freezer 🧊</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">New Expiry Date</label>
                <input
                  type="date"
                  required
                  value={stockModal.estimatedExpiryDate}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, estimatedExpiryDate: e.target.value })
                  }
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
                />
              </div>
            </div>

            {isCommercial && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-100">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">New Batch / Lot Code</label>
                  <input
                    type="text"
                    value={stockModal.batchCode}
                    onChange={(e) => setStockModal({ ...stockModal, batchCode: e.target.value })}
                    placeholder="e.g. LOT-305"
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Par Level</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={stockModal.parLevel}
                    onChange={(e) => setStockModal({ ...stockModal, parLevel: e.target.value })}
                    placeholder="Min threshold"
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Supplier</label>
                  <input
                    type="text"
                    value={stockModal.supplierName}
                    onChange={(e) => setStockModal({ ...stockModal, supplierName: e.target.value })}
                    placeholder="Supplier name"
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    {isEnterprise ? 'Branch / Zone' : 'Prep Station'}
                  </label>
                  <input
                    type="text"
                    value={stockModal.branchZone}
                    onChange={(e) => setStockModal({ ...stockModal, branchZone: e.target.value })}
                    placeholder="Main Walk-In"
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStockModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={stockSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-70"
              >
                <PackagePlus className="w-4 h-4 text-[#A3E635]" />
                <span>{stockSaving ? 'Stocking...' : 'Confirm & Stock Item'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
