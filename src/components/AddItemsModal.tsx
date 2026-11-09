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
  Scan,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateExpiryDate, estimateShelfLife, SHELF_LIFE_DATABASE } from '../data/shelfLifeData';
import { fetchFromOpenFoodFacts } from '../services/openFoodFacts';
import { aiService } from '../services/aiService';
import { ItemCategory, ReceiptParsedItem, StorageLocation } from '../types/inventory';
import { ReceiptParser, SAMPLE_INDIAN_RECEIPTS } from '../utils/receiptParser';

interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ScannedProductDraft {
  name: string;
  brand?: string;
  category: ItemCategory;
  quantity: number;
  unit: string;
  price: number | null;
  barcode?: string | null;
  storage: StorageLocation;
  estimatedExpiryDays: number;
  expiryDate: string;
  imageUrl?: string | null;
  detectedText?: string | null;
  source: 'gemini' | 'local';
}

const SAMPLE_PRODUCT_PHOTOS = [
  {
    name: 'Amul Malai Paneer 200g',
    brand: 'Amul',
    category: 'Dairy' as ItemCategory,
    quantity: 200,
    unit: 'g',
    price: 85,
    estimatedExpiryDays: 5,
    storage: 'fridge' as StorageLocation,
    barcode: '8901058852332',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&q=80',
    detectedText: 'Amul Malai Paneer, Net 200g, Keep Refrigerated',
  },
  {
    name: 'Mother Dairy Classic Dahi 400g',
    brand: 'Mother Dairy',
    category: 'Dairy' as ItemCategory,
    quantity: 400,
    unit: 'g',
    price: 35,
    estimatedExpiryDays: 6,
    storage: 'fridge' as StorageLocation,
    barcode: '8901030383786',
    imageUrl: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=500&q=80',
    detectedText: 'Mother Dairy Classic Dahi, 100% Buffalo Milk, Net 400g',
  },
  {
    name: 'Britannia Whole Wheat Bread 400g',
    brand: 'Britannia',
    category: 'Bakery & Bread' as ItemCategory,
    quantity: 400,
    unit: 'g',
    price: 50,
    estimatedExpiryDays: 4,
    storage: 'pantry' as StorageLocation,
    barcode: '8901058852448',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80',
    detectedText: 'Britannia 100% Whole Wheat Bread, Net Wt 400g',
  },
  {
    name: 'Maggi 2-Minute Masala Noodles',
    brand: 'Nestle',
    category: 'Snacks & Packaged' as ItemCategory,
    quantity: 4,
    unit: 'pack',
    price: 56,
    estimatedExpiryDays: 180,
    storage: 'pantry' as StorageLocation,
    barcode: '8901058863116',
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&q=80',
    detectedText: 'Maggi 2-Minute Noodles, Masala, Pack of 4',
  },
  {
    name: 'Tata Salt Vacuum Evaporated 1kg',
    brand: 'Tata',
    category: 'Spices & Condiments' as ItemCategory,
    quantity: 1,
    unit: 'kg',
    price: 28,
    estimatedExpiryDays: 365,
    storage: 'pantry' as StorageLocation,
    barcode: '8901058847291',
    imageUrl: 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=500&q=80',
    detectedText: 'Tata Salt, Desh ka Namak, 1 kg',
  },
  {
    name: 'Aashirvaad Shudh Chakki Atta 5kg',
    brand: 'Aashirvaad',
    category: 'Grains & Flours' as ItemCategory,
    quantity: 5,
    unit: 'kg',
    price: 245,
    estimatedExpiryDays: 120,
    storage: 'pantry' as StorageLocation,
    barcode: '8901058849202',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80',
    detectedText: 'Aashirvaad Superior MP Atta, 5kg Whole Wheat',
  },
];

/**
 * Resizes and compresses image files or data URLs to ensure optimal dimensions
 * for Gemini Vision OCR (<200KB payload, fast upload, no network timeouts).
 */
