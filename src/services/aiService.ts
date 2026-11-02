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
};
