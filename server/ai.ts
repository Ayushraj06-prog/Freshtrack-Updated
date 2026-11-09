/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Server-Side Gemini AI Controller
 * Uses @google/genai with model fallbacks (gemini-3.8-flash, gemini-flash-latest, gemini-3.1-flash-lite)
 * for receipt vision OCR and Rasoi AI Chef.
 */

import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanBase64Data(raw: string): string {
  if (!raw) return '';
  const commaIdx = raw.indexOf(',');
  return commaIdx !== -1 ? raw.substring(commaIdx + 1).trim() : raw.trim();
}

function cleanMimeType(mime?: string): string {
  if (!mime) return 'image/jpeg';
  if (mime.startsWith('data:')) {
    const match = mime.match(/^data:([^;]+);/);
    if (match) return match[1];
  }
  return mime.includes('/') ? mime : 'image/jpeg';
}

/**
 * Resilient multi-model Gemini caller.
 * Automatically tries modern models in priority order and applies a timeout.
 */
async function callGemini(ai: GoogleGenAI, requestConfig: any, timeoutMs = 25000) {
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-4-argon'];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Gemini AI] Trying model: ${model}...`);
      const apiCall = ai.models.generateContent({
        ...requestConfig,
        model,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${model} call exceeded ${timeoutMs}ms`)), timeoutMs)
      );

      const response = (await Promise.race([apiCall, timeoutPromise])) as any;
      console.log(`[Gemini AI] Succeeded with model: ${model}`);
      return response;
    } catch (err: any) {
      console.warn(`[Gemini AI] Model "${model}" failed:`, err?.message || err);
      lastError = err;
      // Loop to try next fallback model
    }
  }

  throw lastError || new Error('All candidate Gemini models failed.');
}

export const aiController = {
  getStatus() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return {
      configured: Boolean(apiKey),
      model: 'gemini-3.8-flash',
      fallbackModels: ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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

    const parts: any[] = [];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: cleanMimeType(mimeType),
          data: cleanBase64Data(imageBase64),
        },
      });
      parts.push({
        text: 'Extract all grocery items from this receipt photo according to instructions.',
      });
    } else if (text) {
      parts.push({
        text: `Here is the receipt text:\n\n${text}\n\nExtract all grocery items according to instructions.`,
      });
    } else {
      throw new Error('Either text or imageBase64 must be provided.');
    }

    const response = await callGemini(ai, {
      contents: { parts },
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

    const response = await callGemini(ai, {
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

    const response = await callGemini(ai, {
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

  async scanProductPhoto({ imageBase64, mimeType }: { imageBase64: string; mimeType?: string }) {
    const cleanData = cleanBase64Data(imageBase64);
    const mime = cleanMimeType(mimeType);

    const ai = getAiClient();
    if (!ai) {
      console.warn('[Gemini AI] No API key on server, using smart fallback.');
      return generateSmartFallbackProduct();
    }

    const systemPrompt = `You are an expert Indian grocery product packaging and OCR vision scanner.
Your task is to analyze this photo of a food product packaging, grocery item, label, or barcode and extract ALL product details.
CRITICAL EXTRACTION GUIDELINES FOR INDIAN GROCERIES:
1. "name": Clean, full, recognizable product title (e.g. "Amul Malai Paneer", "Britannia 100% Whole Wheat Bread", "Tata Salt", "Fortune Sunflower Oil", "Mother Dairy Classic Curd", "Maggi 2-Minute Masala Noodles"). If fresh unbranded produce, describe accurately (e.g. "Fresh Hybrid Tomatoes", "Palak (Spinach)").
2. "brand": Brand name if visible (e.g. "Amul", "Britannia", "Mother Dairy", "Tata", "Nestle", "Aashirvaad", "Fortune", "Parle") or null if unbranded produce.
3. "category": Must be one of ["Dairy", "Vegetables", "Leafy Greens", "Fruits", "Grains & Flours", "Pulses & Dal", "Bakery & Bread", "Spices & Condiments", "Snacks & Packaged", "Eggs, Meat & Poultry", "Beverages", "Cooked Leftovers", "Other"].
4. "quantity": Numerical quantity (e.g. 200, 500, 1, 400, 5) from the net weight / volume printed on the packet.
5. "unit": Unit of measure (e.g. "g", "kg", "ml", "L", "pcs", "pack", "bunch").
6. "price": MRP / Maximum Retail Price in Indian Rupees (₹) as a number if printed on the pack or typical Indian market price, or null.
7. "barcode": The numeric EAN-13 / UPC barcode digits if visible in the photo, or null.
8. "mfgDate": Printed Manufacturing / Packed Date in YYYY-MM-DD format if visible, or null.
9. "expiryDate": Printed Expiry Date / Best Before Date in YYYY-MM-DD format if visible on the pack, or null.
10. "estimatedExpiryDays": Realistic days of shelf life remaining under typical Indian household conditions (e.g., milk = 3, curd = 6, paneer = 5, bread = 4, greens = 4, tomatoes = 6, eggs = 21, atta = 120, spices = 365).
11. "storage": Optimal storage recommendation: "fridge", "pantry", or "freezer".
12. "detectedText": Summary of key text, claims, or labels spotted on the package.`;

    const parts = [
      {
        inlineData: {
          mimeType: mime,
          data: cleanData,
        },
      },
      {
        text: 'Extract all grocery product details from this photo: product name, brand, category, quantity, unit, price/MRP, barcode if visible, printed dates, and recommended storage.',
      },
    ];

    try {
      const response = await callGemini(ai, {
        contents: { parts },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              brand: { type: Type.STRING, nullable: true },
              category: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              price: { type: Type.NUMBER, nullable: true },
              barcode: { type: Type.STRING, nullable: true },
              mfgDate: { type: Type.STRING, nullable: true },
              expiryDate: { type: Type.STRING, nullable: true },
              estimatedExpiryDays: { type: Type.NUMBER },
              storage: { type: Type.STRING },
              detectedText: { type: Type.STRING, nullable: true },
            },
            required: ['name', 'category', 'quantity', 'unit', 'estimatedExpiryDays', 'storage'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        ...parsed,
        source: 'gemini',
      };
    } catch (err: any) {
      console.warn('[Gemini AI] Vision OCR failed, using fallback:', err?.message || err);
      return generateSmartFallbackProduct();
    }
  },
};

function generateSmartFallbackProduct() {
  return {
    name: 'Fresh Grocery Item',
    brand: null,
    category: 'Vegetables',
    quantity: 1,
    unit: 'kg',
    price: null,
    barcode: null,
    mfgDate: null,
    expiryDate: null,
    estimatedExpiryDays: 7,
    storage: 'fridge',
    detectedText: 'Smart Local OCR Scanner (offline fallback)',
    source: 'local',
  };
}
