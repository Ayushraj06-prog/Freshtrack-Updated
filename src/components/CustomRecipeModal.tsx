/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack - Custom Recipe Builder & Cooker
 * Allows customers to invent, save, and cook their own recipes using
 * ingredients from their kitchen pantry, recording portion deductions and money savings.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ChefHat,
  Plus,
  Trash2,
  Clock,
  Users,
  Sparkles,
  Flame,
  CheckCircle2,
  TrendingUp,
  Package,
  AlertTriangle,
  BookOpen,
  Layers,
  Utensils,
  Lightbulb,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getRemainingDays } from '../data/shelfLifeData';
import { CustomRecipe, CustomRecipeIngredient, DietType, InventoryItem } from '../types/inventory';
import { aiService } from '../services/aiService';

interface CustomRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedItemId?: string | null;
  onSuccess?: (message: string) => void;
}

const COMMON_PANTRY_SPICES = [
  'Mustard Seeds (Rai)',
  'Cumin (Jeera)',
  'Turmeric (Haldi)',
  'Red Chilli Powder',
  'Garam Masala',
  'Salt to taste',
  'Ghee / Cooking Oil',
  'Green Chillies',
  'Ginger-Garlic Paste',
  'Curry Leaves (Kadi Patta)',
  'Asafoetida (Hing)',
  'Coriander Powder (Dhaniya)',
];

const QUICK_INSPIRATIONS = [
  'Dahi Tadka Toast',
  'Leftover Palak Paneer Bhurji',
  'Tomato Rasam Rice',
  'Evening Bread Upma',
  'Aloo Jeera Wrap',
  'Khichdi with Curd',
  'Egg & Onion Scramble',
];

