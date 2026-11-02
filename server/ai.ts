/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Server-Side Gemini AI Controller
 * Uses @google/genai with gemini-2.5-flash for receipt OCR and Rasoi AI Chef.
 */

import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export const aiController = {
  getStatus() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return {
      configured: Boolean(apiKey),
      model: 'gemini-2.5-flash',
      engine: 'Google Gemini AI',
    };
  },

  async parseReceipt({ text, imageBase64, mimeType }: { text?: string; imageBase64?: string; mimeType?: string }) {
    const ai = getAiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured on the server.');
    }

    const systemPrompt = `You are an expert Indian grocery invoice & receipt parsing engine.
Your task is to extract individual food & grocery product items from this receipt.
CRITICAL RULES FOR INDIAN BILLS:
1. Ignore store header info, GST/CIN/FSSAI, cashiers, timestamps, addresses, divider lines, and thank-you notes.
2. Filter out taxes (CGST, SGST, IGST), platform fees, handling fees, tips, delivery charges, and total/grand-total lines.
3. For each extracted item:
   - "name": Clean readable name in English (e.g. "Amul Toned Milk", "Fresh Palak", "Mother Dairy Curd").
   - "category": One of ["Dairy", "Vegetables", "Leafy Greens", "Fruits", "Grains & Flours", "Pulses & Dal", "Bakery & Bread", "Spices & Condiments", "Snacks & Packaged", "Eggs, Meat & Poultry", "Beverages", "Cooked Leftovers", "Other"].
   - "quantity": Number (e.g. 500, 1, 2).
   - "unit": e.g. "ml", "g", "kg", "pcs", "bunch", "pack".
   - "price": Total line price in Indian Rupees (₹) as a number, or null if missing.
   - "estimatedExpiryDays": Realistic days before spoilage under typical Indian household conditions (e.g. fresh milk = 3, curd = 6, paneer = 5, coriander = 4, bread = 4, tomatoes = 6, atta = 120).
   - "storage": Recommended storage location: "fridge", "pantry", or "freezer".
Always return clean JSON containing an "items" array.`;

    const contents: any[] = [];

    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
        },
      });
      contents.push({
        text: 'Extract all grocery items from this receipt photo according to instructions.',
      });
    } else if (text) {
      contents.push({
        text: `Here is the receipt text:\n\n${text}\n\nExtract all grocery items according to instructions.`,
      });
    } else {
      throw new Error('Either text or imageBase64 must be provided.');
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  price: { type: Type.NUMBER, nullable: true },
                  estimatedExpiryDays: { type: Type.NUMBER },
                  storage: { type: Type.STRING },
                },
                required: ['name', 'category', 'quantity', 'unit', 'estimatedExpiryDays', 'storage'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return (parsed.items || []).map((it: any, idx: number) => ({
      ...it,
      id: `ai-parsed-${Date.now()}-${idx}`,
      selected: true,
      originalText: it.name,
    }));
  },

  async suggestRecipes({
    expiringItems,
    allKitchenItems = [],
    diet = 'veg',
  }: {
    expiringItems: string[];
    allKitchenItems?: string[];
    diet?: string;
  }) {
    const ai = getAiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured on the server.');
    }

    const prompt = `You are a warm, resourceful Indian home chef ("Rasoi AI Chef").
Help an Indian household prevent food waste by inventing 3 creative, authentic, homestyle Indian recipes specifically rescuing these expiring ingredients:
Expiring Items: ${expiringItems.join(', ')}
Other items available in the kitchen: ${allKitchenItems.join(', ')}
Household Diet Preference: ${diet} (Strictly respect this: if veg, do not include eggs, meat, or poultry).

For each recipe, provide:
- id: unique string
- title: Traditional or clever Indian dish name (e.g. "Amchuri Aloo Chutney Toast", "Dahi Kadhi with Spinach Pakora")
- description: 1-2 sentence appetizing summary
- image: Pick an appropriate realistic Unsplash food photo URL
- timeMinutes: number (10 to 35)
- servings: number
- difficulty: "Quick" | "Easy" | "Medium"
- diet: "${diet}"
- cuisine: Indian region (e.g. "North Indian", "South Indian", "Gujarati", "Homestyle Street Food")
- usedExpiringItems: array of ingredient names it successfully rescues
- allIngredients: array of { name: string, amount: string }
- instructions: array of 4-6 numbered step-by-step cooking steps`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  image: { type: Type.STRING },
                  timeMinutes: { type: Type.NUMBER },
                  servings: { type: Type.NUMBER },
                  difficulty: { type: Type.STRING },
                  diet: { type: Type.STRING },
                  cuisine: { type: Type.STRING },
                  usedExpiringItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                  allIngredients: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        amount: { type: Type.STRING },
                      },
                      required: ['name', 'amount'],
                    },
                  },
                  instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'id',
                  'title',
                  'description',
                  'image',
                  'timeMinutes',
                  'servings',
                  'difficulty',
                  'diet',
                  'cuisine',
                  'usedExpiringItems',
                  'allIngredients',
                  'instructions',
                ],
              },
            },
          },
          required: ['recipes'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return (parsed.recipes || []).map((r: any) => ({
      ...r,
      source: 'gemini',
    }));
  },

  async estimateShelfLife({ itemName, category, storage = 'fridge' }: { itemName: string; category?: string; storage?: string }) {
    const ai = getAiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured on the server.');
    }

    const prompt = `For the Indian food item "${itemName}" (category: "${category || 'General'}", storage: "${storage}"), calculate the realistic shelf life in days under typical Indian household conditions (taking into account tropical temperature and humidity).
Provide:
- days: integer number of days
- storageRecommendation: best storage tips
- rationale: short explanation`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            days: { type: Type.NUMBER },
            storageRecommendation: { type: Type.STRING },
            rationale: { type: Type.STRING },
          },
          required: ['days', 'storageRecommendation', 'rationale'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  },
};
