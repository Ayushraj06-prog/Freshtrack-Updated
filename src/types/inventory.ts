/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ItemCategory =
  | 'Dairy'
  | 'Vegetables'
  | 'Leafy Greens'
  | 'Fruits'
  | 'Grains & Flours'
  | 'Pulses & Dal'
  | 'Bakery & Bread'
  | 'Spices & Condiments'
  | 'Snacks & Packaged'
  | 'Eggs, Meat & Poultry'
  | 'Beverages'
  | 'Cooked Leftovers'
  | 'Other';

export type StorageLocation = 'fridge' | 'pantry' | 'freezer';

export type ItemStatus = 'active' | 'used' | 'expired';

export type DietType = 'veg' | 'egg' | 'non-veg';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: string;
  purchaseDate: string; // YYYY-MM-DD
  estimatedExpiryDate: string; // YYYY-MM-DD
  printedExpiryDate?: string | null;
  storage: StorageLocation;
  price: number | null; // In INR (₹)
  status: ItemStatus;
  originalQuantity?: number | null;
  savedMoney?: number | null;
  usedAt?: string | null;
  source: 'barcode' | 'receipt' | 'manual';
  barcode?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type PortionPreset = 'little' | 'half' | 'most' | 'all' | 'custom';

export interface UseItemPayload {
  portion?: number; // 0.25, 0.5, 0.75, 1.0 or custom 0..1
  usedQuantity?: number; // exact amount used
  usedPortionName?: string; // e.g. "A Little (25%)", "Half (50%)"
}

export interface RecipeIngredient {
  name: string;
  amount: string;
}

export interface CustomRecipeIngredient {
  itemId?: string; // ID of inventory item if chosen from pantry
  name: string;
  portionUsed?: number; // 0.25, 0.5, 0.75, 1.0
  quantityUsed?: number; // exact amount deducted
  unit?: string;
  amountText?: string;
  isPantryStaple?: boolean; // spices, salt, oil, etc.
}

export interface CustomRecipe {
  id: string;
  title: string;
  description: string;
  image?: string;
  timeMinutes: number;
  servings: number;
  difficulty: 'Quick' | 'Easy' | 'Medium';
  diet: DietType;
  cuisine: string;
  ingredients: CustomRecipeIngredient[];
  instructions: string[];
  notes?: string;
  cookedCount?: number;
  lastCookedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  source: 'custom';
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  image: string;
  timeMinutes: number;
  servings: number;
  difficulty: 'Quick' | 'Easy' | 'Medium';
  diet: DietType;
  cuisine: string;
  usedExpiringItems: string[];
  allIngredients: RecipeIngredient[];
  instructions: string[];
  source?: 'gemini' | 'local' | 'custom';
  cookedCount?: number;
  lastCookedAt?: string;
}

export interface UserPreferences {
  diet: DietType;
  reminderLeadDays: number; // 1 or 2
  morningDigestEnabled: boolean;
  morningDigestTime: string;
  defaultStorage: StorageLocation;
}

export interface InventoryStats {
  totalLogged: number;
  activeCount: number;
  usedCount: number;
  expiredCount: number;
  urgentCount: number; // Expiring in <= 2 days
  freshCount: number;
  moneySavedRs: number;
  moneyWastedRs: number;
  unpricedUsedCount: number;
  unpricedExpiredCount: number;
  savingPercentage: number;
  zeroWasteStreakDays: number;
  totalScansLogged: number;
}

export interface ReceiptParsedItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: string;
  price: number | null;
  estimatedExpiryDays: number;
  storage: StorageLocation;
  selected?: boolean;
  originalText?: string;
}

export interface DbInfo {
  engine: string;
  filePath: string;
  itemsCount: number;
  activeCount: number;
  usedCount: number;
  recipesCount?: number;
}
