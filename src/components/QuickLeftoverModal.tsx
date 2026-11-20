/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { X, Clock, Printer, CheckCircle2, Flame, Snowflake } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { StorageLocation } from '../types/inventory';

interface QuickLeftoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (itemId: string, name: string) => void;
  onPrintLabel?: (itemId: string) => void;
}

interface PrepPreset {
  id: string;
  label: string;
  defaultName: string;
  fridgeDays: number;
  freezerDays: number;
  defaultQty: number;
  unit: string;
  hint: string;
}

const PREP_PRESETS: PrepPreset[] = [
  {
    id: 'dal-curry',
    label: 'Dal / Sabzi / Curry',
    defaultName: 'Cooked Dal / Curry',
    fridgeDays: 3,
    freezerDays: 30,
    defaultQty: 2,
    unit: 'containers',
    hint: '3d fridge · 30d freezer',
  },
  {
    id: 'rice-biryani',
    label: 'Cooked Rice / Biryani',
    defaultName: 'Cooked Rice / Biryani',
    fridgeDays: 2,
    freezerDays: 21,
    defaultQty: 2,
    unit: 'containers',
    hint: '2d fridge (high risk) · 21d freezer',
  },
  {
    id: 'dough-batter',
    label: 'Kneaded Atta / Dosa Batter',
    defaultName: 'Kneaded Atta / Batter',
    fridgeDays: 3,
    freezerDays: 14,
    defaultQty: 1,
    unit: 'kg',
    hint: '3d fridge · 14d freezer',
  },
  {
    id: 'base-gravy',
    label: 'Makhani / Onion-Tomato Gravy',
    defaultName: 'Base Gravy Prep Batch',
    fridgeDays: 4,
    freezerDays: 30,
    defaultQty: 2,
    unit: 'kg',
    hint: '4d fridge · 30d freezer',
  },
  {
    id: 'marinade',
    label: 'Marinated Paneer / Chicken',
    defaultName: 'Marinated Tikka Batch',
    fridgeDays: 2,
    freezerDays: 30,
    defaultQty: 1.5,
    unit: 'kg',
    hint: '2d fridge · 30d freezer',
  },
  {
    id: 'mise-en-place',
    label: 'Chopped Mise-en-Place',
    defaultName: 'Chopped Veg Prep Tray',
    fridgeDays: 2,
    freezerDays: 14,
    defaultQty: 2,
    unit: 'trays',
    hint: '2d fridge · 14d freezer',
  },
];

