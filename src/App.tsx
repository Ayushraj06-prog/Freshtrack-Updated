/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Refrigerator,
  UtensilsCrossed,
  Settings,
  Plus,
} from 'lucide-react';
import { InventoryProvider } from './context/InventoryContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { RecipesView } from './components/RecipesView';
import { SettingsView } from './components/SettingsView';
import { AddItemsModal } from './components/AddItemsModal';
import { MorningDigestModal } from './components/MorningDigestModal';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'recipes' | 'settings'>('inventory');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDigestOpen, setIsDigestOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F6F0] text-stone-900 font-sans flex flex-col selection:bg-[#2C5F2D] selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        onOpenMorningDigest={() => setIsDigestOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
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
              <span>Kitchen Inventory</span>
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
              <span>₹ Savings &amp; Analytics</span>
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
              <span>Rasoi Zero-Waste Recipes</span>
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
              <span>SQLite DB &amp; Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 w-full pt-4 flex-1">
        {activeTab === 'inventory' && (
          <InventoryView
            onOpenAddModal={() => setIsAddModalOpen(true)}
            setActiveTab={(t) => setActiveTab(t as any)}
          />
        )}
        {activeTab === 'dashboard' && (
          <DashboardView
            setActiveTab={(t) => setActiveTab(t as any)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        )}
        {activeTab === 'recipes' && <RecipesView />}
        {activeTab === 'settings' && <SettingsView />}
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
          <span>Savings</span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'recipes' ? 'text-[#2C5F2D]' : ''}`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span>Recipes</span>
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
