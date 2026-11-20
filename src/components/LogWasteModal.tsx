/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, IndianRupee, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem, WasteReason } from '../types/inventory';

interface LogWasteModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

const WASTE_REASONS: { id: WasteReason; label: string; hint: string }[] = [
  { id: 'expired', label: 'Expired / Spoiled', hint: 'Past shelf life or mould/sourness' },
  { id: 'overproduction', label: 'Overproduction', hint: 'Cooked or prepped more than served' },
  { id: 'trim-loss', label: 'Trim / Prep Loss', hint: 'Peels, stalks, butcher or cut loss' },
  { id: 'cold-chain', label: 'Cold-Chain Issue', hint: 'Fridge warmth, power cut, door open' },
  { id: 'damaged-delivery', label: 'Damaged Delivery', hint: 'Bruised produce or torn vendor pack' },
  { id: 'plate-waste', label: 'Plate Waste', hint: 'Unfinished guest or family portions' },
  { id: 'other', label: 'Other', hint: 'Spill, burn, or contamination' },
];

export const LogWasteModal: React.FC<LogWasteModalProps> = ({ item, onClose, onSuccess }) => {
  const { logWaste, preferences } = useInventory();
  const isCommercial = preferences.operationScale !== 'household';

  const maxQty = Math.max(0.01, Number(item.quantity) || 1);
  const origQty = Math.max(maxQty, Number(item.originalQuantity) || maxQty);
  const unitPrice = item.price !== null && origQty > 0 ? item.price / origQty : 0;

  const [qtyWasted, setQtyWasted] = useState<string>(String(maxQty));
  const [lossRs, setLossRs] = useState<string>(
    item.price !== null ? String(Math.round(unitPrice * maxQty)) : '0'
  );
  const [manualLossOverride, setManualLossOverride] = useState(false);
  const [reason, setReason] = useState<WasteReason>('expired');
  const [loggedBy, setLoggedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!manualLossOverride) {
      const parsed = Number(qtyWasted);
      if (!isNaN(parsed) && parsed > 0 && unitPrice > 0) {
        setLossRs(String(Math.round(unitPrice * Math.min(parsed, maxQty))));
      }
    }
  }, [qtyWasted, manualLossOverride, unitPrice, maxQty]);

  const applyFraction = (fraction: number) => {
    setManualLossOverride(false);
    const nextQty = Number((maxQty * fraction).toFixed(2));
    setQtyWasted(String(Math.max(0.01, nextQty)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericQty = Number(qtyWasted);
    if (isNaN(numericQty) || numericQty <= 0) {
      setError('Enter a valid wasted quantity greater than 0.');
      return;
    }
    const numericLoss = Math.max(0, Number(lossRs) || 0);

    setSaving(true);
    setError(null);
    try {
      await logWaste({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        quantityWasted: Math.min(numericQty, maxQty),
        unit: item.unit,
        lossRs: numericLoss,
        reason,
        loggedBy: loggedBy.trim() || null,
        branchZone: item.branchZone || preferences.branchLocation || null,
        notes: notes.trim() || null,
      });

      const reasonLabel = WASTE_REASONS.find((r) => r.id === reason)?.label || reason;
      const isFull = numericQty >= maxQty - 0.001;
      onSuccess?.(
        `Logged ${Math.min(numericQty, maxQty)} ${item.unit} of "${item.name}" as ${reasonLabel}${
          numericLoss > 0 ? ` (₹${numericLoss} loss)` : ''
        }${isFull ? ' — stock closed.' : ' — remaining stock updated.'}`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save waste log.');
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
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-stone-900 truncate">
                Log Waste &amp; Root Cause
              </h3>
              <p className="text-xs text-stone-500 truncate tabular-nums">
                {item.name} · Available: {item.quantity} {item.unit}
                {item.price !== null ? ` · ₹${item.price}` : ''}
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

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
              {error}
            </div>
          )}

          {/* Quantity Wasted + Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">Quantity Lost ({item.unit})</label>
              <div className="flex items-center gap-1">
                {[
                  { label: '25%', frac: 0.25 },
                  { label: '50%', frac: 0.5 },
                  { label: '100% Full', frac: 1 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyFraction(preset.frac)}
                    className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max={maxQty}
                  required
                  value={qtyWasted}
                  onChange={(e) => {
                    setManualLossOverride(false);
                    setQtyWasted(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-[11px] text-stone-500 mt-1 block tabular-nums">
                  {Number(qtyWasted) >= maxQty - 0.001
                    ? 'Marks entire batch as spoiled'
                    : `Keeps ${Math.max(0, Number((maxQty - (Number(qtyWasted) || 0)).toFixed(2)))} ${item.unit} active`}
                </span>
              </div>

              <div>
                <div className="relative">
                  <IndianRupee className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={lossRs}
                    onChange={(e) => {
                      setManualLossOverride(true);
                      setLossRs(e.target.value);
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold text-rose-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="0"
                  />
                </div>
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Estimated financial loss (₹)
                </span>
              </div>
            </div>
          </div>

          {/* Root Cause Selection */}
          <div className="space-y-2">
            <label className="font-bold text-stone-800 block">Primary Root Cause</label>
            <div className="grid grid-cols-2 gap-2">
              {WASTE_REASONS.map((r) => {
                const active = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-rose-50 border-rose-400 text-rose-950'
                        : 'bg-white border-[#E2E8DE] text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs">{r.label}</span>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-stone-500 block mt-0.5 leading-snug">
                      {r.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Staff & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-700 block mb-1">
                {isCommercial ? 'Logged By (Chef / Staff)' : 'Logged By (Optional)'}
              </label>
              <input
                type="text"
                value={loggedBy}
                onChange={(e) => setLoggedBy(e.target.value)}
                placeholder={isCommercial ? 'e.g. Chef Ravi / Morning Shift' : 'e.g. Self'}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
              />
            </div>
            <div>
              <label className="font-bold text-stone-700 block mb-1">Corrective Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Reduce Monday order by 20%"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
              />
            </div>
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
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold cursor-pointer"
            >
              {saving ? 'Logging Waste...' : 'Confirm & Record Loss'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
