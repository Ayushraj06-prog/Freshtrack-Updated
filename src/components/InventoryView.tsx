/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertTriangle,
  Clock,
  Sparkles,
  PlusCircle,
  Package,
  UtensilsCrossed,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getRemainingDays, SHELF_LIFE_DATABASE } from '../data/shelfLifeData';
import { InventoryItem, ItemCategory, StorageLocation } from '../types/inventory';
import { UseItemModal } from './UseItemModal';
import { CustomRecipeModal } from './CustomRecipeModal';

interface InventoryViewProps {
  onOpenAddModal: () => void;
  setActiveTab: (tab: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onOpenAddModal, setActiveTab }) => {
  const { items, markAsUsed, deleteItem, updateItem } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStorage, setSelectedStorage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'urgent' | 'used' | 'all'>('active');

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [usingItem, setUsingItem] = useState<InventoryItem | null>(null);
  const [isCustomRecipeOpen, setIsCustomRecipeOpen] = useState(false);
  const [customRecipeItemId, setCustomRecipeItemId] = useState<string | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Storage filter
      if (selectedStorage !== 'all' && item.storage !== selectedStorage) return false;

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Status filter
      if (selectedStatus === 'active' && item.status !== 'active') return false;
      if (selectedStatus === 'used' && item.status !== 'used') return false;
      if (selectedStatus === 'urgent') {
        if (item.status !== 'active') return false;
        const days = getRemainingDays(item.estimatedExpiryDate);
        if (days > 2) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.includes(q))
        );
      }

      return true;
    });
  }, [items, selectedStorage, selectedCategory, selectedStatus, searchQuery]);

  return (
    <div className="space-y-5 pb-24">
      {/* Top Controls: Search & Primary Action */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, milk, curd, paneer, atta, barcodes..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8DE] rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setCustomRecipeItemId(null);
              setIsCustomRecipeOpen(true);
            }}
            className="px-3.5 py-2.5 bg-[#EAF3E6] hover:bg-[#d8edd1] text-[#2C5F2D] border border-[#6B9B4F]/40 text-xs font-bold rounded-2xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4 text-[#2C5F2D]" />
            <span>Cook My Own Recipe</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="px-4 py-2.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold rounded-2xl shadow-md shadow-[#2C5F2D]/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Kitchen Items</span>
          </button>
        </div>
      </div>

      {/* Storage Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Items' },
          { id: 'fridge', label: 'Fridge ❄️' },
          { id: 'pantry', label: 'Pantry 🍞' },
          { id: 'freezer', label: 'Freezer 🧊' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedStorage(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedStorage === tab.id
                ? 'bg-[#2C5F2D] text-white shadow-xs'
                : 'bg-white border border-[#E2E8DE] text-stone-600 hover:bg-stone-50'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="h-5 w-px bg-stone-300 mx-1 shrink-0" />

        {/* Status Pills */}
        {[
          { id: 'active', label: 'Active Fresh' },
          { id: 'urgent', label: 'Expiring ≤48h' },
          { id: 'used', label: 'Cooked/Saved (₹)' },
        ].map((st) => (
          <button
            key={st.id}
            onClick={() => setSelectedStatus(st.id as any)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedStatus === st.id
                ? 'bg-[#EAF3E6] text-[#2C5F2D] border border-[#6B9B4F]'
                : 'bg-white border border-[#E2E8DE] text-stone-500 hover:bg-stone-50'
            }`}
          >
            {st.label}
          </button>
        ))}

        {/* Category Dropdown */}
        <div className="ml-auto shrink-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#E2E8DE] rounded-xl text-xs font-semibold text-stone-700 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {SHELF_LIFE_DATABASE.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Item List Cards */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const remDays = getRemainingDays(item.estimatedExpiryDate);
            const isUsed = item.status === 'used';
            const isExpired = item.status === 'expired';
            const isUrgent = item.status === 'active' && remDays <= 2;
            const isWarning = item.status === 'active' && remDays > 2 && remDays <= 4;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between group ${
                  isUsed
                    ? 'bg-stone-50/70 border-stone-200 opacity-75'
                    : isUrgent
                    ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                    : 'bg-white border-[#E2E8DE] hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-12 h-12 object-contain rounded-xl bg-white p-1 border border-stone-200 shrink-0"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-[#EAF3E6] text-[#2C5F2D]'
                          }`}
                        >
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {item.category}
                          </span>
                          <span className="text-[10px] font-semibold text-stone-500 capitalize">
                            &bull; {item.storage}
                          </span>
                          {item.source && (
                            <span className="text-[10px] text-stone-400 capitalize">
                              &bull; {item.source}
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-sm text-stone-900 mt-1 truncate">
                          {item.name}
                        </h3>

                        <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-600">
                          <span className="font-bold text-stone-800">
                            {item.quantity} {item.unit}
                          </span>
                          {item.price !== null && (
                            <>
                              <span>&bull;</span>
                              <span className="font-bold text-[#2C5F2D]">₹{item.price}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expiry Badge */}
                    <div className="text-right shrink-0">
                      {isUsed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cooked (Saved)
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                          Expired
                        </span>
                      ) : isUrgent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-black shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {remDays <= 0 ? 'Expires Today!' : `${remDays}d left`}
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          {remDays} days left
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold">
                          Fresh ({remDays}d)
                        </span>
                      )}
                      <p className="text-[10px] text-stone-400 mt-1">
                        Exp: {item.estimatedExpiryDate}
                      </p>
                    </div>
                  </div>

                  {/* Partial Usage Progress Bar if item has been partially cooked */}
                  {item.status === 'active' && item.originalQuantity && item.originalQuantity > item.quantity && (
                    <div className="mt-2.5 pt-2 border-t border-stone-100 bg-[#EAF3E6]/60 -mx-4 px-4 py-2 rounded-xl">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-stone-700 flex items-center gap-1">
                          <UtensilsCrossed className="w-3 h-3 text-[#2C5F2D]" />
                          <span>Partially Used: {item.quantity} {item.unit} left</span>
                        </span>
                        <span className="text-[#2C5F2D] font-black">
                          {Math.round((item.quantity / item.originalQuantity) * 100)}% left
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#2C5F2D] rounded-full transition-all"
                          style={{ width: `${Math.round((item.quantity / item.originalQuantity) * 100)}%` }}
                        />
                      </div>
                      {item.savedMoney && item.savedMoney > 0 ? (
                        <p className="text-[10px] text-[#2C5F2D] font-bold mt-1">
                          ✨ ₹{item.savedMoney} saved so far from cooked portions
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Notes / Usage Log Display */}
                  {item.notes && (
                    <div className="mt-2 text-[10px] text-stone-500 bg-stone-50 px-2.5 py-1 rounded-lg truncate">
                      📝 {item.notes}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-100 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${item.name}" from SQLite database?`)) {
                          deleteItem(item.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isUsed && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('recipes')}
                        className="px-2.5 py-1 text-[11px] font-bold text-[#2C5F2D] hover:bg-[#EAF3E6] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Recipes</span>
                      </button>

                      <button
                        onClick={() => setUsingItem(item)}
                        className="px-3 py-1.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Cook / Use</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-10 border border-[#E2E8DE] text-center max-w-md mx-auto my-6 space-y-3">
          <Package className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-extrabold text-stone-800 text-base">No items found</h3>
          <p className="text-xs text-stone-500">
            {searchQuery
              ? `No items match "${searchQuery}". Try clearing search.`
              : 'Your kitchen pantry is empty. Scan a grocery bill or barcode to populate items!'}
          </p>
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-[#2C5F2D] text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Add Items Now
          </button>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 p-5 space-y-4">
            <h3 className="font-extrabold text-stone-900 text-base">Edit Item in Database</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Item Name</label>
                <input
                  type="text"
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: Number(e.target.value) || 1 })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={editingItem.price ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value ? Number(e.target.value) : null })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={editingItem.estimatedExpiryDate}
                  onChange={(e) => setEditingItem({ ...editingItem, estimatedExpiryDate: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Storage Location</label>
                <select
                  value={editingItem.storage}
                  onChange={(e) => setEditingItem({ ...editingItem, storage: e.target.value as StorageLocation })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl capitalize"
                >
                  <option value="fridge">Fridge ❄️</option>
                  <option value="pantry">Pantry 🍞</option>
                  <option value="freezer">Freezer 🧊</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-2 text-stone-600 font-bold text-xs bg-stone-100 hover:bg-stone-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateItem(editingItem.id, editingItem);
                  setEditingItem(null);
                }}
                className="flex-1 py-2 text-white font-bold text-xs bg-[#2C5F2D] hover:bg-[#204721] rounded-xl shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cooking & Portion Modal */}
      {usingItem && (
        <UseItemModal
          item={usingItem}
          onClose={() => setUsingItem(null)}
          onConfirm={(id, options) => markAsUsed(id, options)}
          onOpenCustomRecipe={(itemId) => {
            setUsingItem(null);
            setCustomRecipeItemId(itemId);
            setIsCustomRecipeOpen(true);
          }}
        />
      )}

      {/* Standalone Custom Recipe Creator Modal */}
      <CustomRecipeModal
        isOpen={isCustomRecipeOpen}
        onClose={() => {
          setIsCustomRecipeOpen(false);
          setCustomRecipeItemId(null);
        }}
        initialSelectedItemId={customRecipeItemId}
      />
    </div>
  );
};
