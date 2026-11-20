/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Truck,
  Thermometer,
  BookOpen,
  Plus,
  Trash2,
  Copy,
  Download,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Search,
  ShoppingCart,
  Phone,
  ShieldCheck,
  ClipboardCheck,
  RotateCcw,
  CheckSquare,
  Square,
  Activity,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { SHELF_LIFE_DATABASE, getRemainingDays } from '../data/shelfLifeData';
import { ChecklistCategory, StorageZoneType, Supplier } from '../types/inventory';

const INDIAN_STORAGE_TIPS: Record<string, string> = {
  Dairy: 'Store Paneer submerged in fresh drinking water inside an airtight box and change water every 2 days to double freshness. Keep milk on middle shelf, not the warm fridge door.',
  'Leafy Greens': 'Wash, spin-dry completely, and wrap Coriander, Palak, or Mint loosely in dry cotton/paper towel inside a perforated zip bag — stays crisp up to 8–10 days.',
  Vegetables: 'Keep Onions, Potatoes, and Garlic in cool, dark ventilated baskets (never fridge). Keep Tomatoes stem-side down; freeze excess green chillies with stems removed.',
  Fruits: 'Store Bananas away from Apples/Tomatoes (ethylene speeds ripening). Refrigerate cut fruits in glass containers with a squeeze of lime.',
  'Bakery & Bread': 'Freeze half the loaf immediately on Day 1 — toast straight from frozen for zero mould waste.',
  'Cooked Leftovers': 'Cool curries/dal within 90 minutes before refrigerating in shallow containers. Label prep date and use within 48–72 hours.',
  'Eggs, Meat & Poultry': 'Keep raw meat/fish on the bottom-most fridge shelf in leak-proof trays at 0–4°C; portion and deep-freeze at -18°C if unused within 24 hours.',
  'Pulses & Dal': 'Sun-dry or lightly dry-roast bulk dal/besan before storing in airtight steel/glass jars with 2–3 dried bay leaves or cloves to prevent weevils.',
  'Grains & Flours': 'Store Whole Wheat Atta in airtight steel drums away from stove humidity; refrigerate small batches of besan/suji during monsoon.',
  'Spices & Condiments': 'Keep whole masalas away from steam and direct sunlight. Use dry spoons for pickles/chutneys to prevent fungal growth.',
  'Snacks & Packaged': 'Clip opened packets tightly or decant into silicone-sealed jars immediately after opening.',
  Beverages: 'Refrigerate opened tetra-packs and cold-pressed juices immediately; consume within 3–4 days.',
  Other: 'Apply FIFO (First-In, First-Out): place newer purchases behind older stock every time you restock.',
};

const TEMP_GUIDELINES: Record<StorageZoneType, { label: string; safeRange: string; defaultTemp: string }> = {
  fridge: { label: 'Fridge / Walk-In Cooler', safeRange: '0°C to 4.5°C', defaultTemp: '3.2' },
  freezer: { label: 'Deep Freezer', safeRange: '≤ -18°C', defaultTemp: '-19.0' },
  pantry: { label: 'Dry Store / Pantry', safeRange: '10°C to 25°C', defaultTemp: '21.0' },
  'hot-hold': { label: 'Hot Holding / Bain-Marie', safeRange: '≥ 63°C', defaultTemp: '68.0' },
};

interface OperationsViewProps {
  onOpenStocktake?: () => void;
}

