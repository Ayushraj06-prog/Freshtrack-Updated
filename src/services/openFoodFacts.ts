/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ItemCategory, StorageLocation } from '../types/inventory';
import { estimateShelfLife } from '../data/shelfLifeData';

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  category: ItemCategory;
  quantity?: number;
  unit?: string;
  price: number;
  estimatedExpiryDays: number;
  storage: StorageLocation;
  imageUrl?: string;
  found: boolean;
}

export const POPULAR_INDIAN_BARCODES: BarcodeProduct[] = [
  {
    barcode: '8901262010046',
    name: 'Amul Butter 100g',
    brand: 'Amul',
    category: 'Dairy',
    quantity: 100,
    unit: 'g',
    price: 56,
    estimatedExpiryDays: 30,
    storage: 'fridge',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901030383786',
    name: 'Mother Dairy Classic Dahi 400g',
    brand: 'Mother Dairy',
    category: 'Dairy',
    quantity: 400,
    unit: 'g',
    price: 35,
    estimatedExpiryDays: 6,
    storage: 'fridge',
    imageUrl: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901058852448',
    name: 'Britannia 100% Whole Wheat Bread 400g',
    brand: 'Britannia',
    category: 'Bakery & Bread',
    quantity: 400,
    unit: 'g',
    price: 50,
    estimatedExpiryDays: 4,
    storage: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901058852332',
    name: 'Amul Malai Paneer 200g',
    brand: 'Amul',
    category: 'Dairy',
    quantity: 200,
    unit: 'g',
    price: 85,
    estimatedExpiryDays: 5,
    storage: 'fridge',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901063012110',
    name: 'Parle-G Original Glucose Biscuits',
    brand: 'Parle',
    category: 'Snacks & Packaged',
    quantity: 250,
    unit: 'g',
    price: 30,
    estimatedExpiryDays: 90,
    storage: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901058863116',
    name: 'Maggi 2-Minute Masala Noodles 280g',
    brand: 'Nestle',
    category: 'Snacks & Packaged',
    quantity: 4,
    unit: 'pack',
    price: 56,
    estimatedExpiryDays: 180,
    storage: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901058847291',
    name: 'Tata Salt Vacuum Evaporated 1kg',
    brand: 'Tata',
    category: 'Spices & Condiments',
    quantity: 1,
    unit: 'kg',
    price: 28,
    estimatedExpiryDays: 365,
    storage: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=300&q=80',
    found: true,
  },
  {
    barcode: '8901058849202',
    name: 'Aashirvaad Superior MP Shudh Chakki Atta 5kg',
    brand: 'Aashirvaad',
    category: 'Grains & Flours',
    quantity: 5,
    unit: 'kg',
    price: 245,
    estimatedExpiryDays: 120,
    storage: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80',
    found: true,
  },
];

export async function fetchFromOpenFoodFacts(barcode: string): Promise<BarcodeProduct> {
  const cleanCode = barcode.trim();

  // First check fast local catalog
  const match = POPULAR_INDIAN_BARCODES.find((p) => p.barcode === cleanCode);
  if (match) {
    return { ...match };
  }

  // Next, query Open Food Facts API
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${cleanCode}.json`, {
      headers: { 'User-Agent': 'FreshTrack - Zero Waste Kitchen App' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const name = p.product_name_en || p.product_name || `Product (${cleanCode})`;
        const brand = p.brands || '';
        const fullName = brand ? `${brand} ${name}` : name;
        const shelf = estimateShelfLife(fullName);

        return {
          barcode: cleanCode,
          name: fullName,
          brand,
          category: shelf.category,
          quantity: 1,
          unit: 'pack',
          price: 50,
          estimatedExpiryDays: shelf.days,
          storage: shelf.storage,
          imageUrl: p.image_front_small_url || p.image_url,
          found: true,
        };
      }
    }
  } catch (err) {
    console.warn('Open Food Facts API error:', err);
  }

  // Not found in Open Food Facts
  const fallbackShelf = estimateShelfLife(`Item ${cleanCode}`);
  return {
    barcode: cleanCode,
    name: `Grocery Item (${cleanCode})`,
    category: fallbackShelf.category,
    price: 40,
    estimatedExpiryDays: fallbackShelf.days,
    storage: fallbackShelf.storage,
    found: false,
  };
}
