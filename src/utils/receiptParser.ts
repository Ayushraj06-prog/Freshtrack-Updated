/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReceiptParsedItem, ItemCategory } from '../types/inventory';
import { estimateShelfLife } from '../data/shelfLifeData';

export interface SampleReceipt {
  id: string;
  name: string;
  source: string;
  text: string;
  expectedItemCount: number;
}

export const SAMPLE_INDIAN_RECEIPTS: SampleReceipt[] = [
  {
    id: 'blinkit-01',
    name: 'Blinkit Instant Delivery',
    source: 'Blinkit',
    expectedItemCount: 4,
    text: `BLINKIT COMMERCE PVT LTD
Order #BLNK-9823124  Date: 12-OCT-2024
--------------------------------------
Amul Taaza Toned Milk 500ml      1x  27.00
Mother Dairy Classic Curd 400g   1x  35.00
Fresh Coriander (Dhaniya) 100g   1x  15.00
Britannia Brown Bread 400g       1x  50.00
--------------------------------------
Subtotal: Rs 127.00
Platform Handling Fee: Rs 5.00
Delivery Charge: Rs 15.00
CGST 2.5%: Rs 3.17
SGST 2.5%: Rs 3.17
Total Paid: Rs 150.34
Payment: UPI / PhonePe
Thank you for ordering on Blinkit!`,
  },
  {
    id: 'dmart-02',
    name: 'DMart Ready Supermarket',
    source: 'DMart',
    expectedItemCount: 5,
    text: `AVENUE SUPERMARTS LTD - DMART
Store: Powai Hiranandani Mumbai
GSTIN: 27AABCA1234D1Z9
Bill No: DM-88912   Time: 18:42
----------------------------------------
ITEM                      QTY   RATE   AMT
----------------------------------------
Aashirvaad Atta 5kg       1    235.00 235.00
Tata Salt 1kg             1     26.00  26.00
Fortune Sunlite Oil 1L    1    142.00 142.00
Toor Dal Premium 1kg      1    165.00 165.00
Amul Butter 100g          1     56.00  56.00
----------------------------------------
TOTAL ITEMS: 5
TAXABLE VALUE: Rs 595.24
CGST 2.5%: Rs 14.88
SGST 2.5%: Rs 14.88
TOTAL AMOUNT: Rs 624.00
Savings in this bill: Rs 78.00
THANK YOU VISIT AGAIN`,
  },
  {
    id: 'zepto-03',
    name: 'Zepto 10-Min Grocery',
    source: 'Zepto',
    expectedItemCount: 4,
    text: `ZEPTO - KiranaKart Technologies
Invoice: ZEP-492019
Items:
1. Farm Fresh Eggs (Pack of 6)    1pc   Rs 55.00
2. Fresh Palak (Spinach) 250g    1pc   Rs 22.00
3. Hybrid Tomato 1kg             1kg   Rs 38.00
4. Amul Malai Paneer 200g        1pc   Rs 85.00
Subtotal: 200.00
Handling: 4.00
GST included
Total: 204.00`,
  },
  {
    id: 'reliance-04',
    name: 'Reliance Smart Bazaar',
    source: 'Reliance Smart',
    expectedItemCount: 4,
    text: `RELIANCE RETAIL LIMITED
SMART BAZAAR INDIRANAGAR
CIN: U01100MH1999PLC120563
HSN/SAC   DESC           QTY    PRICE  TOTAL
0401      AMUL T-SPECIAL  2 PCS  32.00  64.00
0702      RED ONIONS      2 KG   35.00  70.00
0701      POTATO AGRA     2 KG   28.00  56.00
1905      PARLE-G GOLD    1 PKT  30.00  30.00
TAX INVOICE TOTAL: Rs 220.00
CGST 0%: 0.00
ROUND OFF: 0.00
NET PAYABLE: Rs 220.00
Points Earned: 11`,
  },
  {
    id: 'kirana-05',
    name: 'Gupta General Kirana Store',
    source: 'Local Kirana',
    expectedItemCount: 4,
    text: `GUPTA GENERAL STORE
Daily Cash Memo
Dahi Mother Dairy - 35
Adrak Garlic Paste - 25
Chana Dal 500g - 60
Maggi 4 pack - 56
Kul Jod (Total) = 176
Cash Received. Dhanyawad!`,
  },
];

