/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Refrigerator,
  UtensilsCrossed,
  Settings,
  Plus,
  Home,
  Building2,
  SlidersHorizontal,
  X,
  Truck,
} from 'lucide-react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { RecipesView } from './components/RecipesView';
import { OperationsView } from './components/OperationsView';
import { SettingsView } from './components/SettingsView';
import { AddItemsModal } from './components/AddItemsModal';
import { MorningDigestModal } from './components/MorningDigestModal';
import { ScaleSelectorModal } from './components/ScaleSelectorModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { FifoLabelPrinterModal } from './components/FifoLabelPrinterModal';
import { StocktakeModal } from './components/StocktakeModal';
import { SecurityGate } from './components/SecurityGate';
import { MobileInstallBanner, OfflineIndicator } from './components/PWAInstallButton';
import { OperationScale } from './types/inventory';

function MainApp() {
  const { items, preferences, updatePreferences, dbConnected, authMode, authSource, handleAuthSuccess } = useInventory();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'recipes' | 'operations' | 'settings'>('inventory');
  const [inventoryStatusJump, setInventoryStatusJump] = useState<'active' | 'urgent' | 'low-stock' | 'used' | 'restock' | 'all' | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDigestOpen, setIsDigestOpen] = useState(false);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isLabelPrinterOpen, setIsLabelPrinterOpen] = useState(false);
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);
  const [labelPrinterInitialIds, setLabelPrinterInitialIds] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    // Support PWA home-screen shortcuts (/?action=add or /?tab=recipes)
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['dashboard', 'inventory', 'recipes', 'operations', 'settings'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
      if (params.get('action') === 'add') {
        setIsAddModalOpen(true);
      }
    } catch {}

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openRestockPanel = () => {
    setInventoryStatusJump('restock');
    setActiveTab('inventory');
  };

  const openLabelPrinter = (ids?: string[]) => {
    setLabelPrinterInitialIds(ids && ids.length > 0 ? ids : undefined);
    setIsLabelPrinterOpen(true);
  };

  const handleQuickScaleSelect = async (scale: OperationScale) => {
    const defaultBudget = scale === 'enterprise' ? 50000 : scale === 'restaurant' ? 15000 : 1500;
    const defaultLead = scale === 'enterprise' ? 5 : scale === 'restaurant' ? 3 : 2;
    await updatePreferences({
      operationScale: scale,
      wasteBudgetRs: defaultBudget,
      reminderLeadDays: defaultLead,
      scaleConfigured: true,
    });
  };

  if (authMode !== 'authenticated') {
    return (
      <SecurityGate
        mode={authMode}
        source={authSource}
        onAuthenticated={handleAuthSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F0] text-stone-900 font-sans flex flex-col selection:bg-[#2C5F2D] selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        onOpenMorningDigest={() => setIsDigestOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenScaleModal={() => setIsScaleModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandOpen(true)}
      />

      {/* Main Tab Navigation for Desktop */}
      <div className="max-w-6xl mx-auto px-4 w-full pt-4 hidden md:block">
        <div className="flex items-center justify-between border-b border-[#E2E8DE] pb-2">
          <nav className="flex items-center gap-2 text-xs font-bold">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-white hover:text-stone-900'
              }`}
            >
              <Refrigerator className="w-4 h-4" />
              <span>
                {preferences.operationScale === 'enterprise'
                  ? 'Multi-Branch Stock'
                  : preferences.operationScale === 'restaurant'
                  ? 'Commercial Stock (FIFO)'
                  : 'Kitchen Inventory'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-white hover:text-stone-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>
                {preferences.operationScale === 'household'
                  ? '₹ Savings & Analytics'
                  : '₹ Ops & Waste Analytics'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('recipes')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'recipes'
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-white hover:text-stone-900'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>
                {preferences.operationScale === 'household'
                  ? 'Rasoi Zero-Waste Recipes'
                  : 'Prep & Batch Recipes'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'operations'
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-white hover:text-stone-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>
                {preferences.operationScale === 'household'
                  ? 'Cold-Chain & Shelf Guide'
                  : 'Vendors, Temp & Ops'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#2C5F2D] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-white hover:text-stone-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Scale, DB &amp; Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 w-full pt-4 flex-1 space-y-4">
        {/* Mobile App Install Banner (auto-hidden when running in standalone app mode) */}
        <MobileInstallBanner />

        {/* Operation Scale Selection Section (shown until user confirms or configures their mode) */}
        {dbConnected && !preferences.scaleConfigured && (
          <section className="bg-white border border-[#6B9B4F]/50 rounded-3xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF3E6] text-[#2C5F2D]">
                  Tailor Your Workspace
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-stone-900 mt-1">
                  Are you using FreshTrack for a Household, Restaurant, or Enterprise?
                </h2>
                <p className="text-xs text-stone-500">
                  Pick your scale to unlock FIFO queues, Par-Level reorder alerts, Batch tracking, or Multi-Branch analytics.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setIsScaleModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Full Setup</span>
                </button>
                <button
                  type="button"
                  onClick={() => updatePreferences({ scaleConfigured: true })}
                  aria-label="Dismiss scale banner"
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => handleQuickScaleSelect('household')}
                className="p-3 rounded-2xl border border-[#E2E8DE] hover:border-[#2C5F2D] hover:bg-[#EAF3E6]/60 text-left transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] flex items-center justify-center shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-extrabold text-stone-900">Household Kitchen</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Home fridge, family meal savings &amp; Rasoi recipes</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickScaleSelect('restaurant')}
                className="p-3 rounded-2xl border border-[#E2E8DE] hover:border-[#2C5F2D] hover:bg-[#EAF3E6]/60 text-left transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-extrabold text-stone-900">Restaurant / Cafe</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">FIFO queue, Par-level alerts, batches &amp; 5x-25x prep yields</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickScaleSelect('enterprise')}
                className="p-3 rounded-2xl border border-[#E2E8DE] hover:border-[#2C5F2D] hover:bg-amber-50/70 text-left transition-all cursor-pointer flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-extrabold text-stone-900">Enterprise / Multi-Branch</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Multi-zone stock, ₹ valuation at risk &amp; FSSAI CSV audit</p>
                </div>
              </button>
            </div>
          </section>
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            onOpenAddModal={() => setIsAddModalOpen(true)}
            setActiveTab={(t) => setActiveTab(t as any)}
            initialStatusFilter={inventoryStatusJump}
            onClearStatusJump={() => setInventoryStatusJump(null)}
            onOpenLabelPrinter={openLabelPrinter}
            onOpenStocktake={() => setIsStocktakeOpen(true)}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardView
            setActiveTab={(t) => setActiveTab(t as any)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenScaleModal={() => setIsScaleModalOpen(true)}
            onOpenRestockList={openRestockPanel}
          />
        )}
        {activeTab === 'recipes' && <RecipesView />}
        {activeTab === 'operations' && <OperationsView onOpenStocktake={() => setIsStocktakeOpen(true)} />}
        {activeTab === 'settings' && <SettingsView onOpenScaleModal={() => setIsScaleModalOpen(true)} />}
      </main>

      {/* Mobile Floating Add Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl bg-[#2C5F2D] text-white shadow-xl shadow-[#2C5F2D]/40 flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Add Item"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E2E8DE] z-30 px-3 py-2 flex items-center justify-around text-[10px] font-bold text-stone-500">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'inventory' ? 'text-[#2C5F2D]' : ''}`}
        >
          <Refrigerator className="w-5 h-5" />
          <span>Inventory</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-[#2C5F2D]' : ''}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'recipes' ? 'text-[#2C5F2D]' : ''}`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span>Recipes</span>
        </button>

        <button
          onClick={() => setActiveTab('operations')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'operations' ? 'text-[#2C5F2D]' : ''}`}
        >
          <Truck className="w-5 h-5" />
          <span>Ops</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-[#2C5F2D]' : ''}`}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </nav>

      {/* Modals */}
      <AddItemsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <MorningDigestModal
        isOpen={isDigestOpen}
        onClose={() => setIsDigestOpen(false)}
        setActiveTab={(t) => setActiveTab(t as any)}
      />

      <ScaleSelectorModal
        isOpen={isScaleModalOpen}
        onClose={() => setIsScaleModalOpen(false)}
      />

      <CommandPaletteModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        setActiveTab={(t) => setActiveTab(t as any)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenScaleModal={() => setIsScaleModalOpen(true)}
        onOpenRestockList={openRestockPanel}
        onOpenLabelPrinter={() => openLabelPrinter()}
        onOpenStocktake={() => setIsStocktakeOpen(true)}
      />

      <FifoLabelPrinterModal
        isOpen={isLabelPrinterOpen}
        onClose={() => setIsLabelPrinterOpen(false)}
        items={items}
        initialSelectedIds={labelPrinterInitialIds}
        organizationName={preferences.organizationName}
      />

      <StocktakeModal
        isOpen={isStocktakeOpen}
        onClose={() => setIsStocktakeOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <InventoryProvider>
      <MainApp />
    </InventoryProvider>
  );
}
