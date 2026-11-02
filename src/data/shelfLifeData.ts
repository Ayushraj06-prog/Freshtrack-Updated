/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ItemCategory, StorageLocation } from '../types/inventory';

export interface ShelfLifeRule {
  category: ItemCategory;
  defaultStorage: StorageLocation;
  fridgeDays: number;
  pantryDays: number;
  freezerDays: number;
  keywords: string[];
}

export const SHELF_LIFE_DATABASE: ShelfLifeRule[] = [
  {
    category: 'Dairy',
    defaultStorage: 'fridge',
    fridgeDays: 4,
    pantryDays: 1,
    freezerDays: 30,
    keywords: ['milk', 'dahi', 'curd', 'paneer', 'butter', 'cheese', 'ghee', 'cream', 'malai', 'chaas', 'buttermilk', 'lassi'],
  },
  {
    category: 'Leafy Greens',
    defaultStorage: 'fridge',
    fridgeDays: 4,
    pantryDays: 1,
    freezerDays: 14,
    keywords: ['palak', 'spinach', 'coriander', 'dhaniya', 'methi', 'fenugreek', 'pudina', 'mint', 'curry leaves', 'kadi patta', 'sarson'],
  },
  {
    category: 'Vegetables',
    defaultStorage: 'fridge',
    fridgeDays: 7,
    pantryDays: 4,
    freezerDays: 60,
    keywords: ['tomato', 'tamatar', 'onion', 'pyaz', 'potato', 'aloo', 'bhindi', 'okra', 'shimla mirch', 'capsicum', 'gobi', 'cauliflower', 'cabbage', 'patta gobi', 'baingan', 'brinjal', 'lauki', 'bottle gourd', 'karela', 'cucumber', 'kheera', 'carrot', 'gajar', 'beans', 'matar', 'peas', 'ginger', 'adrak', 'garlic', 'lehsun', 'chilli', 'mirchi'],
  },
  {
    category: 'Fruits',
    defaultStorage: 'fridge',
    fridgeDays: 6,
    pantryDays: 3,
    freezerDays: 60,
    keywords: ['apple', 'seb', 'banana', 'kela', 'mango', 'aam', 'papaya', 'papita', 'orange', 'santra', 'grapes', 'angoor', 'pomegranate', 'anar', 'guava', 'amrood', 'lemon', 'nimbu', 'watermelon', 'tarbooj'],
  },
  {
    category: 'Bakery & Bread',
    defaultStorage: 'pantry',
    fridgeDays: 7,
    pantryDays: 4,
    freezerDays: 60,
    keywords: ['bread', 'pav', 'bun', 'roti', 'tortilla', 'rusk', 'toast', 'croissant', 'pita', 'bagel'],
  },
  {
    category: 'Cooked Leftovers',
    defaultStorage: 'fridge',
    fridgeDays: 3,
    pantryDays: 1,
    freezerDays: 30,
    keywords: ['leftover', 'curry', 'sabzi', 'sabji', 'dal', 'rice', 'chawal', 'khichdi', 'biryani', 'cooked', 'gravy', 'rasam', 'sambar'],
  },
  {
    category: 'Eggs, Meat & Poultry',
    defaultStorage: 'fridge',
    fridgeDays: 14,
    pantryDays: 1,
    freezerDays: 90,
    keywords: ['egg', 'anda', 'chicken', 'mutton', 'fish', 'machhli', 'prawn', 'keema'],
  },
  {
    category: 'Pulses & Dal',
    defaultStorage: 'pantry',
    fridgeDays: 365,
    pantryDays: 180,
    freezerDays: 365,
    keywords: ['toor', 'tur', 'moong', 'masoor', 'chana', 'urad', 'rajma', 'choole', 'chole', 'dal', 'lentil', 'besan'],
  },
  {
    category: 'Grains & Flours',
    defaultStorage: 'pantry',
    fridgeDays: 365,
    pantryDays: 120,
    freezerDays: 365,
    keywords: ['atta', 'rice', 'chawal', 'wheat', 'maida', 'suji', 'rava', 'poha', 'vermicelli', 'sewai', 'oats', 'quinoa', 'millet', 'ragi', 'jowar', 'bajra'],
  },
  {
    category: 'Spices & Condiments',
    defaultStorage: 'pantry',
    fridgeDays: 180,
    pantryDays: 180,
    freezerDays: 365,
    keywords: ['haldi', 'turmeric', 'mirch', 'jeera', 'cumin', 'garam masala', 'mustard', 'rai', 'hing', 'asafoetida', 'pickle', 'achar', 'chutney', 'ketchup', 'sauce', 'oil', 'tel', 'ghee'],
  },
  {
    category: 'Snacks & Packaged',
    defaultStorage: 'pantry',
    fridgeDays: 90,
    pantryDays: 60,
    freezerDays: 180,
    keywords: ['biscuit', 'maggi', 'noodle', 'namkeen', 'chips', 'bhujia', 'snack', 'pasta'],
  },
  {
    category: 'Beverages',
    defaultStorage: 'fridge',
    fridgeDays: 14,
    pantryDays: 30,
    freezerDays: 90,
    keywords: ['juice', 'tea', 'chai', 'coffee', 'squash', 'syrup', 'roohafza'],
  },
  {
    category: 'Other',
    defaultStorage: 'pantry',
    fridgeDays: 14,
    pantryDays: 14,
    freezerDays: 60,
    keywords: [],
  },
];