export const OperationsView: React.FC<OperationsViewProps> = ({ onOpenStocktake }) => {
  const {
    items,
    restockList,
    suppliers,
    storageLogs,
    checklists,
    preferences,
    saveSupplier,
    deleteSupplier,
    addStorageLog,
    deleteStorageLog,
    saveChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    resetDailyChecklists,
    addToRestockList,
  } = useInventory();

  const isCommercial = preferences.operationScale !== 'household';
  const [subTab, setSubTab] = useState<'suppliers' | 'temperature' | 'checklists' | 'guide'>('suppliers');
  const [toast, setToast] = useState<string | null>(null);

  // Checklist & Handover form state
  const [chkTitle, setChkTitle] = useState('');
  const [chkCategory, setChkCategory] = useState<ChecklistCategory>('opening');
  const [chkAssignee, setChkAssignee] = useState('');
  const [chkNotes, setChkNotes] = useState('');

  // Supplier form state
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCategories, setSupCategories] = useState('');
  const [supLeadDays, setSupLeadDays] = useState('1');
  const [supTerms, setSupTerms] = useState('');
  const [supNotes, setSupNotes] = useState('');

  // Temperature log form state
  const [zoneName, setZoneName] = useState(isCommercial ? 'Walk-In Chiller #1' : 'Kitchen Fridge');
  const [zoneType, setZoneType] = useState<StorageZoneType>('fridge');
  const [tempC, setTempC] = useState('3.2');
  const [humidityPct, setHumidityPct] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [tempNotes, setTempNotes] = useState('');

  // Guide search
  const [guideSearch, setGuideSearch] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Discover unregistered suppliers referenced in items or restockList
  const discoveredSupplierNames = useMemo(() => {
    const savedNames = new Set(suppliers.map((s) => s.name.toLowerCase()));
    const discovered = new Set<string>();
    items.forEach((i) => {
      if (i.supplierName && !savedNames.has(i.supplierName.toLowerCase())) {
        discovered.add(i.supplierName);
      }
    });
    restockList.forEach((r) => {
      if (r.supplierName && !savedNames.has(r.supplierName.toLowerCase())) {
        discovered.add(r.supplierName);
      }
    });
    return Array.from(discovered);
  }, [items, restockList, suppliers]);

  // Price Drift / Inflation Tracker across item history
  const priceDriftRows = useMemo(() => {
    const byName: Record<string, { name: string; unit: string; records: { date: string; price: number; supplier?: string }[] }> = {};
    for (const it of items) {
      if (it.price === null || it.price === undefined || isNaN(it.price)) continue;
      const key = it.name.trim().toLowerCase();
      if (!byName[key]) {
        byName[key] = { name: it.name, unit: it.unit, records: [] };
      }
      byName[key].records.push({
        date: it.purchaseDate || it.createdAt || '',
        price: Number(it.price),
        supplier: it.supplierName || undefined,
      });
    }

    return Object.values(byName)
      .map((entry) => {
        const sorted = [...entry.records].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        const deltaRs = prev ? latest.price - prev.price : 0;
        const deltaPct = prev && prev.price > 0 ? Math.round((deltaRs / prev.price) * 100) : 0;
        const minPrice = Math.min(...sorted.map((r) => r.price));
        return {
          name: entry.name,
          unit: entry.unit,
          latestPrice: latest.price,
          previousPrice: prev ? prev.price : null,
          deltaRs,
          deltaPct,
          minPrice,
          supplier: latest.supplier,
          purchaseCount: sorted.length,
        };
      })
      .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || b.latestPrice - a.latestPrice);
  }, [items]);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;
    await saveSupplier({
      id: editingSupId || undefined,
      name: supName.trim(),
      contactName: supContact.trim() || null,
      phone: supPhone.trim() || null,
      whatsapp: supPhone.trim() || null,
      categories: supCategories.trim() || null,
      leadTimeDays: Math.max(0, Number(supLeadDays) || 1),
      paymentTerms: supTerms.trim() || null,
      notes: supNotes.trim() || null,
    });
    showToast(`Saved supplier "${supName.trim()}"!`);
    setEditingSupId(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupCategories('');
    setSupLeadDays('1');
    setSupTerms('');
    setSupNotes('');
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupId(s.id);
    setSupName(s.name);
    setSupContact(s.contactName || '');
    setSupPhone(s.phone || s.whatsapp || '');
    setSupCategories(s.categories || '');
    setSupLeadDays(String(s.leadTimeDays ?? 1));
    setSupTerms(s.paymentTerms || '');
    setSupNotes(s.notes || '');
  };

  const handleCopyVendorOrder = async (sup: Supplier) => {
    const pending = restockList.filter(
      (r) => r.status === 'pending' && (r.supplierName || '').toLowerCase() === sup.name.toLowerCase()
    );
    const header = `Purchase Order for ${sup.name}${preferences.organizationName ? ` — From ${preferences.organizationName}` : ''}`;
    const body =
      pending.length > 0
        ? pending.map((p, idx) => `${idx + 1}. ${p.name} — ${p.targetQuantity} ${p.unit}${p.priority === 'urgent' ? ' [URGENT]' : ''}`).join('\n')
        : 'Please share today’s updated rate card and availability.';
    try {
      await navigator.clipboard.writeText(`${header}\n${body}`);
      showToast(`Copied order message for ${sup.name} (${pending.length} queued items)!`);
    } catch {
      showToast('Could not access clipboard.');
    }
  };

  const handleAddTempLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim() || tempC === '') return;
    const saved = await addStorageLog({
      zoneName: zoneName.trim(),
      zoneType,
      temperatureC: Number(tempC),
      humidityPct: humidityPct ? Number(humidityPct) : null,
      checkedBy: checkedBy.trim() || null,
      branchZone: preferences.branchLocation || null,
      notes: tempNotes.trim() || null,
    });
    showToast(
      saved.status === 'pass'
        ? `Logged ${saved.temperatureC}°C for ${saved.zoneName} — FSSAI Safe Range PASS.`
        : `Logged ${saved.temperatureC}°C for ${saved.zoneName} — ${saved.status.toUpperCase()} outside safe range!`
    );
    setTempNotes('');
  };

  const handleExportTempCsv = () => {
    if (storageLogs.length === 0) return;
    const headers = ['Timestamp', 'Zone Name', 'Zone Type', 'Temperature (C)', 'Humidity (%)', 'Compliance Status', 'Checked By', 'Branch', 'Notes'];
    const rows = storageLogs.map((l) => [
      l.loggedAt,
      `"${l.zoneName.replace(/"/g, '""')}"`,
      l.zoneType,
      l.temperatureC,
      l.humidityPct ?? '',
      l.status.toUpperCase(),
      `"${(l.checkedBy || '').replace(/"/g, '""')}"`,
      `"${(l.branchZone || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `freshtrack_fssai_temp_log_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const passRate = useMemo(() => {
    if (storageLogs.length === 0) return 100;
    const passCount = storageLogs.filter((l) => l.status === 'pass').length;
    return Math.round((passCount / storageLogs.length) * 100);
  }, [storageLogs]);

  const filteredGuide = useMemo(() => {
    const q = guideSearch.trim().toLowerCase();
    if (!q) return SHELF_LIFE_DATABASE;
    return SHELF_LIFE_DATABASE.filter(
      (rule) =>
        rule.category.toLowerCase().includes(q) ||
        rule.keywords.some((k) => k.toLowerCase().includes(q)) ||
        (INDIAN_STORAGE_TIPS[rule.category] || '').toLowerCase().includes(q)
    );
  }, [guideSearch]);

  // Consumption Velocity & Days-of-Cover Forecaster
  const velocityForecast = useMemo(() => {
    const active = items.filter((i) => i.status === 'active');
    const pendingNames = new Set(
      restockList.filter((r) => r.status === 'pending').map((r) => r.name.toLowerCase())
    );
    const todayMs = Date.now();

    return active
      .map((item) => {
        const purchaseMs = new Date(item.purchaseDate).getTime();
        const elapsedDays = Math.max(1, Math.round((todayMs - purchaseMs) / (1000 * 60 * 60 * 24)));
        const orig = Number(item.originalQuantity || item.quantity || 1);
        const curr = Number(item.quantity || 0);
        const usedSoFar = Math.max(0, orig - curr);
        // Count historical finished batches with same name
        const priorUsedCount = items.filter(
          (other) =>
            other.id !== item.id &&
            other.status === 'used' &&
            other.name.toLowerCase() === item.name.toLowerCase()
        ).length;

        const dailyBurn =
          usedSoFar > 0
            ? usedSoFar / elapsedDays
            : priorUsedCount > 0
            ? (orig * 0.18)
            : orig / Math.max(4, getRemainingDays(item.estimatedExpiryDate) + elapsedDays);

        const daysOfCover = dailyBurn > 0 ? Math.max(0.5, Math.round((curr / dailyBurn) * 10) / 10) : 14;
        const suggestedPar = Math.max(1, Number((dailyBurn * (isCommercial ? 3 : 2)).toFixed(1)));
        const daysToExpiry = getRemainingDays(item.estimatedExpiryDate);

        return {
          item,
          dailyBurn: Number(dailyBurn.toFixed(2)),
          daysOfCover,
          suggestedPar,
          daysToExpiry,
          inBuyList: pendingNames.has(item.name.toLowerCase()),
        };
      })
      .sort((a, b) => a.daysOfCover - b.daysOfCover)
      .slice(0, 8);
  }, [items, restockList, isCommercial]);

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chkTitle.trim()) return;
    await saveChecklistItem({
      title: chkTitle.trim(),
      category: chkCategory,
      assignedTo: chkAssignee.trim() || null,
      notes: chkNotes.trim() || null,
      completed: false,
    });
    setChkTitle('');
    setChkAssignee('');
    setChkNotes('');
    showToast(chkCategory === 'handover' ? 'Posted shift handover note!' : 'Added checklist item!');
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header & Sub-Navigation */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-stone-900">
            {isCommercial ? 'Suppliers, Cold-Chain & Kitchen SOPs' : 'Vendors, Fridge Hygiene & Storage Guide'}
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Manage vendors, track ingredient price changes, log FSSAI storage temperatures, and optimize Indian shelf life.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('suppliers')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'suppliers' ? 'bg-white text-[#2C5F2D] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Suppliers &amp; Prices</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('temperature')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'temperature' ? 'bg-white text-[#2C5F2D] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Cold-Chain</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('checklists')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'checklists' ? 'bg-white text-[#2C5F2D] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>SOP &amp; Forecast</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('guide')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              subTab === 'guide' ? 'bg-white text-[#2C5F2D] shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Storage Guide</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-2xl bg-[#EAF3E6] border border-[#6B9B4F] text-[#2C5F2D] text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* SUB-TAB 1: SUPPLIERS & PRICE DRIFT */}
      {subTab === 'suppliers' && (
        <div className="space-y-5">
          {/* Add / Edit Supplier Form */}
          <form
            onSubmit={handleSaveSupplier}
            className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-extrabold text-sm text-stone-900">
                {editingSupId ? 'Update Supplier Profile' : 'Add Supplier / Kirana / Wholesale Vendor'}
              </h3>
              {editingSupId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupId(null);
                    setSupName('');
                  }}
                  className="text-stone-500 hover:text-stone-800 font-bold cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Vendor / Store Name *</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Hyperpure / Metro / Local Mandi"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Contact Person</label>
                <input
                  type="text"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  placeholder="e.g. Rajesh Traders"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Lead Time (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={supLeadDays}
                  onChange={(e) => setSupLeadDays(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-stone-700 block mb-1">Categories Supplied</label>
                <input
                  type="text"
                  value={supCategories}
                  onChange={(e) => setSupCategories(e.target.value)}
                  placeholder="Dairy, Vegetables, Pulses & Dal"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={supTerms}
                  onChange={(e) => setSupTerms(e.target.value)}
                  placeholder="UPI / Net 15 / COD"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingSupId ? 'Update Vendor' : 'Save Vendor'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Auto-discovered suppliers from existing stock */}
          {discoveredSupplierNames.length > 0 && (
            <div className="bg-[#EAF3E6] border border-[#6B9B4F]/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#2C5F2D]">
                Found {discoveredSupplierNames.length} vendor(s) used in your stock that aren&apos;t in your directory yet:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {discoveredSupplierNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => saveSupplier({ name, leadTimeDays: 1 })}
                    className="px-2.5 py-1 rounded-lg bg-white border border-[#6B9B4F]/40 text-[#2C5F2D] font-bold hover:bg-[#2C5F2D] hover:text-white transition-colors cursor-pointer"
                  >
                    + Save &quot;{name}&quot;
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved Suppliers Grid */}
          <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-extrabold text-sm text-stone-900">
                Vendor Directory ({suppliers.length})
              </h3>
              <span className="text-xs text-stone-500">Linked live to your Buy List &amp; Stock</span>
            </div>

            {suppliers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suppliers.map((sup) => {
                  const pendingForSup = restockList.filter(
                    (r) => r.status === 'pending' && (r.supplierName || '').toLowerCase() === sup.name.toLowerCase()
                  );
                  const pendingRs = pendingForSup.reduce((s, r) => s + (r.estimatedPrice || 0), 0);
                  const activeCount = items.filter(
                    (i) => i.status === 'active' && (i.supplierName || '').toLowerCase() === sup.name.toLowerCase()
                  ).length;

                  return (
                    <div
                      key={sup.id}
                      className="p-4 rounded-2xl border border-[#E2E8DE] bg-[#F7F8F4]/70 flex flex-col justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-extrabold text-sm text-stone-900">{sup.name}</h4>
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              {sup.contactName || 'Primary Supplier'} · {sup.leadTimeDays}d lead time
                              {sup.paymentTerms ? ` · ${sup.paymentTerms}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditSupplier(sup)}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSupplier(sup.id)}
                              className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                              aria-label={`Delete ${sup.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {sup.categories && (
                          <p className="text-[11px] text-stone-600 mt-2">
                            Supplies: <span className="font-semibold text-stone-800">{sup.categories}</span>
                          </p>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-stone-200/80 flex items-center justify-between text-[11px] tabular-nums text-stone-600">
                          <span>Active stock: <strong className="text-stone-900">{activeCount} SKUs</strong></span>
                          <span>
                            Pending PO:{' '}
                            <strong className="text-[#2C5F2D]">
                              {pendingForSup.length} items{pendingRs > 0 ? ` (₹${pendingRs.toLocaleString('en-IN')})` : ''}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {sup.phone ? (
                          <span className="text-[11px] font-mono text-stone-600 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#2C5F2D]" />
                            {sup.phone}
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-400">No phone saved</span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyVendorOrder(sup)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAF3E6] border border-[#E2E8DE] hover:border-[#6B9B4F] text-[#2C5F2D] font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy PO</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-500">
                No suppliers saved yet. Add your preferred dairy, vegetable mandi, wholesale vendor, or quick-commerce store above.
              </div>
            )}
          </div>

          {/* Ingredient Price History & Inflation Tracker */}
          <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <h3 className="font-extrabold text-sm text-stone-900">
                  Ingredient Price History &amp; Drift Tracker
                </h3>
                <p className="text-[11px] text-stone-500">
                  Tracks paid prices across restocks to spot supplier price increases early.
                </p>
              </div>
              <span className="text-xs font-bold text-stone-500 tabular-nums">
                {priceDriftRows.length} priced SKUs
              </span>
            </div>

            {priceDriftRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-stone-200 text-[11px] text-stone-500">
                      <th className="py-2 pr-3 font-bold">Item</th>
                      <th className="py-2 px-3 font-bold">Supplier</th>
                      <th className="py-2 px-3 font-bold text-right">Latest Price</th>
                      <th className="py-2 px-3 font-bold text-right">Best Paid</th>
                      <th className="py-2 pl-3 font-bold text-right">Price Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 tabular-nums">
                    {priceDriftRows.slice(0, 12).map((row) => (
                      <tr key={row.name} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-3 font-bold text-stone-900">
                          {row.name}
                          <span className="text-stone-400 font-normal ml-1.5">
                            ({row.purchaseCount}×)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">{row.supplier || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                          ₹{row.latestPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                          ₹{row.minPrice.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-bold">
                          {row.previousPrice === null ? (
                            <span className="text-stone-400 font-normal">Baseline</span>
                          ) : row.deltaRs > 0 ? (
                            <span className="text-rose-700 inline-flex items-center gap-0.5">
                              <TrendingUp className="w-3.5 h-3.5" /> +₹{row.deltaRs} (+{row.deltaPct}%)
                            </span>
                          ) : row.deltaRs < 0 ? (
                            <span className="text-emerald-700 inline-flex items-center gap-0.5">
                              <TrendingDown className="w-3.5 h-3.5" /> ₹{row.deltaRs} ({row.deltaPct}%)
                            </span>
                          ) : (
                            <span className="text-stone-500">0% steady</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-stone-400 py-6 text-center">
                Add prices when logging or restocking items to unlock automatic price drift tracking.
              </p>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COLD-CHAIN & FSSAI TEMPERATURE LOGS */}
      {subTab === 'temperature' && (
        <div className="space-y-5">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white border border-[#E2E8DE] rounded-2xl p-4">
              <span className="text-stone-500 font-semibold block">FSSAI Safe-Range Pass Rate</span>
              <span className="text-2xl font-extrabold text-[#2C5F2D] tabular-nums mt-1 block">
                {passRate}%
              </span>
              <span className="text-[11px] text-stone-500">
                Across {storageLogs.length} logged inspection{storageLogs.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="bg-white border border-[#E2E8DE] rounded-2xl p-4">
              <span className="text-stone-500 font-semibold block">Out-of-Range Alerts</span>
              <span className="text-2xl font-extrabold text-rose-700 tabular-nums mt-1 block">
                {storageLogs.filter((l) => l.status !== 'pass').length}
              </span>
              <span className="text-[11px] text-stone-500">Requires chiller/seal check</span>
            </div>
            <div className="bg-white border border-[#E2E8DE] rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-stone-500 font-semibold block">Compliance Audit Sheet</span>
                <span className="text-[11px] text-stone-500">Export timestamped temperature register</span>
              </div>
              <button
                type="button"
                disabled={storageLogs.length === 0}
                onClick={handleExportTempCsv}
                className="mt-2 py-2 px-3 rounded-xl bg-[#EAF3E6] hover:bg-[#d8ebd1] disabled:opacity-50 text-[#2C5F2D] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export FSSAI Temp CSV</span>
              </button>
            </div>
          </div>

          {/* Log Temperature Form */}
          <form
            onSubmit={handleAddTempLog}
            className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2C5F2D]" />
                <h3 className="font-extrabold text-sm text-stone-900">
                  Log Cold-Chain / Storage Temperature Check
                </h3>
              </div>
              <span className="text-[11px] text-stone-500">
                Safe target for {TEMP_GUIDELINES[zoneType].label}:{' '}
                <strong className="text-stone-800">{TEMP_GUIDELINES[zoneType].safeRange}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="lg:col-span-2">
                <label className="font-bold text-stone-700 block mb-1">Unit / Storage Name *</label>
                <input
                  type="text"
                  required
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="e.g. Walk-In Chiller #1 / Home Fridge"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Storage Type</label>
                <select
                  value={zoneType}
                  onChange={(e) => {
                    const next = e.target.value as StorageZoneType;
                    setZoneType(next);
                    setTempC(TEMP_GUIDELINES[next].defaultTemp);
                  }}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
                >
                  <option value="fridge">Fridge (0–4.5°C)</option>
                  <option value="freezer">Freezer (≤ -18°C)</option>
                  <option value="pantry">Dry Store (10–25°C)</option>
                  <option value="hot-hold">Hot Hold (≥ 63°C)</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Temp (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Checked By</label>
                <input
                  type="text"
                  value={checkedBy}
                  onChange={(e) => setCheckedBy(e.target.value)}
                  placeholder="Chef / Staff"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold cursor-pointer"
                >
                  Log Check
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Humidity % (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(e.target.value)}
                  placeholder="e.g. 55"
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl tabular-nums"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="font-bold text-stone-700 block mb-1">Corrective Action / Notes</label>
                <input
                  type="text"
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="e.g. Door gasket inspected, compressor running normal"
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
            </div>
          </form>

          {/* Temperature Log Table */}
          <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-3">
            <h3 className="font-extrabold text-sm text-stone-900 pb-2 border-b border-stone-100">
              Recent Temperature Register ({storageLogs.length})
            </h3>
            {storageLogs.length > 0 ? (
              <div className="divide-y divide-stone-100 text-xs">
                {storageLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-stone-900">{log.zoneName}</span>
                        <span className="text-[11px] text-stone-500 capitalize">
                          · {log.zoneType}
                          {log.checkedBy ? ` · Checked by ${log.checkedBy}` : ''}
                        </span>
                      </div>
                      {log.notes && <p className="text-[11px] text-stone-500 mt-0.5">{log.notes}</p>}
                    </div>

                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="font-mono font-extrabold text-sm text-stone-900">
                        {log.temperatureC}°C
                      </span>
                      <span
                        className={`text-[11px] font-extrabold flex items-center gap-1 ${
                          log.status === 'pass'
                            ? 'text-emerald-700'
                            : log.status === 'warning'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {log.status === 'pass' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span>{log.status.toUpperCase()}</span>
                      </span>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {new Date(log.loggedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                        {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteStorageLog(log.id)}
                        className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-stone-500">
                No temperature readings logged yet. Record your first fridge or freezer check above for FSSAI/HACCP compliance.
              </p>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SMART INDIAN SHELF-LIFE & PRESERVATION GUIDE */}
      {subTab === 'guide' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)}
              placeholder="Search any ingredient (paneer, dhaniya, tomato, atta, chicken, bread)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8DE] rounded-2xl text-xs focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredGuide.map((rule) => (
              <div
                key={rule.category}
                className="bg-white border border-[#E2E8DE] rounded-2xl p-4 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-extrabold text-sm text-stone-900">{rule.category}</h4>
                    <span className="text-[11px] font-bold text-[#2C5F2D] capitalize">
                      Best in {rule.defaultStorage}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                    <div className="p-2 rounded-xl bg-[#F7F8F4]">
                      <span className="text-[10px] text-stone-500 block">Fridge</span>
                      <span className="font-extrabold text-stone-900">{rule.fridgeDays}d</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F7F8F4]">
                      <span className="text-[10px] text-stone-500 block">Pantry</span>
                      <span className="font-extrabold text-stone-900">{rule.pantryDays}d</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F7F8F4]">
                      <span className="text-[10px] text-stone-500 block">Freezer</span>
                      <span className="font-extrabold text-stone-900">{rule.freezerDays}d</span>
                    </div>
                  </div>

                  <p className="text-stone-600 leading-relaxed">
                    {INDIAN_STORAGE_TIPS[rule.category] || INDIAN_STORAGE_TIPS.Other}
                  </p>
                </div>

                {rule.keywords.length > 0 && (
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-stone-400 truncate">
                      Covers: {rule.keywords.slice(0, 6).join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const firstKeyword = rule.keywords[0];
                        const formatted = firstKeyword.charAt(0).toUpperCase() + firstKeyword.slice(1);
                        await addToRestockList({
                          name: formatted,
                          category: rule.category,
                          targetQuantity: 1,
                          unit: 'pack',
                          storage: rule.defaultStorage,
                          reason: 'manual',
                          priority: 'normal',
                        });
                        showToast(`Added "${formatted}" to Need-to-Buy list!`);
                      }}
                      className="text-[11px] font-bold text-[#2C5F2D] hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>+ Quick Buy</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DAILY SOP CHECKLIST, SHIFT HANDOVER & CONSUMPTION VELOCITY FORECAST */}
      {subTab === 'checklists' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Daily Checklist & Shift Handover */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900">
                    {isCommercial ? 'Daily Kitchen SOP & Shift Handover Board' : 'Daily Kitchen Checklist & Family Notes'}
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                    {checklists.filter((c) => c.completed).length} of {checklists.length} completed · Saved in SQLite
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenStocktake && (
                    <button
                      type="button"
                      onClick={onOpenStocktake}
                      className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-[#A3E635]" />
                      <span>Run Stocktake</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await resetDailyChecklists();
                      showToast('Reset daily opening/closing checklist items for the new shift.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Day</span>
                  </button>
                </div>
              </div>

              {/* Add Checklist / Handover Form */}
              <form onSubmit={handleAddChecklist} className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={chkTitle}
                  onChange={(e) => setChkTitle(e.target.value)}
                  placeholder="Add SOP task or shift handover note (e.g. Use Paneer lot #B2 first)..."
                  className="sm:col-span-6 p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
                <select
                  value={chkCategory}
                  onChange={(e) => setChkCategory(e.target.value as ChecklistCategory)}
                  className="sm:col-span-3 p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-semibold text-stone-700"
                >
                  <option value="opening">Opening Check</option>
                  <option value="hygiene">FSSAI / Hygiene</option>
                  <option value="closing">Closing Check</option>
                  <option value="handover">Shift Handover Note</option>
                </select>
                <button
                  type="submit"
                  className="sm:col-span-3 px-3 py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
                <input
                  type="text"
                  value={chkAssignee}
                  onChange={(e) => setChkAssignee(e.target.value)}
                  placeholder="Assigned to / Author (optional)"
                  className="sm:col-span-5 p-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
                <input
                  type="text"
                  value={chkNotes}
                  onChange={(e) => setChkNotes(e.target.value)}
                  placeholder="Extra details (optional)"
                  className="sm:col-span-7 p-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </form>

              {/* Checklist Rows */}
              <div className="divide-y divide-stone-100">
                {checklists.length > 0 ? (
                  checklists.map((task) => (
                    <div
                      key={task.id}
                      className={`py-2.5 flex items-start justify-between gap-3 text-xs ${
                        task.completed ? 'opacity-65' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(task.id)}
                        className="flex items-start gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <span className="mt-0.5 text-[#2C5F2D] shrink-0">
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-stone-400" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`font-bold text-stone-900 ${
                              task.completed ? 'line-through text-stone-500' : ''
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            <span className="uppercase font-bold text-[#2C5F2D]">{task.category}</span>
                            {task.assignedTo ? ` · ${task.assignedTo}` : ''}
                            {task.notes ? ` · ${task.notes}` : ''}
                            {task.completedAt
                              ? ` · Done ${new Date(task.completedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}`
                              : ''}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteChecklistItem(task.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg cursor-pointer shrink-0"
                        title="Remove task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-stone-500">
                    No tasks yet. Add opening checks, FSSAI hygiene tasks, or shift handover notes above.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Smart Consumption Velocity & Days-of-Cover Forecaster */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E2E8DE] rounded-3xl p-5 space-y-3">
              <div className="pb-2 border-b border-stone-100">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#2C5F2D]" />
                  <h3 className="font-extrabold text-sm text-stone-900">
                    Days-of-Cover &amp; Auto-Par Forecast
                  </h3>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Estimates run-out horizon from active quantities, burn rate, and shelf-life dates.
                </p>
              </div>

              {velocityForecast.length > 0 ? (
                <div className="divide-y divide-stone-100">
                  {velocityForecast.map(({ item, dailyBurn, daysOfCover, suggestedPar, inBuyList }) => {
                    const isCritical = daysOfCover <= 2;
                    return (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-stone-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-stone-500 tabular-nums">
                            Stock: {item.quantity} {item.unit} · Burn ~{dailyBurn}/d · Sugg. Par {suggestedPar}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[11px] font-extrabold tabular-nums ${
                              isCritical ? 'text-rose-700' : daysOfCover <= 4 ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {daysOfCover}d left
                          </span>

                          {!inBuyList ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await addToRestockList({
                                  name: item.name,
                                  category: item.category,
                                  targetQuantity: Math.max(1, Math.ceil(suggestedPar * 1.5)),
                                  unit: item.unit,
                                  storage: item.storage,
                                  estimatedPrice: item.price ?? null,
                                  supplierName: item.supplierName ?? null,
                                  parLevel: suggestedPar,
                                  sourceItemId: item.id,
                                  reason: 'low-stock',
                                  priority: isCritical ? 'urgent' : 'normal',
                                });
                                showToast(`Queued "${item.name}" to Buy List (Suggested Par: ${suggestedPar}).`);
                              }}
                              className="px-2 py-1 rounded-lg bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] text-[10px] font-bold cursor-pointer"
                            >
                              + Buy
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-stone-400">Queued</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-stone-500">
                  Add active inventory items to compute consumption velocity and auto-par targets.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

