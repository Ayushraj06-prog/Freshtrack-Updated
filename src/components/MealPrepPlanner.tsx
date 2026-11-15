/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Sparkles,
  Plus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  X,
  Utensils,
  RefreshCw,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { MealPlanEntry, MealSlot, Recipe } from '../types/inventory';

interface MealPrepPlannerProps {
  availableRecipes: Recipe[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MealPrepPlanner: React.FC<MealPrepPlannerProps> = ({ availableRecipes }) => {
  const {
    items,
    mealPlans,
    restockList,
    preferences,
    saveMealPlan,
    deleteMealPlan,
    clearMealPlans,
    addToRestockList,
  } = useInventory();

  const isCommercial = preferences.operationScale !== 'household';

  const slots: { id: MealSlot; label: string }[] = isCommercial
    ? [
        { id: 'breakfast', label: 'Morning Prep' },
        { id: 'lunch', label: 'Lunch Service' },
        { id: 'dinner', label: 'Dinner Service' },
      ]
    : [
        { id: 'breakfast', label: 'Breakfast' },
        { id: 'lunch', label: 'Lunch' },
        { id: 'dinner', label: 'Dinner' },
      ];

  const [editingSlot, setEditingSlot] = useState<{ day: string; slot: MealSlot } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('custom');
  const [customTitle, setCustomTitle] = useState('');
  const [customServings, setCustomServings] = useState(isCommercial ? 15 : 2);
  const [customIngredientsText, setCustomIngredientsText] = useState('');
  const [notes, setNotes] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const planByKey = useMemo(() => {
    const map: Record<string, MealPlanEntry> = {};
    for (const p of mealPlans) {
      map[`${p.dayOfWeek}-${p.slot}`] = p;
    }
    return map;
  }, [mealPlans]);

  const activeItemsLower = useMemo(
    () => items.filter((i) => i.status === 'active').map((i) => i.name.toLowerCase()),
    [items]
  );

  const pendingBuyNames = useMemo(
    () => new Set(restockList.filter((r) => r.status === 'pending').map((r) => r.name.toLowerCase())),
    [restockList]
  );

  // Compute all unique ingredients needed across the planned week & check which ones are missing from active stock
  const missingIngredients = useMemo(() => {
    const required = new Set<string>();
    for (const p of mealPlans) {
      for (const ing of p.ingredients || []) {
        const clean = ing.trim();
        if (clean) required.add(clean);
      }
    }

    const missing: string[] = [];
    required.forEach((ing) => {
      const low = ing.toLowerCase();
      // Skip common universal staples unless explicitly listed as missing stock
      const inStock = activeItemsLower.some((act) => act.includes(low) || low.includes(act));
      if (!inStock) missing.push(ing);
    });
    return missing;
  }, [mealPlans, activeItemsLower]);

  const openEditor = (day: string, slot: MealSlot) => {
    const existing = planByKey[`${day}-${slot}`];
    setEditingSlot({ day, slot });
    if (existing) {
      setSelectedRecipeId(existing.recipeId || 'custom');
      setCustomTitle(existing.recipeTitle);
      setCustomServings(existing.servings || (isCommercial ? 15 : 2));
      setCustomIngredientsText((existing.ingredients || []).join(', '));
      setNotes(existing.notes || '');
    } else {
      setSelectedRecipeId(availableRecipes.length > 0 ? availableRecipes[0].id : 'custom');
      if (availableRecipes.length > 0) {
        const first = availableRecipes[0];
        setCustomTitle(first.title);
        setCustomServings(isCommercial ? first.servings * 5 : first.servings);
        setCustomIngredientsText(first.allIngredients.map((i) => i.name).join(', '));
      } else {
        setCustomTitle('');
        setCustomServings(isCommercial ? 15 : 2);
        setCustomIngredientsText('');
      }
      setNotes('');
    }
  };

  const handleRecipeSelectChange = (recipeId: string) => {
    setSelectedRecipeId(recipeId);
    if (recipeId === 'custom') {
      setCustomTitle('');
      setCustomIngredientsText('');
      return;
    }
    const found = availableRecipes.find((r) => r.id === recipeId);
    if (found) {
      setCustomTitle(found.title);
      setCustomServings(isCommercial ? found.servings * 5 : found.servings);
      setCustomIngredientsText(found.allIngredients.map((i) => i.name).join(', '));
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !customTitle.trim()) return;
    const ingredients = customIngredientsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await saveMealPlan({
      id: `${editingSlot.day}-${editingSlot.slot}`,
      dayOfWeek: editingSlot.day,
      slot: editingSlot.slot,
      recipeId: selectedRecipeId !== 'custom' ? selectedRecipeId : null,
      recipeTitle: customTitle.trim(),
      servings: Math.max(1, Number(customServings) || 2),
      ingredients,
      notes: notes.trim() || null,
    });
    showToast(`Saved "${customTitle.trim()}" to ${editingSlot.day}!`);
    setEditingSlot(null);
  };

  const handleAutoPlanUrgent = async () => {
    if (availableRecipes.length === 0) {
      showToast('Add active kitchen items first so recipes can be auto-planned.');
      return;
    }
    const prioritized = [...availableRecipes].sort(
      (a, b) => (b.usedExpiringItems?.length || 0) - (a.usedExpiringItems?.length || 0)
    );
    let added = 0;
    let recipeIdx = 0;
    for (const day of DAYS) {
      for (const slot of ['lunch', 'dinner'] as MealSlot[]) {
        if (added >= 4 || recipeIdx >= prioritized.length) break;
        if (!planByKey[`${day}-${slot}`]) {
          const r = prioritized[recipeIdx++];
          await saveMealPlan({
            id: `${day}-${slot}`,
            dayOfWeek: day,
            slot,
            recipeId: r.id,
            recipeTitle: r.title,
            servings: isCommercial ? r.servings * 5 : r.servings,
            ingredients: r.allIngredients.map((i) => i.name),
            notes: r.usedExpiringItems.length > 0 ? `Uses expiring: ${r.usedExpiringItems.slice(0, 2).join(', ')}` : null,
          });
          added++;
        }
      }
      if (added >= 4) break;
    }
    showToast(added > 0 ? `Auto-planned ${added} zero-waste meals using urgent stock!` : 'Week slots are already filled.');
  };

  const handlePushMissingToBuyList = async () => {
    const toQueue = missingIngredients.filter((ing) => !pendingBuyNames.has(ing.toLowerCase()));
    if (toQueue.length === 0) {
      showToast('All missing ingredients are already in your Need-to-Buy list!');
      return;
    }
    for (const ing of toQueue) {
      await addToRestockList({
        name: ing,
        category: 'Other',
        targetQuantity: isCommercial ? 5 : 1,
        unit: 'pack',
        storage: 'pantry',
        reason: 'manual',
        priority: 'normal',
        branchZone: isCommercial ? preferences.branchLocation || null : null,
      });
    }
    showToast(`Added ${toQueue.length} missing planner ingredient(s) to your Buy List!`);
  };

  return (
    <div className="space-y-4">
      {/* Top Planner Controls */}
      <div className="bg-white border border-[#E2E8DE] rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#2C5F2D]" />
              <h3 className="font-extrabold text-base text-stone-900">
                {isCommercial ? '7-Day Kitchen Prep & Service Schedule' : '7-Day Zero-Waste Meal Planner'}
              </h3>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Plan dishes across the week, prioritize expiring stock, and send missing ingredients straight to Need-to-Buy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
            <button
              type="button"
              onClick={handleAutoPlanUrgent}
              className="px-3 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#A3E635]" />
              <span>Auto-Plan Urgent Stock</span>
            </button>

            {missingIngredients.length > 0 && (
              <button
                type="button"
                onClick={handlePushMissingToBuyList}
                className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>+ Buy List ({missingIngredients.length} missing)</span>
              </button>
            )}

            {mealPlans.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearMealPlans();
                      setConfirmClear(false);
                      showToast('Cleared weekly schedule.');
                    }}
                    className="px-2.5 py-2 rounded-xl bg-rose-600 text-white font-bold cursor-pointer"
                  >
                    Confirm Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-2 rounded-xl bg-stone-100 text-stone-700 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold cursor-pointer"
                >
                  Clear Week
                </button>
              )
            )}
          </div>
        </div>

        {toastMsg && (
          <div className="p-2.5 rounded-xl bg-[#EAF3E6] border border-[#6B9B4F] text-[#2C5F2D] text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Missing Ingredients Banner if any */}
      {missingIngredients.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <span className="font-extrabold text-amber-950 block">
              Pantry Gap Check ({missingIngredients.length} planned ingredients not currently in active stock):
            </span>
            <p className="text-[11px] text-amber-900 mt-0.5 truncate">
              {missingIngredients.slice(0, 8).join(', ')}
              {missingIngredients.length > 8 ? ` +${missingIngredients.length - 8} more` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePushMissingToBuyList}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shrink-0 cursor-pointer"
          >
            Queue All Missing &rarr;
          </button>
        </div>
      )}

      {/* 7-Day Schedule Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {DAYS.map((day) => (
          <div
            key={day}
            className="bg-white border border-[#E2E8DE] rounded-2xl p-3 shadow-2xs flex flex-col gap-2"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
              <span className="font-extrabold text-sm text-[#2C5F2D]">{day}</span>
              <span className="text-[10px] text-stone-400 font-bold">
                {slots.filter((s) => Boolean(planByKey[`${day}-${s.id}`])).length}/3 planned
              </span>
            </div>

            <div className="space-y-2 flex-1">
              {slots.map((slot) => {
                const entry = planByKey[`${day}-${slot.id}`];
                return (
                  <div
                    key={slot.id}
                    className={`p-2 rounded-xl border text-xs transition-all ${
                      entry
                        ? 'bg-[#EAF3E6]/70 border-[#6B9B4F]/50'
                        : 'bg-stone-50/70 border-dashed border-stone-200 hover:border-[#2C5F2D]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        {slot.label}
                      </span>
                      {entry && (
                        <button
                          type="button"
                          onClick={() => deleteMealPlan(entry.id)}
                          className="text-stone-400 hover:text-rose-600 cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {entry ? (
                      <button
                        type="button"
                        onClick={() => openEditor(day, slot.id)}
                        className="w-full text-left cursor-pointer"
                      >
                        <p className="font-extrabold text-stone-900 text-xs leading-snug line-clamp-2">
                          {entry.recipeTitle}
                        </p>
                        <p className="text-[10px] text-[#2C5F2D] font-semibold mt-0.5">
                          {entry.servings} {isCommercial ? 'portions/batch' : 'servings'}
                        </p>
                        {entry.notes && (
                          <p className="text-[10px] text-stone-500 truncate mt-0.5">{entry.notes}</p>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEditor(day, slot.id)}
                        className="w-full py-1.5 text-[11px] font-bold text-stone-500 hover:text-[#2C5F2D] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Assign</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Assign / Edit Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#2C5F2D]" />
                <h4 className="font-extrabold text-sm text-stone-900">
                  Plan {editingSlot.day} &bull;{' '}
                  {slots.find((s) => s.id === editingSlot.slot)?.label}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Pick From Saved / Rasoi Recipes (or Custom)
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => handleRecipeSelectChange(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
                >
                  <option value="custom">-- Custom Dish / Prep Note --</option>
                  {availableRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.source === 'custom' ? '★ ' : ''}
                      {r.title}
                      {r.usedExpiringItems?.length > 0 ? ` (Uses ${r.usedExpiringItems.length} expiring)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="font-bold text-stone-700 block mb-1">Dish / Prep Name *</label>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Palak Paneer / Dal Tadka"
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    {isCommercial ? 'Portions' : 'Servings'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customServings}
                    onChange={(e) => setCustomServings(Number(e.target.value) || 2)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Key Ingredients (comma-separated for Pantry Gap Check)
                </label>
                <textarea
                  rows={2}
                  value={customIngredientsText}
                  onChange={(e) => setCustomIngredientsText(e.target.value)}
                  placeholder="Paneer, Spinach, Tomato, Onions, Cream"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Prep Note (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Soak dal overnight"
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save to Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
