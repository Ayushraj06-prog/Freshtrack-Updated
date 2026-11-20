/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeftRight, X, CheckCircle2 } from 'lucide-react';
import { InventoryItem, StorageLocation } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';

interface TransferStockModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

const PRESET_ZONES = ['Main Kitchen', 'Prep Station', 'Cold Room', 'Tandoor / Line', 'Branch B'];

export const TransferStockModal: React.FC<TransferStockModalProps> = ({
  item,
  onClose,
  onSuccess,
}) => {
  const { transferItem, preferences } = useInventory();
  const isCommercial = preferences.operationScale !== 'household';

  const maxQty = Number(item.quantity) || 1;
  const [transferQty, setTransferQty] = useState<string>(String(maxQty));
  const [targetStorage, setTargetStorage] = useState<StorageLocation>(
    item.storage === 'fridge' ? 'freezer' : 'fridge'
  );
  const [targetZone, setTargetZone] = useState<string>(item.branchZone || preferences.branchLocation || 'Main Kitchen');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.min(maxQty, Math.max(0.01, Number(transferQty) || maxQty));
    setSubmitting(true);
    try {
      await transferItem(item.id, {
        quantity: qty,
        targetStorage,
        targetBranchZone: isCommercial ? targetZone.trim() || null : item.branchZone ?? null,
        notes: notes.trim() || null,
      });
      const isPartial = qty < maxQty;
      onSuccess?.(
        isPartial
          ? `Split & transferred ${qty} ${item.unit} of "${item.name}" to ${isCommercial ? `${targetZone} (${targetStorage})` : targetStorage}.`
          : `Moved "${item.name}" to ${isCommercial ? `${targetZone} (${targetStorage})` : targetStorage}.`
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <form
        onSubmit={handleTransfer}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#E2E8DE] p-5 space-y-4 text-xs"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-stone-900">Transfer / Split Batch</h3>
              <p className="text-[11px] text-stone-500 truncate max-w-[240px]">
                {item.name} · Available: <strong className="tabular-nums">{item.quantity} {item.unit}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-stone-700">Quantity to Transfer ({item.unit})</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTransferQty(String(Number((maxQty / 2).toFixed(2))))}
                  className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[10px] cursor-pointer"
                >
                  Half (50%)
                </button>
                <button
                  type="button"
                  onClick={() => setTransferQty(String(maxQty))}
                  className="px-2 py-0.5 rounded-md bg-[#EAF3E6] text-[#2C5F2D] font-bold text-[10px] cursor-pointer"
                >
                  Full Batch
                </button>
              </div>
            </div>
            <input
              type="number"
              min={0.01}
              max={maxQty}
              step="any"
              required
              value={transferQty}
              onChange={(e) => setTransferQty(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
            />
          </div>

          <div>
            <label className="font-bold text-stone-700 block mb-1">Destination Storage</label>
            <div className="grid grid-cols-3 gap-2">
              {(['fridge', 'pantry', 'freezer'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setTargetStorage(loc)}
                  className={`py-2 rounded-xl font-bold capitalize border transition-all cursor-pointer ${
                    targetStorage === loc
                      ? 'bg-[#2C5F2D] text-white border-[#2C5F2D]'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {isCommercial && (
            <div>
              <label className="font-bold text-stone-700 block mb-1">Destination Branch / Station Zone</label>
              <input
                type="text"
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
                placeholder="e.g. Prep Station, Branch B, Cold Room"
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PRESET_ZONES.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setTargetZone(z)}
                    className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-[#EAF3E6] hover:text-[#2C5F2D] text-stone-600 text-[10px] font-semibold cursor-pointer"
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-stone-700 block mb-1">Transfer Reason / Note (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Moved for lunch prep, freezing extra half"
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 font-bold hover:bg-stone-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Transferring...' : 'Confirm Transfer'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
