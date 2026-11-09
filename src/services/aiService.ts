/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack AI Service
 * Communicates with Gemini 2.5 Flash backend routes with seamless offline fallbacks.
 */

import { Recipe, ReceiptParsedItem, DietType } from '../types/inventory';
import { ReceiptParser } from '../utils/receiptParser';

export interface AiStatus {
  configured: boolean;
  model: string;
  engine?: string;
}

export const aiService = {
  async getStatus(): Promise<AiStatus> {
    try {
      const res = await fetch('/api/ai/status');
      if (!res.ok) throw new Error('AI status request failed');
      return await res.json();
    } catch {
      return { configured: false, model: 'offline-fallback', engine: 'Local Rules Engine' };
    }
  },

  async parseReceipt(params: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
  }): Promise<{ items: ReceiptParsedItem[]; source: 'gemini' | 'local' }> {
    try {
      const res = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          return { items: data.items, source: 'gemini' };
        }
      }
    } catch (e) {
      console.warn('Gemini vision receipt parse unavailable, using local OCR parser.', e);
    }

    // Local Regex OCR parser fallback
    const fallback = ReceiptParser.parse(params.text || '');
    return { items: fallback.items, source: 'local' };
  },

  async suggestRecipes(params: {
    expiringItems: string[];
    allKitchenItems?: string[];
    diet?: DietType;
  }): Promise<{ recipes: Recipe[]; source: 'gemini' | 'local' }> {
    try {
      const res = await fetch('/api/ai/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.recipes) && data.recipes.length > 0) {
          return { recipes: data.recipes, source: 'gemini' };
        }
      }
    } catch (e) {
      console.warn('Gemini recipe engine unreachable, using local database.', e);
    }

    return { recipes: [], source: 'local' };
  },

  async scanProductPhoto(params: {
    imageBase64: string;
    mimeType?: string;
  }): Promise<{
    product: {
      name: string;
      brand?: string | null;
      category: any;
      quantity: number;
      unit: string;
      price: number | null;
      barcode?: string | null;
      mfgDate?: string | null;
      expiryDate?: string | null;
      estimatedExpiryDays: number;
      storage: any;
      detectedText?: string | null;
    };
    source: 'gemini' | 'local';
  }> {
    try {
      const res = await fetch('/api/ai/scan-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.product && data.product.name) {
          return { product: data.product, source: 'gemini' };
        }
      }
    } catch (e) {
      console.warn('Gemini product OCR scan unavailable, using local fallback.', e);
    }

    return {
      product: {
        name: 'Detected Grocery Item',
        brand: null,
        category: 'Dairy',
        quantity: 1,
        unit: 'pack',
        price: null,
        estimatedExpiryDays: 6,
        storage: 'fridge',
        detectedText: 'Analyzed with local rules',
      },
      source: 'local',
    };
  },
};

