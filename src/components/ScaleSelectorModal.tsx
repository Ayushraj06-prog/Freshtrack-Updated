/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Home,
  UtensilsCrossed,
  Building2,
  Check,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  PackageCheck,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { DietType, OperationScale } from '../types/inventory';

interface ScaleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCALE_OPTIONS: {
  id: OperationScale;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge: string;
  defaultBudget: number;
  defaultLeadDays: number;
  features: string[];
}[] = [
  {
    id: 'household',
    title: 'Household Kitchen',
    subtitle: 'Families, apartments & home cooks',
    icon: <Home className="w-5 h-5" />,
    badge: 'Personal & Family',
    defaultBudget: 1500,
    defaultLeadDays: 2,
    features: [
      'Fridge, Pantry & Freezer organization',
      'Portion tracking (Little, Half, Most, All)',
      'Homestyle Rasoi recipes & custom dish logging',
      '1–2 day expiry alerts & household ₹ savings',
    ],
  },
  {
    id: 'restaurant',
    title: 'Restaurant & Cafe',
    subtitle: 'Commercial kitchens, cloud kitchens & bakeries',
    icon: <UtensilsCrossed className="w-5 h-5" />,
    badge: 'Commercial Kitchen',
    defaultBudget: 15000,
    defaultLeadDays: 3,
    features: [
      'FIFO Priority Sort & "#1 Use First" prep badges',
      'Par-Level low-stock alerts & reorder filter',
      'Batch / Lot codes, Supplier & Prep Station tags',
      'Recipe Yield Batch Multiplier (1x, 5x, 10x, 25x)',
    ],
  },
  {
    id: 'enterprise',
    title: 'Enterprise & Multi-Branch',
    subtitle: 'Hotel chains, central commissaries & caterers',
    icon: <Building2 className="w-5 h-5" />,
    badge: 'Multi-Site Ops',
    defaultBudget: 50000,
    defaultLeadDays: 5,
    features: [
      'All Restaurant FIFO & Par-Level tools included',
      'Multi-Branch / Warehouse Zone live filtering',
      'Total Stock Valuation (₹) & Value-at-Risk KPIs',
      '1-Click FSSAI / HACCP Compliance & Reorder CSV',
    ],
  },
];

