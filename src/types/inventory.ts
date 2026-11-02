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
  usedAt?: string | null;
  source: 'barcode' | 'receipt' | 'manual';
  barcode?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeIngredient {
  name: string;
  amount: string;
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
  source?: 'gemini' | 'local';
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