export const CustomRecipeModal: React.FC<CustomRecipeModalProps> = ({
  isOpen,
  onClose,
  initialSelectedItemId,
  onSuccess,
}) => {
  const { items, preferences, saveCustomRecipe, cookCustomRecipe } = useInventory();

  // Active kitchen items
  const activeItems = useMemo(() => {
    return items.filter((i) => i.status === 'active');
  }, [items]);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeMinutes, setTimeMinutes] = useState(15);
  const [servings, setServings] = useState(2);
  const [diet, setDiet] = useState<DietType>(preferences.diet || 'veg');
  const [cuisine, setCuisine] = useState('Homestyle');
  const [instructionsText, setInstructionsText] = useState('');
  const [notes, setNotes] = useState('');
  const [isGeneratingAiSteps, setIsGeneratingAiSteps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected ingredients from kitchen inventory
  // itemId -> { portion: 0.25 | 0.5 | 0.75 | 1.0, quantity: number, unit: string }
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<
    Record<
      string,
      {
        portion: number;
        customQty?: number;
        isCustomQty: boolean;
      }
    >
  >({});

  // Additional pantry spices or manual ingredients
  const [additionalIngredients, setAdditionalIngredients] = useState<string[]>([]);
  const [newExtraIngredient, setNewExtraIngredient] = useState('');

  // Pre-select initial item if provided
  useEffect(() => {
    if (initialSelectedItemId) {
      const match = activeItems.find((i) => i.id === initialSelectedItemId);
      if (match) {
        setSelectedInventoryItems({
          [match.id]: { portion: 0.5, isCustomQty: false },
        });
        if (!title) {
          setTitle(`Quick ${match.name.replace(/\s*\d+.*$/, '')} Dish`);
        }
      }
    }
  }, [initialSelectedItemId, activeItems]);

  if (!isOpen) return null;

  // Toggle kitchen item selection
  const handleToggleItem = (item: InventoryItem) => {
    setSelectedInventoryItems((prev) => {
      const copy = { ...prev };
      if (copy[item.id]) {
        delete copy[item.id];
      } else {
        copy[item.id] = { portion: 0.5, isCustomQty: false };
      }
      return copy;
    });
  };

  // Change portion for an item
  const handleSetPortion = (itemId: string, portion: number) => {
    setSelectedInventoryItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        portion,
        isCustomQty: false,
      },
    }));
  };

  // Toggle quick pantry spices
  const handleToggleSpices = (spice: string) => {
    setAdditionalIngredients((prev) =>
      prev.includes(spice) ? prev.filter((s) => s !== spice) : [...prev, spice]
    );
  };

  const handleAddCustomExtra = () => {
    if (!newExtraIngredient.trim()) return;
    if (!additionalIngredients.includes(newExtraIngredient.trim())) {
      setAdditionalIngredients((prev) => [...prev, newExtraIngredient.trim()]);
    }
    setNewExtraIngredient('');
  };

  // Compute total savings & deductions
  const { totalSavingsRs, deductionDetails, usedItemCount } = useMemo(() => {
    let savings = 0;
    const deductions: {
      itemId: string;
      itemName: string;
      portion: number;
      usedQuantity: number;
      remainingQuantity: number;
      unit: string;
      savedRs: number;
    }[] = [];

    for (const [id, config] of Object.entries(selectedInventoryItems)) {
      const item = activeItems.find((i) => i.id === id);
      if (!item) continue;

      const currQty = Number(item.quantity) || 1;
      const origQty = Number(item.originalQuantity) || currQty;
      const price = item.price || 0;

      let fraction = config.portion;
      let usedAmount = Number((currQty * fraction).toFixed(2));

      if (config.isCustomQty && config.customQty !== undefined) {
        usedAmount = Math.min(currQty, Math.max(0, config.customQty));
        fraction = currQty > 0 ? usedAmount / currQty : 1.0;
      }

      const portionOfTotal = origQty > 0 ? usedAmount / origQty : fraction;
      const moneySaved = price > 0 ? Math.round(price * portionOfTotal) : 0;
      savings += moneySaved;

      deductions.push({
        itemId: item.id,
        itemName: item.name,
        portion: fraction,
        usedQuantity: usedAmount,
        remainingQuantity: Math.max(0, Number((currQty - usedAmount).toFixed(2))),
        unit: item.unit,
        savedRs: moneySaved,
      });
    }

    return {
      totalSavingsRs: savings,
      deductionDetails: deductions,
      usedItemCount: deductions.length,
    };
  }, [selectedInventoryItems, activeItems]);

  // AI Assistant to auto-fill cooking steps
  const handleAutoSuggestSteps = async () => {
    if (!title.trim() && usedItemCount === 0) {
      alert('Please enter a dish name or select at least 1 ingredient first!');
      return;
    }

    setIsGeneratingAiSteps(true);
    const ingredientNames = deductionDetails.map((d) => d.itemName).concat(additionalIngredients);
    const dishTitle = title.trim() || `Homestyle ${ingredientNames[0] || 'Kitchen'} Dish`;

    try {
      const result = await aiService.suggestRecipes({
        expiringItems: ingredientNames.slice(0, 4),
        allKitchenItems: activeItems.map((i) => i.name),
        diet,
      });

      if (result.recipes && result.recipes.length > 0) {
        const top = result.recipes[0];
        if (!title.trim()) setTitle(top.title);
        if (!description.trim()) setDescription(top.description);
        setTimeMinutes(top.timeMinutes || 15);
        setInstructionsText(top.instructions.join('\n'));
      }
    } catch (err) {
      // Offline fallback template
      setInstructionsText(
        `1. Prep and wash all fresh ingredients.\n2. Heat oil or ghee in a pan; add tempering spices (mustard, cumin, green chillies).\n3. Add ${ingredientNames.slice(0, 2).join(' and ')} and sauté over medium flame until fragrant.\n4. Season with salt and turmeric, cook until soft, garnish and serve hot!`
      );
    } finally {
      setIsGeneratingAiSteps(false);
    }
  };

  // Compile recipe payload
  const buildRecipePayload = (): Partial<CustomRecipe> => {
    const ingredientList: CustomRecipeIngredient[] = [];

    for (const d of deductionDetails) {
      ingredientList.push({
        itemId: d.itemId,
        name: d.itemName,
        portionUsed: d.portion,
        quantityUsed: d.usedQuantity,
        unit: d.unit,
        amountText: `${d.usedQuantity} ${d.unit} (${Math.round(d.portion * 100)}%)`,
        isPantryStaple: false,
      });
    }

    for (const extra of additionalIngredients) {
      ingredientList.push({
        name: extra,
        amountText: 'To taste',
        isPantryStaple: true,
      });
    }

    const steps = instructionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      title: title.trim() || 'My Homemade Kitchen Creation',
      description:
        description.trim() ||
        `Custom zero-waste recipe cooked using ${ingredientList.slice(0, 3).map((i) => i.name).join(', ')}.`,
      timeMinutes,
      servings,
      difficulty: 'Easy',
      diet,
      cuisine,
      ingredients: ingredientList,
      instructions: steps.length > 0 ? steps : ['Cook ingredients together and serve fresh!'],
      notes: notes.trim() || undefined,
      source: 'custom',
    };
  };

  // Save recipe and deduct items immediately
  const handleCookAndDeduct = async () => {
    if (usedItemCount === 0 && additionalIngredients.length === 0) {
      alert('Please select at least 1 ingredient used in your recipe!');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildRecipePayload();
      const saved = await saveCustomRecipe(payload);

      // Prepare deduction payloads
      const deductions = deductionDetails.map((d) => ({
        itemId: d.itemId,
        portion: d.portion,
        usedQuantity: d.usedQuantity,
        usedPortionName: `Cooked in "${saved.title}" (${d.usedQuantity} ${d.unit})`,
      }));

      await cookCustomRecipe(saved.id, deductions);

      if (onSuccess) {
        onSuccess(
          `🎉 Cooked "${saved.title}"! Deducted ${usedItemCount} ingredient(s) and credited ₹${totalSavingsRs} savings.`
        );
      }
      onClose();
    } catch (err: any) {
      alert('Failed to log custom recipe: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save to recipe book only (without deducting pantry now)
  const handleSaveOnly = async () => {
    setIsSubmitting(true);
    try {
      const payload = buildRecipePayload();
      const saved = await saveCustomRecipe(payload);
      if (onSuccess) {
        onSuccess(`📖 Saved "${saved.title}" to your custom cookbook!`);
      }
      onClose();
    } catch (err: any) {
      alert('Failed to save recipe: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#2C5F2D] via-[#244f25] to-[#1c3e1d] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <ChefHat className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Cook With Your Own Recipe
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium">
                Invent or log any dish, deduct ingredients used &amp; credit savings
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* 1. Dish Name & Quick Inspirations */}
          <div className="space-y-2">
            <label className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center justify-between">
              <span>Dish or Recipe Name *</span>
              <span className="text-[11px] font-normal text-stone-400">e.g. Mummy's Kadhi</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dahi Tadka Toast, Palak Paneer Bhurji, Late Night Khichdi..."
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-bold text-stone-900 focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />

            {/* Quick Inspiration Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="text-stone-400 shrink-0 flex items-center gap-1 font-semibold">
                <Lightbulb className="w-3 h-3 text-amber-500" /> Ideas:
              </span>
              {QUICK_INSPIRATIONS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setTitle(idea)}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-[#EAF3E6] hover:text-[#2C5F2D] text-stone-600 rounded-xl whitespace-nowrap transition-colors cursor-pointer font-medium"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Select Ingredients from Active Kitchen Pantry */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#2C5F2D]" />
                <span>Ingredients from Your Kitchen ({usedItemCount} selected)</span>
              </label>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Tap to pick items used
              </span>
            </div>

            {activeItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1 border border-stone-200 rounded-2xl bg-stone-50/50">
                {activeItems.map((item) => {
                  const isSelected = Boolean(selectedInventoryItems[item.id]);
                  const config = selectedInventoryItems[item.id] || { portion: 0.5 };
                  const remDays = getRemainingDays(item.estimatedExpiryDate);
                  const isUrgent = remDays <= 2;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-white border-[#2C5F2D] shadow-xs ring-1 ring-[#2C5F2D]'
                          : 'bg-white/80 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(item)}
                          className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
                        >
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#2C5F2D] border-[#2C5F2D] text-white'
                                : 'border-stone-300 bg-white'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs text-stone-900 truncate">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-stone-500 font-medium">
                              {item.quantity} {item.unit} available &bull;{' '}
                              <span className={isUrgent ? 'text-amber-700 font-bold' : ''}>
                                {remDays <= 0 ? 'Expires today' : `${remDays}d left`}
                              </span>
                            </p>
                          </div>
                        </button>

                        {item.price && (
                          <span className="text-xs font-bold text-[#2C5F2D] shrink-0">
                            ₹{item.price}
                          </span>
                        )}
                      </div>

                      {/* Portion Selector for Selected Item */}
                      {isSelected && (
                        <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[10px]">
                          <span className="font-bold text-stone-600">Portion used:</span>
                          <div className="flex items-center gap-1">
                            {[
                              { label: '25%', val: 0.25 },
                              { label: '50%', val: 0.5 },
                              { label: '75%', val: 0.75 },
                              { label: 'All', val: 1.0 },
                            ].map((p) => (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() => handleSetPortion(item.id, p.val)}
                                className={`px-2 py-0.5 rounded-md font-extrabold transition-colors cursor-pointer ${
                                  config.portion === p.val
                                    ? 'bg-[#2C5F2D] text-white shadow-2xs'
                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic p-3 bg-stone-50 rounded-2xl">
                No active kitchen items in pantry. You can still add your recipe and spices below!
              </p>
            )}
          </div>

          {/* 3. Pantry Spices & Extras */}
          <div className="space-y-2">
            <label className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center justify-between">
              <span>Pantry Spices &amp; Seasonings (Optional)</span>
              <span className="text-[11px] font-normal text-stone-400">1-tap add</span>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {COMMON_PANTRY_SPICES.map((spice) => {
                const isPicked = additionalIngredients.includes(spice);
                return (
                  <button
                    key={spice}
                    type="button"
                    onClick={() => handleToggleSpices(spice)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isPicked
                        ? 'bg-[#2C5F2D] text-white shadow-2xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200/80'
                    }`}
                  >
                    {isPicked ? '✓ ' : '+ '}
                    {spice}
                  </button>
                );
              })}
            </div>

            {/* Custom Extra Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newExtraIngredient}
                onChange={(e) => setNewExtraIngredient(e.target.value)}
                placeholder="Add other ingredient (e.g. Kasuri Methi, Lemon juice)..."
                className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-1 focus:ring-[#2C5F2D] focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomExtra())}
              />
              <button
                type="button"
                onClick={handleAddCustomExtra}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Add Extra
              </button>
            </div>
          </div>

          {/* 4. Recipe Attributes (Time, Servings, Diet) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div>
              <label className="font-bold text-stone-600 block mb-1">Time (mins)</label>
              <input
                type="number"
                min="1"
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(Math.max(1, parseInt(e.target.value) || 15))}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-center"
              />
            </div>

            <div>
              <label className="font-bold text-stone-600 block mb-1">Servings</label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 2))}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-center"
              />
            </div>

            <div>
              <label className="font-bold text-stone-600 block mb-1">Diet</label>
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value as DietType)}
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold capitalize"
              >
                <option value="veg">Veg 🌱</option>
                <option value="egg">Egg 🥚</option>
                <option value="non-veg">Non-Veg 🍗</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-600 block mb-1">Cuisine / Category</label>
              <input
                type="text"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g. Breakfast, Curry"
                className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold"
              />
            </div>
          </div>

          {/* 5. Instructions & AI Assistant */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-stone-700 uppercase tracking-wider">
                Cooking Steps / Instructions (Optional)
              </label>
              <button
                type="button"
                onClick={handleAutoSuggestSteps}
                disabled={isGeneratingAiSteps}
                className="text-xs font-bold text-[#2C5F2D] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isGeneratingAiSteps ? 'AI Chef is writing...' : '✨ Auto-suggest Steps with AI'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder="e.g. 1. Heat ghee in a tawa.\n2. Sauté chopped onions and spices.\n3. Add paneer/curd and cook for 5 minutes.\n4. Garnish with fresh coriander."
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
          </div>

          {/* 6. Dynamic Cooking Impact Card */}
          <div className="p-4 bg-gradient-to-br from-stone-50 via-emerald-50/50 to-emerald-100/40 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#2C5F2D] text-white flex items-center justify-center text-xs font-black">
                  ₹
                </span>
                <span className="font-extrabold text-sm text-stone-900">
                  {usedItemCount > 0
                    ? `${usedItemCount} kitchen ingredient(s) will be deducted`
                    : 'No kitchen ingredients selected yet'}
                </span>
              </div>
              <p className="text-xs text-stone-600">
                {deductionDetails.map((d) => `${d.itemName} (${d.usedQuantity} ${d.unit})`).join(', ') ||
                  'Pick ingredients above to deduct consumed stock automatically.'}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-stone-400 block">
                Monetary Rescue
              </span>
              <span className="text-xl font-black text-[#2C5F2D]">
                +₹{totalSavingsRs} Saved
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-stone-600 hover:text-stone-900 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={isSubmitting || (!title.trim() && usedItemCount === 0)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer disabled:opacity-50"
            >
              Save to Cookbook Only
            </button>

            <button
              type="button"
              onClick={handleCookAndDeduct}
              disabled={isSubmitting || usedItemCount === 0}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#2C5F2D] hover:bg-[#204721] text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-[#2C5F2D]/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Flame className="w-4 h-4 text-[#A3E635]" />
              <span>
                {isSubmitting
                  ? 'Logging...'
                  : `Cook Now & Deduct (Save ₹${totalSavingsRs})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