function generatePrepCode(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `PREP-${mm}${dd}-${suffix}`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const QuickLeftoverModal: React.FC<QuickLeftoverModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onPrintLabel,
}) => {
  const { addItem, preferences } = useInventory();
  const isCommercial = preferences.operationScale !== 'household';

  const [selectedPresetId, setSelectedPresetId] = useState<string>('dal-curry');
  const [name, setName] = useState('Cooked Dal / Curry');
  const [quantity, setQuantity] = useState('2');
  const [unit, setUnit] = useState('containers');
  const [storage, setStorage] = useState<StorageLocation>('fridge');
  const [shelfDays, setShelfDays] = useState<number>(3);
  const [batchCode, setBatchCode] = useState<string>(() => generatePrepCode());
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedBatch, setSavedBatch] = useState<{ id: string; name: string; expiry: string; lot: string } | null>(null);

  const computedExpiry = useMemo(() => addDaysIso(Math.max(1, shelfDays)), [shelfDays]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: PrepPreset) => {
    setSelectedPresetId(preset.id);
    setName(preset.defaultName);
    setQuantity(String(preset.defaultQty));
    setUnit(preset.unit);
    setShelfDays(storage === 'freezer' ? preset.freezerDays : preset.fridgeDays);
  };

  const handleStorageSwitch = (nextStorage: StorageLocation) => {
    setStorage(nextStorage);
    const activePreset = PREP_PRESETS.find((p) => p.id === selectedPresetId);
    if (activePreset) {
      setShelfDays(nextStorage === 'freezer' ? activePreset.freezerDays : activePreset.fridgeDays);
    }
  };

  const resetForm = () => {
    setSavedBatch(null);
    setBatchCode(generatePrepCode());
    setNotes('');
    setEstimatedValue('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const numericQty = Math.max(0.1, Number(quantity) || 1);
      const numericPrice = estimatedValue.trim() ? Number(estimatedValue) : null;
      const newId = await addItem({
        name: name.trim(),
        category: 'Cooked Leftovers',
        quantity: numericQty,
        originalQuantity: numericQty,
        unit: unit.trim() || 'containers',
        purchaseDate: todayStr,
        estimatedExpiryDate: computedExpiry,
        storage,
        price: numericPrice !== null && !isNaN(numericPrice) ? numericPrice : null,
        status: 'active',
        source: 'manual',
        batchCode: batchCode.trim() || generatePrepCode(),
        branchZone: preferences.branchLocation || undefined,
        notes: [
          `Prepped ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          notes.trim(),
        ]
          .filter(Boolean)
          .join(' · '),
      });

      setSavedBatch({
        id: newId,
        name: name.trim(),
        expiry: computedExpiry,
        lot: batchCode.trim(),
      });
      onSaved?.(newId, name.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl border border-[#E2E8DE] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#E2E8DE] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-stone-900">
                {isCommercial ? 'Quick Prep Batch & Use-By Timer' : 'Log Cooked Leftover / Prep Box'}
              </h3>
              <p className="text-xs text-stone-500">
                Auto-calculates safe Use-By date, prep lot code, and FIFO sticker.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {savedBatch ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-base text-stone-900">{savedBatch.name} Saved</h4>
              <p className="text-xs text-stone-600 tabular-nums">
                Lot <span className="font-mono font-bold text-stone-800">{savedBatch.lot}</span> · Use by{' '}
                <strong className="text-[#2C5F2D]">{savedBatch.expiry}</strong>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              {onPrintLabel && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPrintLabel(savedBatch.id);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#A3E635]" />
                  <span>Print FIFO Sticker</span>
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#EAF3E6] hover:bg-[#d8ebd1] text-[#2C5F2D] text-xs font-bold cursor-pointer"
              >
                Log Another Batch
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
            {/* Indian Kitchen & Prep Presets */}
            <div className="space-y-2">
              <span className="font-bold text-stone-800 block">1-Click Indian Prep Presets</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PREP_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[#EAF3E6] border-[#2C5F2D] text-[#2C5F2D]'
                          : 'bg-white border-[#E2E8DE] text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span className="font-bold block leading-tight">{preset.label}</span>
                      <span className="text-[10px] text-stone-500 block mt-1">{preset.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="font-bold text-stone-700 block mb-1">Dish / Prep Batch Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajma Masala / Makhani Gravy"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Prep Lot Code</label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="containers / kg / trays"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Est. Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl tabular-nums"
                />
              </div>
            </div>

            {/* Storage + Use-By Days */}
            <div className="p-3.5 rounded-2xl bg-[#F7F8F4] border border-[#E2E8DE] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-[#E2E8DE]">
                  <button
                    type="button"
                    onClick={() => handleStorageSwitch('fridge')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      storage === 'fridge' ? 'bg-[#2C5F2D] text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Chiller / Fridge</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStorageSwitch('freezer')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      storage === 'freezer' ? 'bg-sky-700 text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Snowflake className="w-3.5 h-3.5" />
                    <span>Deep Freezer</span>
                  </button>
                </div>

                <div className="text-right tabular-nums">
                  <span className="text-[11px] text-stone-500 block">Safe Use-By Date</span>
                  <span className="font-extrabold text-sm text-[#2C5F2D]">{computedExpiry}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-stone-500 mr-1">Hold window:</span>
                {[1, 2, 3, 4, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setShelfDays(d)}
                    className={`px-2.5 py-1 rounded-lg font-bold tabular-nums cursor-pointer transition-colors ${
                      shelfDays === d
                        ? 'bg-[#2C5F2D] text-white'
                        : 'bg-white border border-[#E2E8DE] text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1">Allergen / Shift Note (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Contains cashews & dairy · Reheat to 75°C before serving"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
              />
            </div>

            <div className="pt-3 border-t border-[#E2E8DE] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] disabled:opacity-60 text-white font-bold cursor-pointer"
              >
                {saving ? 'Saving Batch...' : 'Save & Start Timer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
