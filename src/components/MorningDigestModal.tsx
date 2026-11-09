/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, X, AlertTriangle, Utensils, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getRemainingDays } from '../data/shelfLifeData';
import { InventoryItem } from '../types/inventory';
import { UseItemModal } from './UseItemModal';

interface MorningDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

export const MorningDigestModal: React.FC<MorningDigestModalProps> = ({
  isOpen,
  onClose,
  setActiveTab,
}) => {
  const { items, stats, markAsUsed } = useInventory();
  const [usingItem, setUsingItem] = useState<InventoryItem | null>(null);

  if (!isOpen) return null;

  const urgentItems = items.filter((item) => {
    if (item.status !== 'active') return false;
    const days = getRemainingDays(item.estimatedExpiryDate);
    return days <= 2;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2C5F2D] to-[#1c3e1d] p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#A3E635]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Morning Kitchen Digest</h3>
              <p className="text-xs text-white/80">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="font-bold text-emerald-950 block">Kitchen Streak Status</span>
              <span className="text-[11px] text-emerald-800">
                You have prevented food waste for <strong>{stats.zeroWasteStreakDays} days</strong>!
              </span>
            </div>
            <span className="text-base font-black text-[#2C5F2D]">₹{stats.moneySavedRs} Saved</span>
          </div>

          <div className="space-y-2">
            <h4 className="font-extrabold text-stone-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Items needing rescue today &amp; tomorrow ({urgentItems.length})</span>
            </h4>

            {urgentItems.length > 0 ? (
              <div className="space-y-2">
                {urgentItems.map((item) => {
                  const rem = getRemainingDays(item.estimatedExpiryDate);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-stone-900">{item.name}</p>
                        <p className="text-[11px] text-amber-800">
                          {rem <= 0 ? '⚠️ Expires today!' : `⏳ ${rem} day left`} &bull; {item.storage}
                        </p>
                      </div>
                      <button
                        onClick={() => setUsingItem(item)}
                        className="px-3 py-1.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-[11px] font-bold rounded-xl shrink-0 transition-colors cursor-pointer"
                      >
                        Cook / Use
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-stone-500 bg-stone-50 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-[#2C5F2D] mx-auto mb-1 opacity-80" />
                <p className="font-bold text-stone-700">All kitchen staples are fresh!</p>
                <p className="text-[11px] text-stone-400">No urgent expiries in the next 48 hours.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-600 font-bold text-xs hover:bg-stone-200 rounded-xl"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              onClose();
              setActiveTab('recipes');
            }}
            className="px-4 py-2 bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Find Zero-Waste Recipes</span>
          </button>
        </div>
      </div>

      {/* Cooking & Portion Modal */}
      {usingItem && (
        <UseItemModal
          item={usingItem}
          onClose={() => setUsingItem(null)}
          onConfirm={(id, options) => markAsUsed(id, options)}
        />
      )}
    </div>
  );
};