export class ReceiptParser {
  private static IGNORE_PATTERNS = [
    /\b(subtotal|sub-total|grand\s*total|net\s*amount|total\s*paid|total\s*amount|total)\b/i,
    /\b(tax|gst|cgst|sgst|igst|vat|cess|hsn|sac|cin|fssai|gstin)\b/i,
    /\b(platform\s*fee|delivery\s*charge|handling\s*fee|service\s*charge|tip|convenience\s*fee)\b/i,
    /\b(upi|cash|card|visa|mastercard|paytm|phonepe|gpay|payment|change\s*due)\b/i,
    /\b(invoice|bill\s*no|order\s*#|receipt|date|time|counter|cashier|store|branch)\b/i,
    /\b(thank\s*you|visit\s*again|savings|points\s*earned|cash\s*memo|dhanyawad)\b/i,
    /^[-=_*#\s]+$/,
  ];

  public static parse(rawText: string): { items: ReceiptParsedItem[]; rawText: string } {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const results: ReceiptParsedItem[] = [];

    for (const line of lines) {
      if (this.shouldIgnore(line)) continue;

      const parsed = this.extractLineItem(line);
      if (parsed) {
        results.push(parsed);
      }
    }

    return { items: results, rawText };
  }

  private static shouldIgnore(line: string): boolean {
    if (line.length < 3) return true;
    for (const pattern of this.IGNORE_PATTERNS) {
      if (pattern.test(line)) return true;
    }
    return false;
  }

  private static extractLineItem(line: string): ReceiptParsedItem | null {
    // Clean leading numbers (e.g. "1. Farm Fresh Eggs")
    let cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();

    // Extract price from end of line (e.g. "27.00" or "Rs 35" or "- 35")
    const priceMatch = cleaned.match(/(?:rs\.?|inr|₹|[-=])?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*$/i);
    let price: number | null = null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
      cleaned = cleaned.slice(0, priceMatch.index).trim();
    }

    // Extract quantity and unit (e.g. "1x", "2kg", "500ml", "250g", "2 PCS", "1 PKT")
    let quantity = 1;
    let unit = 'pack';

    const qtyUnitMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs|pkt|pack|bunch|x)\b/i);
    if (qtyUnitMatch) {
      quantity = parseFloat(qtyUnitMatch[1]);
      const matchedUnit = qtyUnitMatch[2].toLowerCase();
      unit = matchedUnit === 'x' ? 'pack' : matchedUnit;
    }

    // Clean remaining product name
    const name = cleaned
      .replace(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs|pkt|pack|bunch|x)\b/gi, '')
      .replace(/[-:]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name || name.length < 2) return null;

    const shelf = estimateShelfLife(name);

    return {
      id: `parsed-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name,
      category: shelf.category,
      quantity,
      unit,
      price: price && !isNaN(price) ? price : null,
      estimatedExpiryDays: shelf.days,
      storage: shelf.storage,
      selected: true,
      originalText: line,
    };
  }
}

export function runReceiptParserTests() {
  const results = SAMPLE_INDIAN_RECEIPTS.map((receipt) => {
    const parsed = ReceiptParser.parse(receipt.text);
    const passed = parsed.items.length >= Math.max(2, receipt.expectedItemCount - 1);
    return {
      receiptId: receipt.id,
      receiptName: receipt.name,
      expected: receipt.expectedItemCount,
      parsedCount: parsed.items.length,
      passed,
      sampleParsedItems: parsed.items.map((i) => `${i.name} (₹${i.price || 'N/A'})`),
    };
  });

  return {
    allPassed: results.every((r) => r.passed),
    results,
  };
}