export function estimateShelfLife(
  itemName: string,
  categoryHint?: ItemCategory,
  storage: StorageLocation = 'fridge'
): { days: number; category: ItemCategory; storage: StorageLocation } {
  const lowerName = itemName.toLowerCase();

  // Special item-specific overrides for Indian kitchens
  if (lowerName.includes('milk') || lowerName.includes('doodh')) {
    return { days: storage === 'fridge' ? 3 : 1, category: 'Dairy', storage };
  }
  if (lowerName.includes('paneer')) {
    return { days: storage === 'fridge' ? 5 : 1, category: 'Dairy', storage };
  }
  if (lowerName.includes('curd') || lowerName.includes('dahi')) {
    return { days: storage === 'fridge' ? 6 : 1, category: 'Dairy', storage };
  }
  if (lowerName.includes('dhaniya') || lowerName.includes('coriander') || lowerName.includes('mint') || lowerName.includes('pudina')) {
    return { days: storage === 'fridge' ? 4 : 1, category: 'Leafy Greens', storage };
  }
  if (lowerName.includes('palak') || lowerName.includes('spinach') || lowerName.includes('methi')) {
    return { days: storage === 'fridge' ? 4 : 1, category: 'Leafy Greens', storage };
  }
  if (lowerName.includes('bread') || lowerName.includes('pav')) {
    return { days: storage === 'fridge' ? 7 : 4, category: 'Bakery & Bread', storage: 'pantry' };
  }
  if (lowerName.includes('tomato') || lowerName.includes('tamatar')) {
    return { days: storage === 'fridge' ? 6 : 3, category: 'Vegetables', storage };
  }
  if (lowerName.includes('onion') || lowerName.includes('pyaz')) {
    return { days: storage === 'pantry' ? 21 : 14, category: 'Vegetables', storage: 'pantry' };
  }
  if (lowerName.includes('potato') || lowerName.includes('aloo')) {
    return { days: storage === 'pantry' ? 30 : 14, category: 'Vegetables', storage: 'pantry' };
  }
  if (lowerName.includes('egg') || lowerName.includes('anda')) {
    return { days: storage === 'fridge' ? 21 : 7, category: 'Eggs, Meat & Poultry', storage: 'fridge' };
  }

  // Find match by keyword
  for (const rule of SHELF_LIFE_DATABASE) {
    if (rule.keywords.some((k) => lowerName.includes(k))) {
      const days =
        storage === 'fridge'
          ? rule.fridgeDays
          : storage === 'pantry'
          ? rule.pantryDays
          : rule.freezerDays;
      return { days, category: rule.category, storage: rule.defaultStorage };
    }
  }

  // Fallback to category hint if provided
  if (categoryHint) {
    const rule = SHELF_LIFE_DATABASE.find((r) => r.category === categoryHint);
    if (rule) {
      const days =
        storage === 'fridge'
          ? rule.fridgeDays
          : storage === 'pantry'
          ? rule.pantryDays
          : rule.freezerDays;
      return { days, category: rule.category, storage: rule.defaultStorage };
    }
  }

  return { days: 7, category: 'Vegetables', storage: 'fridge' };
}

export function calculateExpiryDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.round(daysFromNow)));
  return d.toISOString().split('T')[0];
}

export function getRemainingDays(expiryDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