export const ScaleSelectorModal: React.FC<ScaleSelectorModalProps> = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences } = useInventory();

  const [selectedScale, setSelectedScale] = useState<OperationScale>(preferences.operationScale || 'household');
  const [organizationName, setOrganizationName] = useState(preferences.organizationName || '');
  const [branchLocation, setBranchLocation] = useState(preferences.branchLocation || '');
  const [wasteBudgetRs, setWasteBudgetRs] = useState(String(preferences.wasteBudgetRs ?? 2000));
  const [reminderLeadDays, setReminderLeadDays] = useState<number>(preferences.reminderLeadDays || 2);
  const [diet, setDiet] = useState<DietType>(preferences.diet || 'veg');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedScale(preferences.operationScale || 'household');
      setOrganizationName(preferences.organizationName || '');
      setBranchLocation(preferences.branchLocation || '');
      setWasteBudgetRs(String(preferences.wasteBudgetRs ?? 2000));
      setReminderLeadDays(preferences.reminderLeadDays || 2);
      setDiet(preferences.diet || 'veg');
    }
  }, [isOpen, preferences]);

  const handleSelectTier = (tier: (typeof SCALE_OPTIONS)[0]) => {
    setSelectedScale(tier.id);
    // Suggest sensible defaults when switching scale if user hasn't typed a custom budget for that tier
    if (tier.id !== preferences.operationScale) {
      setWasteBudgetRs(String(tier.defaultBudget));
      setReminderLeadDays(tier.defaultLeadDays);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updatePreferences({
        operationScale: selectedScale,
        organizationName: organizationName.trim(),
        branchLocation: branchLocation.trim(),
        wasteBudgetRs: Math.max(0, Number(wasteBudgetRs) || 2000),
        reminderLeadDays,
        diet,
        scaleConfigured: true,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const activeTier = SCALE_OPTIONS.find((t) => t.id === selectedScale) || SCALE_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-[#E2E8DE] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8DE] bg-[#F7F8F4] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2C5F2D] text-white">
                Operation Mode
              </span>
              <span className="text-[11px] text-stone-500 font-semibold">
                Tailors inventory, alerts &amp; analytics
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-stone-900 mt-1">
              Who are you managing FreshTrack for?
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* 3 Operation Scale Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SCALE_OPTIONS.map((tier) => {
              const isSelected = selectedScale === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => handleSelectTier(tier)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#EAF3E6] border-[#2C5F2D] ring-2 ring-[#2C5F2D]/30 shadow-md'
                      : 'bg-white border-[#E2E8DE] hover:border-[#6B9B4F] hover:bg-stone-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-[#2C5F2D] text-[#A3E635]' : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {tier.icon}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-[#2C5F2D] text-white'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {tier.badge}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-stone-900">{tier.title}</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{tier.subtitle}</p>

                    <ul className="mt-3 space-y-1.5 text-[11px] text-stone-700">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 text-[#2C5F2D] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-2 border-t border-stone-200/70 flex items-center justify-between text-[11px] font-bold">
                    <span className={isSelected ? 'text-[#2C5F2D]' : 'text-stone-400'}>
                      {isSelected ? 'Selected Mode' : 'Tap to select'}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-[#2C5F2D]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Scale-Specific Parameters */}
          <div className="bg-[#F7F8F4] border border-[#E2E8DE] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2C5F2D]" />
                <h4 className="font-extrabold text-sm text-stone-900">
                  {activeTier.title} Parameters
                </h4>
              </div>
              <span className="text-[11px] text-stone-500 font-medium">
                Saved permanently in SQLite
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  {selectedScale === 'household'
                    ? 'Kitchen / Family Name (Optional)'
                    : selectedScale === 'restaurant'
                    ? 'Restaurant / Kitchen Name'
                    : 'Enterprise / Group Name'}
                </label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={
                    selectedScale === 'household'
                      ? 'e.g. Sharma Home Rasoi'
                      : selectedScale === 'restaurant'
                      ? 'e.g. Spice Route Bistro'
                      : 'e.g. Heritage Hospitality Group'
                  }
                  className="w-full px-3 py-2 bg-white border border-[#E2E8DE] rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none font-medium"
                />
              </div>

              {selectedScale !== 'household' ? (
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    {selectedScale === 'restaurant'
                      ? 'Primary Kitchen / Prep Station'
                      : 'Default Branch / Warehouse Hub'}
                  </label>
                  <input
                    type="text"
                    value={branchLocation}
                    onChange={(e) => setBranchLocation(e.target.value)}
                    placeholder={
                      selectedScale === 'restaurant'
                        ? 'e.g. Main Line, Bakery Walk-In'
                        : 'e.g. Indiranagar Central Hub'
                    }
                    className="w-full px-3 py-2 bg-white border border-[#E2E8DE] rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none font-medium"
                  />
                </div>
              ) : (
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Default Kitchen Diet</label>
                  <select
                    value={diet}
                    onChange={(e) => setDiet(e.target.value as DietType)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8DE] rounded-xl font-semibold focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                  >
                    <option value="veg">Pure Veg</option>
                    <option value="egg">Eggetarian</option>
                    <option value="non-veg">Non-Veg</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-[#2C5F2D]" />
                  <span>Monthly Waste Loss Cap / Target (₹)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={wasteBudgetRs}
                  onChange={(e) => setWasteBudgetRs(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8DE] rounded-xl font-bold focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Tracks expired spoilage ₹ against this threshold on your Dashboard.
                </p>
              </div>

              <div>
                <label className="font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-[#2C5F2D]" />
                  <span>Expiry Alert Lead Time</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-white p-1 rounded-xl border border-[#E2E8DE]">
                  {(selectedScale === 'household' ? [1, 2, 3, 4] : [1, 2, 3, 7]).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setReminderLeadDays(days)}
                      className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        reminderLeadDays === days
                          ? 'bg-[#2C5F2D] text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  {selectedScale === 'household'
                    ? 'Advance days before home groceries spoil'
                    : 'Procurement & prep lead window before expiry'}
                </p>
              </div>
            </div>

            {selectedScale !== 'household' && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-[#E2E8DE] text-[11px] text-stone-700">
                <ShieldCheck className="w-4 h-4 text-[#2C5F2D] shrink-0" />
                <span>
                  Commercial tools unlocked: <strong>FIFO Priority Queue</strong>,{' '}
                  <strong>Par-Level Reorder Alerts</strong>, <strong>Batch &amp; Supplier Tracking</strong>, and{' '}
                  <strong>{selectedScale === 'enterprise' ? 'Multi-Branch Zone Audit CSV' : 'Batch Prep Scaling'}</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-[#2C5F2D] hover:bg-[#204721] text-white shadow-md shadow-[#2C5F2D]/20 active:scale-98 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-70"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Applying Mode...' : `Activate ${activeTier.title}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
