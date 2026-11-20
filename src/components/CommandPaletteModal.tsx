/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Mic,
  MicOff,
  Plus,
  ShoppingCart,
  Printer,
  Thermometer,
  SlidersHorizontal,
  Download,
  ArrowRight,
  Package,
  Building2,
  X,
  CheckCircle2,
  ClipboardCheck,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { calculateExpiryDate, estimateShelfLife } from '../data/shelfLifeData';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  onOpenAddModal: () => void;
  onOpenScaleModal: () => void;
  onOpenRestockList: () => void;
  onOpenLabelPrinter: () => void;
  onOpenStocktake?: () => void;
}

interface ParsedQuickItem {
  name: string;
  quantity: number;
  unit: string;
  category: ReturnType<typeof estimateShelfLife>['category'];
  storage: ReturnType<typeof estimateShelfLife>['storage'];
  expiryDays: number;
}

/** Parses natural-language phrases like "2 kg tomato, 500g paneer, 1L milk" */
function parseNaturalGroceryPhrase(input: string): ParsedQuickItem[] {
  const parts = input
    .split(/,|\band\b|\n|;/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);

  return parts.map((chunk) => {
    const qtyMatch = chunk.match(/^(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|grams|l|litre|litres|liter|ml|pcs|pc|pack|packs|bunch|bunches|dozen|box|bottle)?\s+(.+)$/i);
    let quantity = 1;
    let unit = 'pack';
    let rawName = chunk;

    if (qtyMatch) {
      quantity = Number(qtyMatch[1]) || 1;
      const u = (qtyMatch[2] || '').toLowerCase();
      if (u === 'gm' || u === 'gms' || u === 'grams') unit = 'g';
      else if (u === 'litre' || u === 'litres' || u === 'liter') unit = 'L';
      else if (u === 'l') unit = 'L';
      else if (u === 'pc') unit = 'pcs';
      else if (u === 'packs') unit = 'pack';
      else if (u === 'bunches') unit = 'bunch';
      else if (u) unit = u;
      else unit = 'pcs';
      rawName = qtyMatch[3].trim();
    }

    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const est = estimateShelfLife(formattedName);
    return {
      name: formattedName,
      quantity,
      unit,
      category: est.category,
      storage: est.storage,
      expiryDays: est.days,
    };
  });
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  onOpenAddModal,
  onOpenScaleModal,
  onOpenRestockList,
  onOpenLabelPrinter,
  onOpenStocktake,
}) => {
  const {
    items,
    suppliers,
    restockList,
    preferences,
    addMultipleItems,
    addToRestockList,
    exportBackupJson,
  } = useInventory();

  const [query, setQuery] = useState('');
  const [quickPhrase, setQuickPhrase] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [savingQuick, setSavingQuick] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setVoiceFeedback(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setListening(false);
    }
  }, [isOpen]);

  const parsedQuickItems = useMemo(
    () => (quickPhrase.trim() ? parseNaturalGroceryPhrase(quickPhrase) : []),
    [quickPhrase]
  );

  const matchingItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.status === 'active').slice(0, 4);
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.supplierName && i.supplierName.toLowerCase().includes(q)) ||
          (i.batchCode && i.batchCode.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [items, query]);

  const matchingSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return suppliers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.categories && s.categories.toLowerCase().includes(q))
      )
      .slice(0, 3);
  }, [suppliers, query]);

  const quickActions = [
    {
      id: 'add',
      label: 'Add Stock / Scan Photo OCR',
      hint: 'Open scanner & manual entry',
      icon: <Plus className="w-4 h-4 text-[#2C5F2D]" />,
      run: () => {
        onClose();
        onOpenAddModal();
      },
    },
    ...(onOpenStocktake
      ? [
          {
            id: 'stocktake',
            label: 'Run Physical Stocktake Audit',
            hint: 'Count shelf quantities & reconcile variance',
            icon: <ClipboardCheck className="w-4 h-4 text-[#2C5F2D]" />,
            run: () => {
              onClose();
              onOpenStocktake();
            },
          },
        ]
      : []),
    {
      id: 'restock',
      label: `Open Need-to-Buy & Restock (${restockList.filter((r) => r.status === 'pending').length})`,
      hint: 'Manage completed items & POs',
      icon: <ShoppingCart className="w-4 h-4 text-amber-700" />,
      run: () => {
        onClose();
        onOpenRestockList();
      },
    },
    {
      id: 'labels',
      label: 'Print FIFO Use-By Labels',
      hint: 'Generate thermal/A4 container stickers',
      icon: <Printer className="w-4 h-4 text-[#2C5F2D]" />,
      run: () => {
        onClose();
        onOpenLabelPrinter();
      },
    },
    {
      id: 'ops',
      label: 'Suppliers, Price Drift & Temp Logs',
      hint: 'Vendors, FSSAI fridge checks, storage guide',
      icon: <Thermometer className="w-4 h-4 text-emerald-700" />,
      run: () => {
        onClose();
        setActiveTab('operations');
      },
    },
    {
      id: 'scale',
      label: 'Switch Operation Scale',
      hint: `Current: ${preferences.operationScale}`,
      icon: <SlidersHorizontal className="w-4 h-4 text-stone-600" />,
      run: () => {
        onClose();
        onOpenScaleModal();
      },
    },
    {
      id: 'backup',
      label: 'Export Full JSON Backup',
      hint: 'Download complete SQLite snapshot',
      icon: <Download className="w-4 h-4 text-stone-600" />,
      run: async () => {
        await exportBackupJson();
        onClose();
      },
    },
  ].filter(
    (a) =>
      !query.trim() ||
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.hint.toLowerCase().includes(query.toLowerCase())
  );

  const handleToggleVoice = () => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceFeedback('Voice input is not supported in this browser — type items below instead (e.g. "2 kg tomato, 500g paneer").');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setVoiceFeedback('Listening... Say items like "2 kg tomato, 500g paneer, 1L milk"');
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setQuickPhrase((prev) => (prev.trim() ? `${prev}, ${transcript}` : transcript));
        setVoiceFeedback(`Captured: "${transcript}"`);
      }
    };
    recognition.onerror = () => {
      setVoiceFeedback('Could not capture audio. You can type items directly below.');
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleCommitQuickAdd = async (destination: 'inventory' | 'buy-list') => {
    if (parsedQuickItems.length === 0) return;
    setSavingQuick(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      if (destination === 'inventory') {
        await addMultipleItems(
          parsedQuickItems.map((p) => ({
            name: p.name,
            category: p.category,
            quantity: p.quantity,
            unit: p.unit,
            purchaseDate: today,
            estimatedExpiryDate: calculateExpiryDate(p.expiryDays),
            storage: p.storage,
            price: null,
            status: 'active',
            source: 'manual',
            branchZone: preferences.operationScale !== 'household' ? preferences.branchLocation || null : null,
            notes: 'Added via Quick Kitchen Command',
          }))
        );
        setVoiceFeedback(`Stocked ${parsedQuickItems.length} item(s) directly into Active Inventory!`);
      } else {
        for (const p of parsedQuickItems) {
          await addToRestockList({
            name: p.name,
            category: p.category,
            targetQuantity: p.quantity,
            unit: p.unit,
            storage: p.storage,
            reason: 'manual',
            priority: 'normal',
            branchZone: preferences.operationScale !== 'household' ? preferences.branchLocation || null : null,
          });
        }
        setVoiceFeedback(`Saved ${parsedQuickItems.length} item(s) to your Need-to-Buy list!`);
      }
      setQuickPhrase('');
    } finally {
      setSavingQuick(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-16 p-3 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-[#E2E8DE] overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input */}
        <div className="px-4 py-3.5 border-b border-[#E2E8DE] flex items-center gap-3">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search inventory, suppliers, or run a kitchen command..."
            className="flex-1 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-stone-500 bg-stone-100 rounded-md">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5 text-xs">
          {/* Voice / Natural-Language Quick-Add Box */}
          <div className="bg-[#F7F8F4] border border-[#E2E8DE] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-extrabold text-stone-900">
                  Voice &amp; Natural-Text Quick Stock
                </p>
                <p className="text-[11px] text-stone-500">
                  Speak or type multiple items at once — auto-detects quantity, unit, storage &amp; Indian shelf life.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
                  listening
                    ? 'bg-rose-600 text-white'
                    : 'bg-[#2C5F2D] hover:bg-[#204721] text-white'
                }`}
              >
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-[#A3E635]" />}
                <span>{listening ? 'Stop Mic' : 'Dictate'}</span>
              </button>
            </div>

            <input
              type="text"
              value={quickPhrase}
              onChange={(e) => setQuickPhrase(e.target.value)}
              placeholder='Try: "2 kg tomato, 500g paneer, 1L milk, 1 bunch dhaniya"'
              className="w-full px-3 py-2 bg-white border border-[#E2E8DE] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2C5F2D]"
            />

            {voiceFeedback && (
              <p className="text-[11px] font-semibold text-[#2C5F2D] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{voiceFeedback}</span>
              </p>
            )}

            {parsedQuickItems.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="divide-y divide-stone-200/80 bg-white rounded-xl border border-[#E2E8DE] px-3">
                  {parsedQuickItems.map((p, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="font-bold text-stone-900">{p.name}</span>
                      <span className="text-[11px] text-stone-500 tabular-nums">
                        {p.quantity} {p.unit} · {p.category} · {p.storage} ({p.expiryDays}d)
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingQuick}
                    onClick={() => handleCommitQuickAdd('inventory')}
                    className="px-3.5 py-2 rounded-xl bg-[#2C5F2D] hover:bg-[#204721] text-white font-bold cursor-pointer"
                  >
                    + Add {parsedQuickItems.length} to Active Inventory
                  </button>
                  <button
                    type="button"
                    disabled={savingQuick}
                    onClick={() => handleCommitQuickAdd('buy-list')}
                    className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold cursor-pointer"
                  >
                    + Save {parsedQuickItems.length} to Buy List
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Commands */}
          {quickActions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-stone-500 px-1">Quick Actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {quickActions.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={act.run}
                    className="p-2.5 rounded-xl border border-[#E2E8DE] hover:border-[#2C5F2D] hover:bg-[#EAF3E6]/50 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0">{act.icon}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{act.label}</p>
                        <p className="text-[11px] text-stone-500 truncate">{act.hint}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Inventory Items */}
          {matchingItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-stone-500 px-1">
                {query.trim() ? 'Matching Inventory Items' : 'Active Kitchen Stock'}
              </p>
              <div className="divide-y divide-stone-100 border border-[#E2E8DE] rounded-2xl overflow-hidden">
                {matchingItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('inventory');
                      onClose();
                    }}
                    className="w-full px-3.5 py-2.5 bg-white hover:bg-stone-50 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Package className="w-4 h-4 text-[#2C5F2D] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{it.name}</p>
                        <p className="text-[11px] text-stone-500 tabular-nums">
                          {it.quantity} {it.unit} · {it.storage} · Exp {it.estimatedExpiryDate}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#2C5F2D] shrink-0">Open &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matching Suppliers */}
          {matchingSuppliers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-stone-500 px-1">Matching Suppliers</p>
              <div className="divide-y divide-stone-100 border border-[#E2E8DE] rounded-2xl overflow-hidden">
                {matchingSuppliers.map((sup) => (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('operations');
                      onClose();
                    }}
                    className="w-full px-3.5 py-2.5 bg-white hover:bg-stone-50 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{sup.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {sup.contactName || 'Vendor'} · {sup.leadTimeDays}d lead time
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#2C5F2D] shrink-0">View &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
