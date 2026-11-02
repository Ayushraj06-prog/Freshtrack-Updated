/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Barcode,
  Receipt,
  PlusCircle,
  Camera,
  Upload,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Package,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateExpiryDate, estimateShelfLife, SHELF_LIFE_DATABASE } from '../data/shelfLifeData';
import { fetchFromOpenFoodFacts, POPULAR_INDIAN_BARCODES } from '../services/openFoodFacts';
import { aiService } from '../services/aiService';
import { ItemCategory, ReceiptParsedItem, StorageLocation } from '../types/inventory';
import { ReceiptParser, SAMPLE_INDIAN_RECEIPTS } from '../utils/receiptParser';

interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddItemsModal: React.FC<AddItemsModalProps> = ({ isOpen, onClose }) => {
  const { addItem, addMultipleItems } = useInventory();

  const [activeTab, setActiveTab] = useState<'barcode' | 'receipt' | 'manual'>('barcode');

  // Barcode State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<any | null>(null);
  const [barcodeError, setBarcodeError] = useState('');
  const [barcodePrice, setBarcodePrice] = useState<string>('');
  const [barcodeQty, setBarcodeQty] = useState('1');
  const [barcodeUnit, setBarcodeUnit] = useState('pack');
  const [barcodeStorage, setBarcodeStorage] = useState<StorageLocation>('fridge');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Receipt State
  const [receiptText, setReceiptText] = useState('');
  const [parsingAi, setParsingAi] = useState(false);
  const [parsedReviewItems, setParsedReviewItems] = useState<ReceiptParsedItem[]>([]);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Add State
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<ItemCategory>('Vegetables');
  const [manualStorage, setManualStorage] = useState<StorageLocation>('fridge');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('kg');
  const [manualPrice, setManualPrice] = useState('');
  const [manualDays, setManualDays] = useState(7);
  const [manualCustomDate, setManualCustomDate] = useState('');

  useEffect(() => {
    if (manualName.trim()) {
      const { days } = estimateShelfLife(manualName, manualCategory, manualStorage);
      setManualDays(days);
      setManualCustomDate(calculateExpiryDate(days));
    }
  }, [manualName, manualCategory, manualStorage]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraActive(true);
    setBarcodeError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e: any) {
      console.warn('Camera access denied or unavailable', e);
      setBarcodeError('Camera access unavailable in current view. You can select sample Indian barcodes or enter numbers manually.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleBarcodeLookup = async (codeToQuery?: string) => {
    const code = (codeToQuery || barcodeInput).trim();
    if (!code) {
      setBarcodeError('Please provide a barcode number.');
      return;
    }

    setBarcodeLoading(true);
    setBarcodeError('');
    setBarcodeResult(null);

    try {
      const result = await fetchFromOpenFoodFacts(code);
      setBarcodeResult(result);
      if (result.found) {
        setBarcodeStorage(result.storage);
        const preset = POPULAR_INDIAN_BARCODES.find((p) => p.barcode === code);
        if (preset) {
          setBarcodePrice(preset.price.toString());
        }
      } else {
        setBarcodeError(`Product not in quick catalog for ${code}. You can customize details below.`);
      }
    } catch {
      setBarcodeError('Unable to connect to barcode service.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleSaveBarcodeItem = async () => {
    if (!barcodeResult || !barcodeResult.name) return;

    const expiryDate = calculateExpiryDate(barcodeResult.estimatedExpiryDays || 7);
    const priceNum = barcodePrice ? parseFloat(barcodePrice) : null;
    const qtyNum = parseFloat(barcodeQty) || 1;

    await addItem({
      name: barcodeResult.name,
      category: barcodeResult.category,
      storage: barcodeStorage,
      quantity: qtyNum,
      unit: barcodeUnit,
      price: priceNum,
      purchaseDate: new Date().toISOString().split('T')[0],
      estimatedExpiryDate: expiryDate,
      status: 'active',
      source: 'barcode',
      barcode: barcodeResult.barcode,
      imageUrl: barcodeResult.imageUrl,
    });

    onClose();
  };

  const handleParseReceipt = async () => {
    if (!receiptText.trim()) return;
    setParsingAi(true);

    try {
      const result = await aiService.parseReceipt({ text: receiptText });
      if (result.items.length === 0) {
        alert('Could not detect any product line items. Check receipt text or pick a sample receipt.');
        setParsingAi(false);
        return;
      }
      setParsedReviewItems(result.items);
      setShowReviewScreen(true);
    } catch {
      const fallback = ReceiptParser.parse(receiptText);
      setParsedReviewItems(fallback.items);
      setShowReviewScreen(true);
    } finally {
      setParsingAi(false);
    }
  };

  const handleReceiptImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setParsingAi(true);
      try {
        const result = await aiService.parseReceipt({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
        });
        setParsedReviewItems(result.items);
        setShowReviewScreen(true);
      } catch {
        const sample = SAMPLE_INDIAN_RECEIPTS[0];
        setReceiptText(sample.text);
        const parsed = ReceiptParser.parse(sample.text);
        setParsedReviewItems(parsed.items);
        setShowReviewScreen(true);
      } finally {
        setParsingAi(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAllReceiptItems = async () => {
    const selectedItems = parsedReviewItems.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      alert('Please select at least one item to save.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const toSave = selectedItems.map((item) => ({
      name: item.name,
      category: item.category,
      storage: item.storage,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      purchaseDate: todayStr,
      estimatedExpiryDate: calculateExpiryDate(item.estimatedExpiryDays),
      status: 'active' as const,
      source: 'receipt' as const,
    }));

    await addMultipleItems(toSave);
    onClose();
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const expiry = manualCustomDate || calculateExpiryDate(manualDays);
    const priceNum = manualPrice ? parseFloat(manualPrice) : null;
    const qtyNum = parseFloat(manualQty) || 1;

    await addItem({
      name: manualName.trim(),
      category: manualCategory,
      storage: manualStorage,
      quantity: qtyNum,
      unit: manualUnit,
      price: priceNum,
      purchaseDate: new Date().toISOString().split('T')[0],
      estimatedExpiryDate: expiry,
      status: 'active',
      source: 'manual',
    });

    onClose();
  };

  const QUICK_STAPLES = [
    { name: 'Milk Packet 500ml', cat: 'Dairy' as ItemCategory, unit: 'ml', qty: 500, days: 3, storage: 'fridge' as StorageLocation, price: 27 },
    { name: 'Fresh Curd (Dahi) 400g', cat: 'Dairy' as ItemCategory, unit: 'g', qty: 400, days: 6, storage: 'fridge' as StorageLocation, price: 35 },
    { name: 'Paneer 200g', cat: 'Dairy' as ItemCategory, unit: 'g', qty: 200, days: 5, storage: 'fridge' as StorageLocation, price: 85 },
    { name: 'Dhaniya (Coriander)', cat: 'Leafy Greens' as ItemCategory, unit: 'bunch', qty: 1, days: 4, storage: 'fridge' as StorageLocation, price: 15 },
    { name: 'Tomatoes 1kg', cat: 'Vegetables' as ItemCategory, unit: 'kg', qty: 1, days: 6, storage: 'fridge' as StorageLocation, price: 35 },
    { name: 'Onions 1kg', cat: 'Vegetables' as ItemCategory, unit: 'kg', qty: 1, days: 21, storage: 'pantry' as StorageLocation, price: 35 },
    { name: 'Brown Bread', cat: 'Bakery & Bread' as ItemCategory, unit: 'pack', qty: 1, days: 4, storage: 'pantry' as StorageLocation, price: 50 },
    { name: 'Eggs 6pcs', cat: 'Eggs, Meat & Poultry' as ItemCategory, unit: 'pcs', qty: 6, days: 25, storage: 'fridge' as StorageLocation, price: 55 },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-[#E2E8DE] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E2E8DE] flex items-center justify-between bg-[#F7F8F4]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2C5F2D] text-white flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">Add Kitchen Items</h3>
              <p className="text-[11px] text-stone-500 font-medium">Saves directly to SQLite backend database</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        {!showReviewScreen && (
          <div className="flex border-b border-[#E2E8DE] bg-white px-5 pt-2 gap-2 text-xs font-bold">
            <button
              onClick={() => {
                stopCamera();
                setActiveTab('barcode');
              }}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'barcode'
                  ? 'border-[#2C5F2D] text-[#2C5F2D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>Barcode Flow</span>
            </button>

            <button
              onClick={() => {
                stopCamera();
                setActiveTab('receipt');
              }}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'receipt'
                  ? 'border-[#2C5F2D] text-[#2C5F2D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Receipt OCR</span>
            </button>

            <button
              onClick={() => {
                stopCamera();
                setActiveTab('manual');
              }}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'manual'
                  ? 'border-[#2C5F2D] text-[#2C5F2D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Quick Manual</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* 1. BARCODE FLOW */}
          {activeTab === 'barcode' && !showReviewScreen && (
            <div className="space-y-4">
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-stone-800">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-dashed border-[#A3E635] rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white bg-black/60 px-2.5 py-1 rounded-full">
                      Align Barcode Here
                    </span>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 px-3 py-1 bg-black/70 hover:bg-black text-white text-xs font-semibold rounded-lg"
                  >
                    Close Camera
                  </button>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-[#6B9B4F]/40 hover:border-[#2C5F2D] bg-[#EAF3E6]/40 hover:bg-[#EAF3E6] flex items-center justify-center gap-2.5 text-xs font-bold text-[#2C5F2D] transition-all cursor-pointer"
                >
                  <Camera className="w-5 h-5 text-[#2C5F2D]" />
                  <span>Scan Barcode with Camera</span>
                </button>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700">Or enter Barcode Number (EAN / UPC)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="e.g. 8901262010046 (Amul Butter)"
                    className="flex-1 px-3.5 py-2 text-sm bg-white border border-[#E2E8DE] rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                  />
                  <button
                    onClick={() => handleBarcodeLookup()}
                    disabled={barcodeLoading}
                    className="px-4 py-2 bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {barcodeLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Lookup'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Test Indian Products (1-Tap):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {POPULAR_INDIAN_BARCODES.slice(0, 6).map((preset) => (
                    <button
                      key={preset.barcode}
                      onClick={() => {
                        setBarcodeInput(preset.barcode);
                        handleBarcodeLookup(preset.barcode);
                      }}
                      className="p-2 text-left bg-stone-50 hover:bg-[#EAF3E6] border border-[#E2E8DE] hover:border-[#6B9B4F] rounded-xl transition-all cursor-pointer text-xs"
                    >
                      <p className="font-bold text-stone-800 truncate">{preset.name}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">₹{preset.price} &bull; {preset.barcode}</p>
                    </button>
                  ))}
                </div>
              </div>

              {barcodeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{barcodeError}</p>
                </div>
              )}

              {barcodeResult && barcodeResult.found && (
                <div className="p-4 bg-[#F7F8F4] border border-[#6B9B4F]/40 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    {barcodeResult.imageUrl ? (
                      <img
                        src={barcodeResult.imageUrl}
                        alt={barcodeResult.name}
                        className="w-14 h-14 object-contain rounded-lg bg-white p-1 border border-stone-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-stone-200 flex items-center justify-center shrink-0">
                        <Package className="w-7 h-7 text-stone-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-[#2C5F2D] bg-[#EAF3E6] px-2 py-0.5 rounded-full">
                        {barcodeResult.category}
                      </span>
                      <h4 className="font-bold text-stone-900 text-sm mt-1">{barcodeResult.name}</h4>
                      <p className="text-xs text-stone-500">
                        Est. Shelf Life: ~{barcodeResult.estimatedExpiryDays} days
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={barcodeQty}
                        onChange={(e) => setBarcodeQty(e.target.value)}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Unit</label>
                      <input
                        type="text"
                        value={barcodeUnit}
                        onChange={(e) => setBarcodeUnit(e.target.value)}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Price (₹)</label>
                      <input
                        type="number"
                        placeholder="Optional"
                        value={barcodePrice}
                        onChange={(e) => setBarcodePrice(e.target.value)}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveBarcodeItem}
                    className="w-full py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm &amp; Save to Database</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. RECEIPT OCR FLOW */}
          {activeTab === 'receipt' && !showReviewScreen && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-dashed border-[#6B9B4F]/50 text-center space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleReceiptImageUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-[#EAF3E6] text-[#2C5F2D] mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-stone-800">Upload Grocery Bill or Receipt Photo</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Powered by Gemini Vision to extract items and clean up GST / store lines automatically.
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingAi}
                    className="px-4 py-2 bg-[#2C5F2D] text-white text-xs font-bold rounded-xl hover:bg-[#204721] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {parsingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    <span>{parsingAi ? 'Scanning Bill with Gemini...' : 'Choose Photo / Bill'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Or Test with Sample Indian Grocery Invoices:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_INDIAN_RECEIPTS.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => {
                        setReceiptText(sample.text);
                        const parsed = ReceiptParser.parse(sample.text);
                        setParsedReviewItems(parsed.items);
                        setShowReviewScreen(true);
                      }}
                      className="p-3 text-left bg-white hover:bg-[#F7F8F4] border border-[#E2E8DE] hover:border-[#2C5F2D] rounded-xl transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-stone-800">{sample.name}</span>
                        <span className="text-[10px] font-semibold text-[#2C5F2D] bg-[#EAF3E6] px-1.5 py-0.5 rounded">
                          {sample.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">
                        {sample.expectedItemCount} items &bull; Tests GST &amp; HSN filtering
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-stone-700">Or Paste Raw OCR / Bill Text</label>
                <textarea
                  value={receiptText}
                  onChange={(e) => setReceiptText(e.target.value)}
                  placeholder="Paste receipt lines here... (e.g. Amul Milk 500ml 27.00, Palak 15.00, TOTAL 42.00)"
                  rows={4}
                  className="w-full p-3 text-xs bg-white border border-[#E2E8DE] rounded-xl font-mono focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                />
                <button
                  onClick={handleParseReceipt}
                  disabled={!receiptText.trim() || parsingAi}
                  className="w-full py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {parsingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{parsingAi ? 'Parsing...' : 'Parse Items & Open Review Screen →'}</span>
                </button>
              </div>
            </div>
          )}

          {/* RECEIPT REVIEW SCREEN */}
          {showReviewScreen && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                <div>
                  <h4 className="font-bold text-amber-950">Receipt Correction &amp; Review</h4>
                  <p className="text-amber-800/80 text-[11px]">
                    Confirm extracted items, tweak categories or quantities, and save to SQLite database in one tap.
                  </p>
                </div>
                <button
                  onClick={() => setShowReviewScreen(false)}
                  className="text-stone-500 hover:text-stone-800 text-xs font-semibold underline cursor-pointer"
                >
                  Back
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {parsedReviewItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      item.selected ? 'bg-white border-[#E2E8DE]' : 'bg-stone-50 border-stone-200 opacity-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const updated = [...parsedReviewItems];
                          updated[index].selected = e.target.checked;
                          setParsedReviewItems(updated);
                        }}
                        className="mt-1 rounded text-[#2C5F2D] focus:ring-[#2C5F2D]"
                      />

                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const updated = [...parsedReviewItems];
                              updated[index].name = e.target.value;
                              setParsedReviewItems(updated);
                            }}
                            className="flex-1 font-bold text-stone-800 border-b border-stone-200 pb-0.5 focus:border-[#2C5F2D] focus:outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-stone-400">₹</span>
                            <input
                              type="number"
                              value={item.price ?? ''}
                              placeholder="Price"
                              onChange={(e) => {
                                const updated = [...parsedReviewItems];
                                updated[index].price = e.target.value ? parseFloat(e.target.value) : null;
                                setParsedReviewItems(updated);
                              }}
                              className="w-16 text-right font-bold text-stone-800 border-b border-stone-200 pb-0.5 focus:border-[#2C5F2D] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const updated = [...parsedReviewItems];
                              updated[index].category = e.target.value as ItemCategory;
                              setParsedReviewItems(updated);
                            }}
                            className="bg-stone-100 rounded px-2 py-1 border border-stone-200 font-medium"
                          >
                            {SHELF_LIFE_DATABASE.map((rule) => (
                              <option key={rule.category} value={rule.category}>
                                {rule.category}
                              </option>
                            ))}
                          </select>

                          <select
                            value={item.storage}
                            onChange={(e) => {
                              const updated = [...parsedReviewItems];
                              updated[index].storage = e.target.value as StorageLocation;
                              setParsedReviewItems(updated);
                            }}
                            className="bg-stone-100 rounded px-2 py-1 border border-stone-200 capitalize font-medium"
                          >
                            <option value="fridge">Fridge</option>
                            <option value="pantry">Pantry</option>
                            <option value="freezer">Freezer</option>
                          </select>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...parsedReviewItems];
                                updated[index].quantity = parseFloat(e.target.value) || 1;
                                setParsedReviewItems(updated);
                              }}
                              className="w-12 text-center bg-stone-100 rounded px-1 py-1 border border-stone-200"
                            />
                            <span className="text-stone-500">{item.unit}</span>
                          </div>

                          <span className="text-stone-400 ml-auto">
                            ~{item.estimatedExpiryDays}d shelf life
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E2E8DE]">
                <span className="text-xs font-semibold text-stone-600">
                  {parsedReviewItems.filter((i) => i.selected).length} items selected
                </span>
                <button
                  onClick={handleSaveAllReceiptItems}
                  className="px-5 py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold shadow-md shadow-[#2C5F2D]/20 active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save All to Database</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. QUICK MANUAL ADD */}
          {activeTab === 'manual' && !showReviewScreen && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Popular Indian Staples (1-Tap):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUICK_STAPLES.map((st) => (
                    <button
                      key={st.name}
                      type="button"
                      onClick={() => {
                        setManualName(st.name);
                        setManualCategory(st.cat);
                        setManualUnit(st.unit);
                        setManualQty(st.qty.toString());
                        setManualPrice(st.price.toString());
                        setManualStorage(st.storage);
                        setManualDays(st.days);
                        setManualCustomDate(calculateExpiryDate(st.days));
                      }}
                      className="p-2 text-left bg-stone-50 hover:bg-[#EAF3E6] border border-[#E2E8DE] hover:border-[#6B9B4F] rounded-xl transition-all cursor-pointer text-xs"
                    >
                      <p className="font-bold text-stone-800 truncate">{st.name}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">₹{st.price} &bull; {st.days}d</p>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleManualAdd} className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Dahi, Paneer, Methi, Bananas, Atta"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#E2E8DE] rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Category</label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as ItemCategory)}
                      className="w-full p-2 bg-white border border-[#E2E8DE] rounded-xl focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                    >
                      {SHELF_LIFE_DATABASE.map((rule) => (
                        <option key={rule.category} value={rule.category}>
                          {rule.category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Storage Location</label>
                    <select
                      value={manualStorage}
                      onChange={(e) => setManualStorage(e.target.value as StorageLocation)}
                      className="w-full p-2 bg-white border border-[#E2E8DE] rounded-xl capitalize focus:ring-2 focus:ring-[#2C5F2D] focus:outline-none"
                    >
                      <option value="fridge">Fridge ❄️</option>
                      <option value="pantry">Pantry 🍞</option>
                      <option value="freezer">Freezer 🧊</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Quantity</label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      required
                      value={manualQty}
                      onChange={(e) => setManualQty(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E2E8DE] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Unit</label>
                    <select
                      value={manualUnit}
                      onChange={(e) => setManualUnit(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E2E8DE] rounded-xl"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="pack">pack</option>
                      <option value="pcs">pcs</option>
                      <option value="bunch">bunch</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-stone-700 block mb-1">Price in ₹</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      className="w-full p-2 bg-white border border-[#E2E8DE] rounded-xl"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#F7F8F4] border border-[#E2E8DE] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">Estimated Expiry</span>
                    <span className="text-[11px] text-stone-500 font-medium italic">
                      ~{manualDays} days based on Indian shelf-life table
                    </span>
                  </div>
                  <input
                    type="date"
                    value={manualCustomDate}
                    onChange={(e) => setManualCustomDate(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E2E8DE] rounded-xl text-xs font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold shadow-md shadow-[#2C5F2D]/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Save Item to SQLite Database</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