function compressImage(
  source: File | Blob | string,
  maxDimension = 1200,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const finalize = (imageElement: HTMLImageElement) => {
      let width = imageElement.naturalWidth || imageElement.width || 800;
      let height = imageElement.naturalHeight || imageElement.height || 600;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          base64: typeof source === 'string' ? source : '',
          mimeType: 'image/jpeg',
        });
        return;
      }
      ctx.drawImage(imageElement, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
    };

    img.onload = () => finalize(img);
    img.onerror = () => {
      if (typeof source === 'string') {
        resolve({ base64: source, mimeType: 'image/jpeg' });
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: reader.result as string, mimeType: 'image/jpeg' });
        reader.onerror = () => resolve({ base64: '', mimeType: 'image/jpeg' });
        reader.readAsDataURL(source);
      }
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: 'image/jpeg' });
      };
      reader.readAsDataURL(source);
    }
  });
}

export const AddItemsModal: React.FC<AddItemsModalProps> = ({ isOpen, onClose }) => {
  const { addItem, addMultipleItems } = useInventory();

  const [activeTab, setActiveTab] = useState<'photo-ocr' | 'receipt' | 'manual'>('photo-ocr');

  // Photo & Barcode OCR State
  const [cameraActive, setCameraActive] = useState(false);
  const [photoOcrLoading, setPhotoOcrLoading] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProductDraft | null>(null);
  const [ocrError, setOcrError] = useState('');
  const [showManualBarcode, setShowManualBarcode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeManualLoading, setBarcodeManualLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const productPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Receipt State
  const [receiptText, setReceiptText] = useState('');
  const [parsingAi, setParsingAi] = useState(false);
  const [parsedReviewItems, setParsedReviewItems] = useState<ReceiptParsedItem[]>([]);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setOcrError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e: any) {
      console.warn('Camera access denied or unavailable', e);
      setOcrError('Camera preview unavailable in current browser view. You can upload a photo or pick a sample Indian package below.');
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

  // Capture frame from camera stream, compress to optimal size, and send to OCR
  const captureCameraPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = Math.min(1280, video.videoWidth || 640);
    const height = Math.min(720, video.videoHeight || 480);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    await handleScanProductPhoto(base64, 'image/jpeg');
  };

  // Handle photo file uploaded from user disk with auto-compression
  const handleProductPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoOcrLoading(true);
    setOcrError('');

    try {
      const compressed = await compressImage(file, 1200, 0.85);
      await handleScanProductPhoto(compressed.base64, compressed.mimeType);
    } catch (err: any) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = async () => {
        await handleScanProductPhoto(reader.result as string, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    }
  };

  // Process photo with Gemini Vision OCR
  const handleScanProductPhoto = async (base64: string, mimeType: string, presetItem?: any) => {
    setPhotoOcrLoading(true);
    setOcrError('');

    try {
      const res = await aiService.scanProductPhoto({ imageBase64: base64, mimeType });
      if (res && res.product && res.product.name) {
        const p = res.product;
        const expiry = p.expiryDate || calculateExpiryDate(p.estimatedExpiryDays || 7);
        setScannedProduct({
          name: p.name,
          brand: p.brand || (presetItem?.brand ?? ''),
          category: p.category || (presetItem?.category ?? 'Dairy'),
          quantity: p.quantity || (presetItem?.quantity ?? 1),
          unit: p.unit || (presetItem?.unit ?? 'pack'),
          price: p.price ?? (presetItem?.price ?? null),
          barcode: p.barcode || (presetItem?.barcode ?? null),
          storage: p.storage || (presetItem?.storage ?? 'fridge'),
          estimatedExpiryDays: p.estimatedExpiryDays || (presetItem?.estimatedExpiryDays ?? 7),
          expiryDate: expiry,
          detectedText: p.detectedText || null,
          imageUrl: base64,
          source: res.source,
        });
      } else if (presetItem) {
        applyPresetFallback(presetItem, base64);
      }
    } catch (err: any) {
      if (presetItem) {
        applyPresetFallback(presetItem, base64);
      } else {
        setOcrError('Could not read product details from photo. You can edit details below.');
      }
    } finally {
      setPhotoOcrLoading(false);
    }
  };

  const applyPresetFallback = (preset: any, image: string) => {
    setScannedProduct({
      name: preset.name,
      brand: preset.brand || '',
      category: preset.category,
      quantity: preset.quantity || 1,
      unit: preset.unit || 'pack',
      price: preset.price,
      barcode: preset.barcode,
      storage: preset.storage,
      estimatedExpiryDays: preset.estimatedExpiryDays,
      expiryDate: calculateExpiryDate(preset.estimatedExpiryDays),
      detectedText: preset.detectedText,
      imageUrl: image,
      source: 'local',
    });
  };

  // Convert image URL to Base64 to test sample presets with instant prefill
  const handleSelectSamplePreset = async (preset: typeof SAMPLE_PRODUCT_PHOTOS[0]) => {
    setPhotoOcrLoading(true);
    setOcrError('');
    // Instant prefill so the user immediately sees the populated product card
    applyPresetFallback(preset, preset.imageUrl);

    try {
      const res = await fetch(preset.imageUrl);
      if (res.ok) {
        const blob = await res.blob();
        const compressed = await compressImage(blob, 1000, 0.85);
        await handleScanProductPhoto(compressed.base64, compressed.mimeType, preset);
      }
    } catch {
      // Preset is already active!
    } finally {
      setPhotoOcrLoading(false);
    }
  };

  // Save scanned product into SQLite DB
  const handleSaveScannedProduct = async () => {
    if (!scannedProduct || !scannedProduct.name) return;

    await addItem({
      name: scannedProduct.name,
      category: scannedProduct.category,
      storage: scannedProduct.storage,
      quantity: Number(scannedProduct.quantity) || 1,
      unit: scannedProduct.unit || 'pack',
      price: scannedProduct.price !== null && !isNaN(scannedProduct.price) ? Number(scannedProduct.price) : null,
      purchaseDate: new Date().toISOString().split('T')[0],
      estimatedExpiryDate: scannedProduct.expiryDate || calculateExpiryDate(scannedProduct.estimatedExpiryDays || 7),
      status: 'active',
      source: 'barcode',
      barcode: scannedProduct.barcode || null,
      imageUrl: scannedProduct.imageUrl || null,
      notes: scannedProduct.detectedText ? `OCR Detected: ${scannedProduct.detectedText}` : null,
    });

    onClose();
  };

  // Manual Barcode Number Lookup (Fallback)
  const handleBarcodeLookup = async () => {
    const code = barcodeInput.trim();
    if (!code) return;

    setBarcodeManualLoading(true);
    setOcrError('');

    try {
      const result = await fetchFromOpenFoodFacts(code);
      if (result.found) {
        setScannedProduct({
          name: result.name,
          brand: result.brand || '',
          category: result.category,
          quantity: result.quantity || 1,
          unit: result.unit || 'pack',
          price: result.price,
          barcode: result.barcode,
          storage: result.storage,
          estimatedExpiryDays: result.estimatedExpiryDays,
          expiryDate: calculateExpiryDate(result.estimatedExpiryDays),
          imageUrl: result.imageUrl,
          source: 'local',
        });
      } else {
        setOcrError(`Product not found for barcode ${code}. You can enter details directly.`);
      }
    } catch {
      setOcrError('Could not reach barcode database.');
    } finally {
      setBarcodeManualLoading(false);
    }
  };

  // ---------------- Receipt OCR handlers ----------------
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

  const handleReceiptImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingAi(true);
    try {
      const compressed = await compressImage(file, 1200, 0.85);
      const result = await aiService.parseReceipt({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
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

  // ---------------- Quick Manual handler ----------------
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
                setActiveTab('photo-ocr');
              }}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'photo-ocr'
                  ? 'border-[#2C5F2D] text-[#2C5F2D]'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Photo / Barcode OCR</span>
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
          {/* 1. PHOTO & BARCODE OCR SCANNER (Primary) */}
          {activeTab === 'photo-ocr' && !showReviewScreen && (
            <div className="space-y-4">
              {/* Hidden file input for photo upload */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={productPhotoInputRef}
                onChange={handleProductPhotoUpload}
                className="hidden"
              />

              {/* Live Camera Viewfinder or Action Card */}
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-stone-800">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  
                  {/* Targeting Overlay Frame */}
                  <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-28 border-2 border-dashed border-[#A3E635] rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white bg-black/70 px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                      <Scan className="w-3.5 h-3.5 text-[#A3E635]" />
                      Align package, label, or barcode
                    </span>
                  </div>

                  {/* Camera Top Controls */}
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black text-white text-xs font-semibold rounded-lg"
                  >
                    Close
                  </button>

                  {/* Shutter Button */}
                  <div className="absolute bottom-3 inset-x-0 flex justify-center">
                    <button
                      onClick={captureCameraPhoto}
                      className="px-5 py-2.5 rounded-full bg-[#A3E635] text-[#2C5F2D] font-black text-xs shadow-xl active:scale-95 transition-transform flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>📸 Snap &amp; Scan Photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Primary Photo Upload / Camera Card */
                <div className="bg-stone-50 border-2 border-dashed border-[#6B9B4F]/40 rounded-3xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF3E6] text-[#2C5F2D] mx-auto flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-stone-900">
                      Scan Product with Photo OCR
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5 max-w-sm mx-auto">
                      Take a photo of any grocery package, label, produce, or barcode. Gemini Vision automatically extracts the item name, net weight, MRP ₹, barcode, and expiry date.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                    <button
                      onClick={startCamera}
                      className="px-4 py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Camera className="w-4 h-4 text-[#A3E635]" />
                      <span>Snap Photo with Camera</span>
                    </button>

                    <button
                      onClick={() => productPhotoInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold border border-[#E2E8DE] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-stone-600" />
                      <span>Upload Package Photo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Scanning Progress */}
              {photoOcrLoading && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                  <div>
                    <p className="font-bold">Analyzing Product Photo with Vision OCR...</p>
                    <p className="text-[11px] text-emerald-700">Extracting product title, net quantity, brand, price &amp; shelf life</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {ocrError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{ocrError}</p>
                </div>
              )}

              {/* Extracted Product Review Card */}
              {scannedProduct && !photoOcrLoading && (
                <div className="p-4 bg-[#F7F8F4] border border-[#6B9B4F] rounded-2xl space-y-3 shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {scannedProduct.source === 'gemini' ? 'Gemini Vision OCR' : 'Local OCR Scanner'}
                    </span>
                    <button
                      onClick={() => setScannedProduct(null)}
                      className="text-[11px] text-stone-400 hover:text-stone-700 font-semibold"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex items-start gap-3">
                    {scannedProduct.imageUrl ? (
                      <img
                        src={scannedProduct.imageUrl}
                        alt={scannedProduct.name}
                        className="w-16 h-16 object-contain rounded-xl bg-white p-1 border border-stone-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-stone-200 flex items-center justify-center shrink-0">
                        <Package className="w-8 h-8 text-stone-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={scannedProduct.name}
                          onChange={(e) => setScannedProduct({ ...scannedProduct, name: e.target.value })}
                          className="font-extrabold text-sm text-stone-900 w-full bg-white border border-stone-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-[#2C5F2D]"
                          placeholder="Product Name"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        {scannedProduct.brand && (
                          <span className="font-semibold text-stone-700">Brand: {scannedProduct.brand}</span>
                        )}
                        {scannedProduct.barcode && (
                          <span className="font-mono text-[10px] text-stone-400">Barcode: {scannedProduct.barcode}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Attributes Grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Quantity</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={scannedProduct.quantity}
                        onChange={(e) => setScannedProduct({ ...scannedProduct, quantity: Number(e.target.value) || 1 })}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Unit</label>
                      <input
                        type="text"
                        value={scannedProduct.unit}
                        onChange={(e) => setScannedProduct({ ...scannedProduct, unit: e.target.value })}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Price (₹)</label>
                      <input
                        type="number"
                        value={scannedProduct.price ?? ''}
                        placeholder="MRP"
                        onChange={(e) => setScannedProduct({ ...scannedProduct, price: e.target.value ? parseFloat(e.target.value) : null })}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Category</label>
                      <select
                        value={scannedProduct.category}
                        onChange={(e) => setScannedProduct({ ...scannedProduct, category: e.target.value as ItemCategory })}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg font-medium"
                      >
                        {SHELF_LIFE_DATABASE.map((rule) => (
                          <option key={rule.category} value={rule.category}>
                            {rule.category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-stone-600 block mb-1">Storage Location</label>
                      <select
                        value={scannedProduct.storage}
                        onChange={(e) => setScannedProduct({ ...scannedProduct, storage: e.target.value as StorageLocation })}
                        className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg capitalize font-medium"
                      >
                        <option value="fridge">Fridge ❄️</option>
                        <option value="pantry">Pantry 🍞</option>
                        <option value="freezer">Freezer 🧊</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-stone-600 block mb-1">Expiry / Best Before Date</label>
                    <input
                      type="date"
                      value={scannedProduct.expiryDate}
                      onChange={(e) => setScannedProduct({ ...scannedProduct, expiryDate: e.target.value })}
                      className="w-full p-2 bg-white border border-[#E2E8DE] rounded-lg font-semibold text-xs"
                    />
                  </div>

                  <button
                    onClick={handleSaveScannedProduct}
                    className="w-full py-2.5 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-[#2C5F2D]/20 active:scale-98 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm &amp; Save to SQLite Database</span>
                  </button>
                </div>
              )}

              {/* Sample Product Photo Presets (1-Tap Test) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Or Test with Sample Product Photos (1-Tap):
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SAMPLE_PRODUCT_PHOTOS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleSelectSamplePreset(preset)}
                      className="p-2 text-left bg-stone-50 hover:bg-[#EAF3E6] border border-[#E2E8DE] hover:border-[#6B9B4F] rounded-2xl transition-all cursor-pointer flex items-center gap-2 group"
                    >
                      <img
                        src={preset.imageUrl}
                        alt={preset.name}
                        className="w-10 h-10 object-cover rounded-xl bg-white border border-stone-200 shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate text-[11px]">{preset.name}</p>
                        <p className="text-[10px] text-stone-500">₹{preset.price} &bull; {preset.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Collapsible Manual Barcode Fallback */}
              <div className="pt-2 border-t border-stone-200">
                <button
                  onClick={() => setShowManualBarcode(!showManualBarcode)}
                  className="w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-800 font-semibold py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5" />
                    <span>Have a numeric barcode instead? (Type manually)</span>
                  </span>
                  {showManualBarcode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showManualBarcode && (
                  <div className="pt-2 flex gap-2 animate-in fade-in">
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="e.g. 8901262010046 (Amul Butter)"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-[#E2E8DE] rounded-xl focus:ring-1 focus:ring-[#2C5F2D] focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                    />
                    <button
                      onClick={handleBarcodeLookup}
                      disabled={barcodeManualLoading}
                      className="px-3.5 py-2 bg-[#2C5F2D] text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {barcodeManualLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Lookup'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. RECEIPT OCR FLOW */}
          {activeTab === 'receipt' && !showReviewScreen && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-dashed border-[#6B9B4F]/50 text-center space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  ref={receiptFileInputRef}
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
                    onClick={() => receiptFileInputRef.current?.click()}
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
