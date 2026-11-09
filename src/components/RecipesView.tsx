/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  UtensilsCrossed,
  Clock,
  Sparkles,
  CheckCircle2,
  Filter,
  Check,
  Flame,
  ChefHat,
  Search,
  BookOpen,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getRemainingDays } from '../data/shelfLifeData';
import { RecipeService } from '../services/recipeService';
import { aiService } from '../services/aiService';
import { DietType, Recipe, CustomRecipe } from '../types/inventory';
import { CustomRecipeModal } from './CustomRecipeModal';

interface RecipesViewProps {
  initialExpiringItem?: string | null;
  onClearInitialExpiringItem?: () => void;
}

export const RecipesView: React.FC<RecipesViewProps> = ({
  initialExpiringItem,
  onClearInitialExpiringItem,
}) => {
  const { items, customRecipes, preferences, markMultipleAsUsed, deleteCustomRecipe, cookCustomRecipe } =
    useInventory();

  const [dietFilter, setDietFilter] = useState<DietType>(preferences.diet || 'veg');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cookedSuccessMessage, setCookedSuccessMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState(initialExpiringItem || '');
  const [recipesList, setRecipesList] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Custom Recipe Modal state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [recipeTab, setRecipeTab] = useState<'all' | 'expiring' | 'custom'>('all');

  // Expiring items in the kitchen (within 3 days)
  const expiringActiveItems = useMemo(() => {
    return items.filter((item) => {
      if (item.status !== 'active') return false;
      const days = getRemainingDays(item.estimatedExpiryDate);
      return days <= 3 && days >= 0;
    });
  }, [items]);

  const recipeService = useMemo(() => {
    return new RecipeService();
  }, []);

  // Map custom recipes to standard Recipe format
  const mappedCustomRecipes: Recipe[] = useMemo(() => {
    return customRecipes.map((cr) => {
      const pantryIngredients = cr.ingredients.filter((i) => !i.isPantryStaple);
      const usedExpiring = pantryIngredients
        .map((i) => i.name)
        .filter((name) =>
          expiringActiveItems.some(
            (exp) => exp.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(exp.name.toLowerCase())
          )
        );

      return {
        id: cr.id,
        title: cr.title,
        description: cr.description,
        image:
          cr.image ||
          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
        timeMinutes: cr.timeMinutes,
        servings: cr.servings,
        difficulty: cr.difficulty,
        diet: cr.diet,
        cuisine: cr.cuisine || 'Homestyle',
        usedExpiringItems: usedExpiring.length > 0 ? usedExpiring : pantryIngredients.map((i) => i.name),
        allIngredients: cr.ingredients.map((i) => ({
          name: i.name,
          amount: i.amountText || (i.quantityUsed ? `${i.quantityUsed} ${i.unit || ''}` : ''),
        })),
        instructions: cr.instructions,
        source: 'custom',
        cookedCount: cr.cookedCount || 0,
        lastCookedAt: cr.lastCookedAt,
      };
    });
  }, [customRecipes, expiringActiveItems]);

  // Load recipes based on expiring items
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const expiringNames = expiringActiveItems.map((i) => i.name);
    if (initialExpiringItem && !expiringNames.includes(initialExpiringItem)) {
      expiringNames.unshift(initialExpiringItem);
    }

    recipeService
      .getRecipesForExpiringItems(expiringNames, dietFilter)
      .then((recipes) => {
        if (isMounted) {
          setRecipesList(recipes);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error('Error fetching recipes', e);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [expiringActiveItems, dietFilter, initialExpiringItem, recipeService]);

  // Request new AI recipes from Gemini Rasoi Chef
  const handleAskGeminiChef = async () => {
    setGeneratingAi(true);
    const expiringNames = expiringActiveItems.map((i) => i.name);
    const allNames = items.filter((i) => i.status === 'active').map((i) => i.name);

    try {
      const result = await aiService.suggestRecipes({
        expiringItems: expiringNames.length > 0 ? expiringNames : ['Tomatoes', 'Curd', 'Coriander'],
        allKitchenItems: allNames,
        diet: dietFilter,
      });

      if (result.recipes && result.recipes.length > 0) {
        setRecipesList((prev) => [...result.recipes, ...prev]);
      }
    } catch (err) {
      console.warn('Gemini chef generation error:', err);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Combine custom recipes and catalog recipes based on tab filter
  const combinedRecipes = useMemo(() => {
    let list: Recipe[] = [];
    if (recipeTab === 'custom') {
      list = mappedCustomRecipes;
    } else if (recipeTab === 'expiring') {
      const catalogExpiring = recipesList.filter((r) => r.usedExpiringItems.length > 0);
      const customExpiring = mappedCustomRecipes.filter((r) => r.usedExpiringItems.length > 0);
      list = [...customExpiring, ...catalogExpiring];
    } else {
      // 'all': Show custom recipes at the top, followed by catalog recipes
      list = [...mappedCustomRecipes, ...recipesList];
    }

    // Filter by diet
    if (dietFilter) {
      list = list.filter((r) => {
        if (dietFilter === 'veg') return r.diet === 'veg';
        if (dietFilter === 'egg') return r.diet === 'veg' || r.diet === 'egg';
        return true;
      });
    }

    return list;
  }, [recipeTab, mappedCustomRecipes, recipesList, dietFilter]);

  // Filter recipes by search query
  const filteredRecipes = useMemo(() => {
    if (!searchFilter.trim()) return combinedRecipes;
    const q = searchFilter.toLowerCase();
    return combinedRecipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.usedExpiringItems.some((exp) => exp.toLowerCase().includes(q)) ||
        r.allIngredients.some((ing) => ing.name.toLowerCase().includes(q))
    );
  }, [combinedRecipes, searchFilter]);

  // "I cooked this recipe" handler
  const handleCookedRecipe = async (recipe: Recipe) => {
    if (recipe.source === 'custom') {
      // Custom recipe path: calculate matched pantry deductions
      const deductions: { itemId: string; portion?: number; usedQuantity?: number; usedPortionName?: string }[] = [];
      const matchedItemNames: string[] = [];

      items.forEach((item) => {
        if (item.status !== 'active') return;
        const itemNameLower = item.name.toLowerCase();

        const match = recipe.allIngredients.find(
          (ing) =>
            itemNameLower.includes(ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(itemNameLower)
        );

        if (match) {
          const currQty = Number(item.quantity) || 1;
          const usedAmt = Math.min(currQty, Math.max(1, Math.round(currQty * 0.5)));
          deductions.push({
            itemId: item.id,
            portion: 0.5,
            usedQuantity: usedAmt,
            usedPortionName: `Cooked in custom dish: "${recipe.title}"`,
          });
          matchedItemNames.push(item.name);
        }
      });

      try {
        await cookCustomRecipe(recipe.id, deductions);
        if (matchedItemNames.length > 0) {
          setCookedSuccessMessage(
            `👨‍🍳 Great job! Cooked custom recipe "${recipe.title}". Deducted ${matchedItemNames.length} pantry item(s): ${matchedItemNames.join(', ')}.`
          );
        } else {
          setCookedSuccessMessage(`👨‍🍳 Cooked custom recipe "${recipe.title}"! Logged in your kitchen history.`);
        }
      } catch (err: any) {
        setCookedSuccessMessage(`Logged recipe "${recipe.title}"!`);
      }
    } else {
      // Standard recipe path
      const matchedItemIds: string[] = [];
      const matchedItemNames: string[] = [];

      items.forEach((item) => {
        if (item.status !== 'active') return;
        const itemNameLower = item.name.toLowerCase();

        const isUsed =
          recipe.usedExpiringItems.some(
            (exp) => itemNameLower.includes(exp.toLowerCase()) || exp.toLowerCase().includes(itemNameLower)
          ) ||
          recipe.allIngredients.some(
            (ing) => itemNameLower.includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(itemNameLower)
          );

        if (isUsed) {
          matchedItemIds.push(item.id);
          matchedItemNames.push(item.name);
        }
      });

      if (matchedItemIds.length > 0) {
        await markMultipleAsUsed(matchedItemIds);
        setCookedSuccessMessage(
          `Delicious! Saved ${matchedItemNames.length} kitchen item(s) in database: ${matchedItemNames.join(', ')}.`
        );
      } else {
        setCookedSuccessMessage(`Recipe "${recipe.title}" completed and logged!`);
      }
    }

    setTimeout(() => {
      setCookedSuccessMessage(null);
    }, 5000);
  };

  // Delete custom recipe handler
  const handleDeleteCustom = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete custom recipe "${title}"?`)) {
      try {
        await deleteCustomRecipe(id);
        setCookedSuccessMessage(`Deleted custom recipe "${title}".`);
        setTimeout(() => setCookedSuccessMessage(null), 3000);
      } catch (err: any) {
        alert('Failed to delete recipe: ' + err?.message);
      }
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Top Banner: "What Can I Cook?" */}
      <div className="bg-gradient-to-br from-[#2C5F2D] to-[#204721] rounded-3xl p-5 text-white shadow-lg shadow-[#2C5F2D]/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                Zero-Waste Recipe Engine
              </span>
              <span className="text-xs text-white/80 font-medium">Indian Kitchen Focus</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
              What Can I Cook Today?
            </h2>
            <p className="text-xs text-white/80 mt-1 max-w-lg leading-relaxed">
              Auto-matched to items expiring in your kitchen within 3 days. Or invent your own custom dish, deduct used pantry portions, and credit zero-waste savings!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* Create Custom Recipe Button */}
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-[#A3E635] text-[#2C5F2D] hover:bg-[#b2f043] font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Cook My Own Recipe</span>
            </button>

            {/* Ask Gemini Rasoi Chef Button */}
            <button
              onClick={handleAskGeminiChef}
              disabled={generatingAi}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-70"
            >
              {generatingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              <span>{generatingAi ? 'Chef is thinking...' : '✨ Ask Gemini AI'}</span>
            </button>

            <div className="flex items-center gap-2 bg-black/20 p-2 rounded-2xl border border-white/10 shrink-0">
              <Flame className="w-5 h-5 text-amber-400" />
              <div className="text-right">
                <span className="text-xs font-bold block">{expiringActiveItems.length} items</span>
                <span className="text-[10px] text-white/70">expiring soon</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expiring Ingredients Tag List */}
        {expiringActiveItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-white/80 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#A3E635]" /> Expiring in your kitchen:
            </span>
            {expiringActiveItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSearchFilter(item.name)}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Success Celebration Toast */}
      {cookedSuccessMessage && (
        <div className="p-3.5 bg-[#EAF3E6] border border-[#6B9B4F] rounded-2xl flex items-center justify-between gap-3 text-xs text-[#2C5F2D] animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#2C5F2D] shrink-0" />
            <p className="font-bold">{cookedSuccessMessage}</p>
          </div>
          <button
            onClick={() => setCookedSuccessMessage(null)}
            className="text-[#2C5F2D] font-bold text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Recipe Tabs & Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-[#E2E8DE] shadow-xs">
          <button
            onClick={() => setRecipeTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              recipeTab === 'all'
                ? 'bg-[#2C5F2D] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            All Recipes ({mappedCustomRecipes.length + recipesList.length})
          </button>

          <button
            onClick={() => setRecipeTab('expiring')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              recipeTab === 'expiring'
                ? 'bg-[#2C5F2D] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span>Expiring Matches</span>
            <span className="text-[10px] bg-amber-400 text-stone-900 px-1.5 py-0.2 rounded-full font-black">
              {expiringActiveItems.length}
            </span>
          </button>

          <button
            onClick={() => setRecipeTab('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              recipeTab === 'custom'
                ? 'bg-[#2C5F2D] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>My Custom Recipes</span>
            <span className="text-[10px] bg-[#EAF3E6] text-[#2C5F2D] font-black px-1.5 py-0.2 rounded-full">
              {mappedCustomRecipes.length}
            </span>
          </button>
        </div>

        {/* Diet Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E2E8DE] text-xs">
            <span className="text-stone-400 text-[11px] px-2 font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3" /> Diet:
            </span>
            {(['veg', 'egg', 'non-veg'] as const).map((diet) => (
              <button
                key={diet}
                onClick={() => setDietFilter(diet)}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  dietFilter === diet
                    ? 'bg-[#2C5F2D] text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {diet === 'veg' ? 'Pure Veg' : diet === 'egg' ? 'Eggetarian' : 'Non-Veg'}
              </button>
            ))}
          </div>

          {/* Search Recipes */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search recipes, ingredients..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#E2E8DE] rounded-xl text-xs focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
            />
            {searchFilter && (
              <button
                onClick={() => {
                  setSearchFilter('');
                  if (onClearInitialExpiringItem) onClearInitialExpiringItem();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recipes Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-stone-500">
          <ChefHat className="w-8 h-8 text-[#2C5F2D] mx-auto mb-2 animate-bounce" />
          Matching Indian dishes to your kitchen staples...
        </div>
      ) : filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecipes.map((recipe) => {
            const isCustom = recipe.source === 'custom';
            return (
              <div
                key={recipe.id}
                className={`bg-white rounded-3xl border overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col justify-between group ${
                  isCustom ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-[#E2E8DE]'
                }`}
              >
                <div>
                  {/* Recipe Cover Image */}
                  <div className="relative aspect-video overflow-hidden bg-stone-100">
                    <img
                      src={recipe.image}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                    {/* Badge: Diet & Cuisine / Source */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                      {isCustom && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-md flex items-center gap-1">
                          <ChefHat className="w-3 h-3" />
                          <span>My Recipe</span>
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full text-white shadow-xs ${
                          recipe.diet === 'veg'
                            ? 'bg-emerald-700'
                            : recipe.diet === 'egg'
                            ? 'bg-amber-600'
                            : 'bg-rose-600'
                        }`}
                      >
                        {recipe.diet}
                      </span>
                      <span className="text-[10px] font-semibold text-white bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full">
                        {recipe.cuisine}
                      </span>
                    </div>

                    {/* Delete button for custom recipes */}
                    {isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustom(recipe.id, recipe.title, e)}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-stone-200 hover:text-rose-400 hover:bg-black transition-colors cursor-pointer"
                        title="Delete custom recipe"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-extrabold text-base leading-tight drop-shadow-sm flex items-center gap-1.5">
                        <span>{recipe.title}</span>
                      </h3>
                      {recipe.cookedCount !== undefined && recipe.cookedCount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-200 flex items-center gap-1 mt-0.5">
                          ✓ Cooked {recipe.cookedCount} time{recipe.cookedCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                      {recipe.description}
                    </p>

                    {/* Cooking meta */}
                    <div className="flex items-center gap-3 text-[11px] text-stone-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        {recipe.timeMinutes} mins
                      </span>
                      <span>&bull;</span>
                      <span>{recipe.difficulty}</span>
                      <span>&bull;</span>
                      <span>{recipe.servings} Servings</span>
                    </div>

                    {/* Expiring items / pantry ingredients highlight */}
                    <div className="p-2.5 rounded-xl bg-[#EAF3E6] border border-[#6B9B4F]/30 space-y-1">
                      <span className="text-[10px] font-bold text-[#2C5F2D] uppercase tracking-wider block">
                        {isCustom ? 'Ingredients Used:' : 'Rescues Expiring Items:'}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {recipe.usedExpiringItems.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-white text-[#2C5F2D] rounded-md text-[11px] font-bold border border-[#6B9B4F]/40 shadow-2xs"
                          >
                            ✓ {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="p-4 pt-0 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedRecipe(recipe)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View Recipe</span>
                  </button>

                  <button
                    onClick={() => handleCookedRecipe(recipe)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold shadow-md shadow-[#2C5F2D]/20 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isCustom ? 'Cook Again & Save' : 'I Cooked This!'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-8 border border-[#E2E8DE] text-center max-w-md mx-auto my-6 space-y-4">
          <UtensilsCrossed className="w-12 h-12 text-[#2C5F2D]/60 mx-auto" />
          <div>
            <h3 className="font-extrabold text-stone-800 text-sm">
              {recipeTab === 'custom'
                ? 'No custom recipes created yet'
                : 'No recipes match your criteria'}
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              {recipeTab === 'custom'
                ? 'Invented or cooked your own dish? Click below to save your recipe and deduct ingredients.'
                : 'Try switching the diet filter or clear the search keyword.'}
            </p>
          </div>

          {recipeTab === 'custom' ? (
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="px-5 py-2.5 bg-[#2C5F2D] text-white text-xs font-bold rounded-2xl shadow-md hover:bg-[#204721] cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cook My Own Recipe Now</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchFilter('');
                setRecipeTab('all');
              }}
              className="px-4 py-2 bg-[#2C5F2D] text-white text-xs font-bold rounded-xl"
            >
              Show All Recipes
            </button>
          )}
        </div>
      )}

      {/* Recipe Detail Full Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E2E8DE] flex flex-col max-h-[90vh] overflow-hidden">
            <div className="relative aspect-video bg-stone-900 shrink-0">
              <img
                src={selectedRecipe.image}
                alt={selectedRecipe.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
              >
                ✕
              </button>
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <div className="flex items-center gap-2">
                  {selectedRecipe.source === 'custom' && (
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      👨‍🍳 My Custom Recipe
                    </span>
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2C5F2D] text-white">
                    {selectedRecipe.cuisine} &bull; {selectedRecipe.timeMinutes}m
                  </span>
                </div>
                <h3 className="text-lg font-extrabold mt-1">{selectedRecipe.title}</h3>
                {selectedRecipe.cookedCount !== undefined && selectedRecipe.cookedCount > 0 && (
                  <p className="text-[11px] text-emerald-200 font-semibold mt-0.5">
                    Cooked {selectedRecipe.cookedCount} time{selectedRecipe.cookedCount > 1 ? 's' : ''} in your kitchen
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <p className="text-stone-600 leading-relaxed">{selectedRecipe.description}</p>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-2">Ingredients Needed</h4>
                <div className="space-y-1.5 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  {selectedRecipe.allIngredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-stone-200/60 last:border-none"
                    >
                      <span className="font-medium text-stone-800 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#2C5F2D]" />
                        {ing.name}
                      </span>
                      {ing.amount && <span className="text-stone-500 font-semibold">{ing.amount}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-2">Step-by-Step Instructions</h4>
                <ol className="space-y-2 list-decimal list-inside text-stone-700">
                  {selectedRecipe.instructions.map((step, idx) => (
                    <li key={idx} className="leading-relaxed pl-1">
                      <span className="font-medium">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8DE] bg-[#F7F8F4] flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedRecipe(null)}
                className="px-4 py-2 text-stone-600 text-xs font-semibold hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={() => {
                  handleCookedRecipe(selectedRecipe);
                  setSelectedRecipe(null);
                }}
                className="px-5 py-2.5 bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold rounded-xl shadow-md shadow-[#2C5F2D]/20 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {selectedRecipe.source === 'custom'
                    ? 'Cook Again & Deduct Pantry'
                    : 'I Cooked This! (Mark in DB)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Custom Recipe Creator Modal */}
      <CustomRecipeModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSuccess={(msg) => setCookedSuccessMessage(msg)}
      />
    </div>
  );
};

