/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack - Use / Cooking Portion Modal
 * Allows kitchen users to record whether they used a product completely,
 * a little (25%), half (50%), most (75%), or a custom amount.
 * Automatically computes remaining inventory and credited ₹ monetary savings.
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  PieChart,
  Flame,
  Sparkles,
  TrendingUp,
  Package,
  Layers,
  UtensilsCrossed,
  ChefHat,
} from 'lucide-react';
import { InventoryItem, UseItemPayload } from '../types/inventory';

interface UseItemModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onConfirm: (id: string, options: UseItemPayload) => void;
  onOpenCustomRecipe?: (itemId: string) => void;
}

type PortionPresetMode = '25' | '50' | '75' | '100' | 'custom';

export const UseItemModal: React.FC<UseItemModalProps> = ({
  item,
  onClose,
  onConfirm,
  onOpenCustomRecipe,
}) => {
  if (!item) return null;

  const currentQty = Number(item.quantity) || 1;
  const originalQty = Number(item.originalQuantity) || currentQty;
  const unit = item.unit || 'unit';
  const price = item.price || 0;

  // State
  const [selectedPreset, setSelectedPreset] = useState<PortionPresetMode>('100');
  const [customQty, setCustomQty] = useState<number>(Math.max(1, Math.round(currentQty / 2)));
  const [recipeName, setRecipeName] = useState<string>('');

  // Calculations based on preset or custom
  const { portionFraction, usedQty, remainingQty, moneySavedThisTime, isCompleteFinish } =
    useMemo(() => {
      let fraction = 1.0;
      let used = currentQty;

      if (selectedPreset === '25') {
        fraction = 0.25;
        used = Math.min(currentQty, Number((currentQty * 0.25).toFixed(2)));
      } else if (selectedPreset === '50') {
        fraction = 0.5;
        used = Math.min(currentQty, Number((currentQty * 0.5).toFixed(2)));
      } else if (selectedPreset === '75') {
        fraction = 0.75;
        used = Math.min(currentQty, Number((currentQty * 0.75).toFixed(2)));
      } else if (selectedPreset === '100') {
        fraction = 1.0;
        used = currentQty;
      } else if (selectedPreset === 'custom') {
        used = Math.max(0, Math.min(currentQty, Number(customQty) || 0));
        fraction = currentQty > 0 ? used / currentQty : 1.0;
      }

      const remaining = Math.max(0, Number((currentQty - used).toFixed(2)));
      const portionOfTotalOriginal = originalQty > 0 ? used / originalQty : fraction;
      const savedRs = price > 0 ? Math.round(price * portionOfTotalOriginal) : 0;
      const finish = remaining <= 0 || fraction >= 0.98;

      return {
        portionFraction: fraction,
        usedQty: used,
        remainingQty: remaining,
        moneySavedThisTime: savedRs,
        isCompleteFinish: finish,
      };
    }, [selectedPreset, customQty, currentQty, originalQty, price]);

  const handleConfirm = () => {
    let portionLabel = 'Finished 100%';
    if (selectedPreset === '25') {
      portionLabel = `Used A Little (25% - ${usedQty} ${unit})`;
    } else if (selectedPreset === '50') {
      portionLabel = `Used Half (50% - ${usedQty} ${unit})`;
    } else if (selectedPreset === '75') {
      portionLabel = `Used Most (75% - ${usedQty} ${unit})`;
    } else if (selectedPreset === '100') {
      portionLabel = `Finished Completely (100% - ${usedQty} ${unit})`;
    } else {
      portionLabel = `Used ${usedQty} ${unit} (${Math.round(portionFraction * 100)}%)`;
    }

    if (recipeName.trim()) {
      portionLabel += ` for "${recipeName.trim()}"`;
    }

    onConfirm(item.id, {
      portion: portionFraction,
      usedQuantity: usedQty,
      usedPortionName: portionLabel,
    });
    onClose();
  };

  // Remaining percentage for visual progress bar
  const remainingPercent = Math.max(0, Math.min(100, Math.round((remainingQty / originalQty) * 100)));
  const usedPercent = Math.min(100, Math.round((usedQty / originalQty) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#2C5F2D] to-[#1E431F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <UtensilsCrossed className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">How much did you use?</h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                Log cooking portion &amp; credit zero-waste savings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Target Item Pill */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF3E6] text-[#2C5F2D]">
                  {item.category}
                </span>
                <span className="text-xs text-stone-500 capitalize">&bull; {item.storage}</span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-stone-900 mt-0.5 truncate">
                {item.name}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <div className="font-black text-stone-900 text-sm sm:text-base">
                {currentQty} {unit}
              </div>
              {price > 0 && (
                <div className="text-xs font-bold text-[#2C5F2D]">
                  ₹{price} <span className="text-[10px] text-stone-400 font-normal">total</span>
                </div>
              )}
            </div>
          </div>

          {/* Portion Selector Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center justify-between">
              <span>Select Portion Used</span>
              <span className="text-[11px] font-semibold text-stone-500">Quick Presets</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: '25',
                  label: 'A Little',
                  sub: '25% portion',
                  icon: '🌱',
                  desc: 'Garnish / tadka',
                },
                {
                  id: '50',
                  label: 'Half',
                  sub: '50% portion',
                  icon: '🥣',
                  desc: '1 meal cooking',
                },
                {
                  id: '75',
                  label: 'Most',
                  sub: '75% portion',
                  icon: '🍲',
                  desc: 'Big batch',
                },
                {
                  id: '100',
                  label: 'Finished!',
                  sub: '100% all used',
                  icon: '✨',
                  desc: 'Empty pack',
                },
              ].map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id as PortionPresetMode)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#EAF3E6] border-[#2C5F2D] ring-2 ring-[#2C5F2D]/20 shadow-xs'
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{preset.icon}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#2C5F2D]" />}
                    </div>
                    <div className="mt-2">
                      <div className={`text-xs font-extrabold ${isSelected ? 'text-[#2C5F2D]' : 'text-stone-800'}`}>
                        {preset.label}
                      </div>
                      <div className="text-[10px] text-stone-500 font-medium">{preset.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Amount Toggle Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSelectedPreset(selectedPreset === 'custom' ? '50' : 'custom')}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedPreset === 'custom'
                    ? 'bg-[#2C5F2D] text-white border-[#2C5F2D] shadow-xs'
                    : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {selectedPreset === 'custom'
                    ? 'Custom Quantity Active'
                    : 'Enter Specific Quantity (grams / ml / pcs)'}
                </span>
              </button>
            </div>
          </div>

          {/* Custom Quantity Slider & Input (Revealed if custom) */}
          {selectedPreset === 'custom' && (
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">Custom Amount Used</span>
                <span className="text-xs font-extrabold text-[#2C5F2D]">
                  {customQty} {unit} of {currentQty} {unit}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.1"
                  max={currentQty}
                  step={currentQty > 5 ? 1 : 0.1}
                  value={customQty}
                  onChange={(e) => setCustomQty(parseFloat(e.target.value) || 0)}
                  className="flex-1 accent-[#2C5F2D] cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max={currentQty}
                    step="any"
                    value={customQty}
                    onChange={(e) => setCustomQty(Math.min(currentQty, parseFloat(e.target.value) || 0))}
                    className="w-20 px-2 py-1 bg-white border border-stone-300 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                  />
                  <span className="text-xs font-bold text-stone-500">{unit}</span>
                </div>
              </div>
            </div>
          )}

          {/* Live Dynamic Usage Bar & Preview */}
          <div className="p-4 bg-gradient-to-br from-stone-50 to-emerald-50/40 border border-emerald-100 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-stone-700 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-[#2C5F2D]" />
                <span>Usage Outcome</span>
              </span>
              <span className="font-bold text-stone-500">
                {isCompleteFinish ? (
                  <span className="text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-full">
                    Item Finished 100%
                  </span>
                ) : (
                  <span className="text-stone-700 font-semibold">
                    {remainingQty} {unit} will stay in pantry
                  </span>
                )}
              </span>
            </div>

            {/* Visual Bar */}
            <div className="space-y-1">
              <div className="h-3 w-full bg-stone-200 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${100 - remainingPercent}%` }}
                  className="h-full bg-[#2C5F2D] transition-all duration-300"
                  title="Used Portion"
                />
                <div
                  style={{ width: `${remainingPercent}%` }}
                  className="h-full bg-emerald-300 transition-all duration-300"
                  title="Remaining Portion"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
                <span className="flex items-center gap-1 text-[#2C5F2D]">
                  <span className="w-2 h-2 rounded-full bg-[#2C5F2D]" />
                  Used now: {usedQty} {unit} ({Math.round(portionFraction * 100)}%)
                </span>
                <span className="flex items-center gap-1 text-stone-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-300" />
                  Remaining: {remainingQty} {unit} ({remainingPercent}%)
                </span>
              </div>
            </div>

            {/* Money Saved Highlight Box */}
            <div className="pt-2 border-t border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-[#2C5F2D] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-stone-400">
                    Money Rescued
                  </div>
                  <div className="text-xs font-bold text-stone-700">
                    {price > 0 ? `Saved by cooking this portion` : `Zero-waste meal logged`}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base sm:text-lg font-black text-[#2C5F2D]">
                  {price > 0 ? `+₹${moneySavedThisTime}` : '🌱 Rescued'}
                </span>
              </div>
            </div>
          </div>

          {/* Optional: Dish or Recipe Made */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>What did you cook / use it for? (Optional)</span>
            </label>
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="e.g. Kadhi Pakora, Dal Tadka, Dhaniya Chutney, Tea..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
          </div>

          {/* Shortcut to Custom Multi-Item Recipe Builder */}
          {onOpenCustomRecipe && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCustomRecipe(item.id);
              }}
              className="w-full p-3 rounded-2xl bg-[#EAF3E6] hover:bg-[#d8edd1] border border-[#6B9B4F]/40 text-[#2C5F2D] text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-[#2C5F2D]" />
                <span className="text-left">Cooking a multi-item recipe with this?</span>
              </div>
              <span className="text-[11px] underline group-hover:no-underline font-black">
                Open Recipe Builder &rarr;
              </span>
            </button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-stone-600 hover:text-stone-900 font-bold text-xs sm:text-sm rounded-2xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-[#2C5F2D] hover:bg-[#204721] text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-[#2C5F2D]/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isCompleteFinish
                ? `Finished All (Save ₹${moneySavedThisTime})`
                : `Save ${Math.round(portionFraction * 100)}% Usage (₹${moneySavedThisTime})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
