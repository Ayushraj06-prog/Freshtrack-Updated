/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { calculateExpiryDate, getRemainingDays } from '../data/shelfLifeData';
import { api } from '../services/api';
import { onUnauthorized } from '../services/authSession';
import { downloadSafeCsv } from '../utils/security';
import {
  InventoryItem,
  UserPreferences,
  InventoryStats,
  DbInfo,
  UseItemPayload,
  CustomRecipe,
  RestockItem,
  StockFromRestockPayload,
  MealPlanEntry,
  ActivityLogEntry,
  Supplier,
  StorageLog,
  ChecklistItem,
  TransferItemPayload,
  StocktakeEntryPayload,
  StocktakeResult,
  WasteLogEntry,
  LogWastePayload,
  PurchaseInvoice,
  InvoiceStatus,
} from '../types/inventory';

interface InventoryContextType {
  items: InventoryItem[];
  customRecipes: CustomRecipe[];
  restockList: RestockItem[];
  mealPlans: MealPlanEntry[];
  suppliers: Supplier[];
  storageLogs: StorageLog[];
  checklists: ChecklistItem[];
  wasteLogs: WasteLogEntry[];
  invoices: PurchaseInvoice[];
  activityLogs: ActivityLogEntry[];
  preferences: UserPreferences;
  dbInfo: DbInfo | null;
  dbConnected: boolean;
  authMode: 'loading' | 'setup' | 'locked' | 'authenticated';
  authSource: 'env' | 'database' | 'unclaimed';
  handleAuthSuccess: () => Promise<void>;
  lockWorkspace: () => Promise<void>;
  notificationLog: { id: string; title: string; message: string; timestamp: string }[];
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<string>;
  addMultipleItems: (items: Omit<InventoryItem, 'id'>[]) => Promise<string[]>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  markAsUsed: (id: string, options?: UseItemPayload) => Promise<void>;
  markMultipleAsUsed: (ids: string[]) => Promise<void>;
  markAsExpired: (id: string) => Promise<void>;
  markMultipleAsExpired: (ids: string[]) => Promise<void>;
  freezeAndExtendItem: (id: string) => Promise<void>;
  markMultipleAsFrozen: (ids: string[]) => Promise<void>;
  saveCustomRecipe: (recipe: Partial<CustomRecipe>) => Promise<CustomRecipe>;
  deleteCustomRecipe: (id: string) => Promise<void>;
  cookCustomRecipe: (
    id: string,
    deductions: { itemId: string; portion?: number; usedQuantity?: number; usedPortionName?: string }[]
  ) => Promise<void>;
  addToRestockList: (item: Partial<RestockItem>) => Promise<RestockItem>;
  updateRestockItem: (id: string, updates: Partial<RestockItem>) => Promise<void>;
  removeFromRestockItem: (id: string) => Promise<void>;
  syncNeededRestock: () => Promise<number>;
  stockFromRestockList: (id: string, overrides?: StockFromRestockPayload) => Promise<InventoryItem>;
  bulkStockFromRestockList: (ids: string[]) => Promise<InventoryItem[]>;
  saveMealPlan: (entry: Partial<MealPlanEntry>) => Promise<MealPlanEntry>;
  deleteMealPlan: (id: string) => Promise<void>;
  clearMealPlans: () => Promise<void>;
  saveSupplier: (entry: Partial<Supplier>) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;
  addStorageLog: (entry: Partial<StorageLog>) => Promise<StorageLog>;
  deleteStorageLog: (id: string) => Promise<void>;
  transferItem: (id: string, payload: TransferItemPayload) => Promise<void>;
  reconcileStocktake: (entries: StocktakeEntryPayload[]) => Promise<StocktakeResult>;
  saveChecklistItem: (entry: Partial<ChecklistItem>) => Promise<ChecklistItem>;
  toggleChecklistItem: (id: string) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;
  resetDailyChecklists: () => Promise<void>;
  logWaste: (payload: LogWastePayload) => Promise<WasteLogEntry>;
  deleteWasteLog: (id: string) => Promise<void>;
  saveInvoice: (entry: Partial<PurchaseInvoice>) => Promise<PurchaseInvoice>;
  updateInvoiceStatus: (id: string, paymentStatus: InvoiceStatus) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  refreshActivityLogs: () => Promise<void>;
  exportBackupJson: () => Promise<void>;
  restoreBackupJson: (snapshot: any) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  seedDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  exportCsv: () => void;
  refreshBackendData: () => Promise<void>;
  stats: InventoryStats;
}

const DEFAULT_PREFS: UserPreferences = {
  operationScale: 'household',
  organizationName: '',
  branchLocation: '',
  wasteBudgetRs: 2000,
  scaleConfigured: false,
  diet: 'veg',
  reminderLeadDays: 2,
  morningDigestEnabled: true,
  morningDigestTime: '08:30',
  defaultStorage: 'fridge',
};

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([]);
  const [restockList, setRestockList] = useState<RestockItem[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [storageLogs, setStorageLogs] = useState<StorageLog[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLogEntry[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'loading' | 'setup' | 'locked' | 'authenticated'>('loading');
  const [authSource, setAuthSource] = useState<'env' | 'database' | 'unclaimed'>('unclaimed');
  const [notificationLog, setNotificationLog] = useState<
    { id: string; title: string; message: string; timestamp: string }[]
  >([]);

  const refreshActivityLogs = async () => {
    try {
      const logs = await api.fetchActivityLogs(40);
      setActivityLogs(logs);
    } catch {}
  };

  // Load state from backend SQLite database on mount
  const refreshBackendData = async () => {
    try {
      const [
        backendItems,
        backendPrefs,
        info,
        customRecs,
        backendRestock,
        backendMeals,
        backendSuppliers,
        backendStorageLogs,
        backendChecklists,
        backendWasteLogs,
        backendInvoices,
        backendLogs,
      ] = await Promise.all([
        api.fetchItems(),
        api.fetchPreferences(),
        api.getDbInfo(),
        api.fetchCustomRecipes().catch(() => []),
        api.fetchRestockList().catch(() => []),
        api.fetchMealPlans().catch(() => []),
        api.fetchSuppliers().catch(() => []),
        api.fetchStorageLogs(60).catch(() => []),
        api.fetchChecklists().catch(() => []),
        api.fetchWasteLogs(100).catch(() => []),
        api.fetchInvoices(100).catch(() => []),
        api.fetchActivityLogs(40).catch(() => []),
      ]);
      setItems(backendItems);
      if (backendPrefs) setPreferences(backendPrefs);
      setDbInfo(info);
      setCustomRecipes(customRecs || []);
      setRestockList(backendRestock || []);
      setMealPlans(backendMeals || []);
      setSuppliers(backendSuppliers || []);
      setStorageLogs(backendStorageLogs || []);
      setChecklists(backendChecklists || []);
      setWasteLogs(backendWasteLogs || []);
      setInvoices(backendInvoices || []);
      setActivityLogs(backendLogs || []);
      setDbConnected(true);
    } catch (err) {
      console.warn('Backend DB sync deferred:', err);
      setDbConnected(false);
    }
  };

  const resetInMemorySensitiveState = () => {
    setItems([]);
    setCustomRecipes([]);
    setRestockList([]);
    setMealPlans([]);
    setSuppliers([]);
    setStorageLogs([]);
    setChecklists([]);
    setWasteLogs([]);
    setInvoices([]);
    setActivityLogs([]);
    setDbInfo(null);
    setDbConnected(false);
  };

  const checkAuthAndBootstrap = async () => {
    // Purge any legacy plaintext inventory backups from localStorage
    try {
      localStorage.removeItem('freshtrack_inventory_backup');
    } catch {}

    try {
      const status = await api.getAuthStatus();
      setAuthSource(status.source);
      if (!status.configured) {
        resetInMemorySensitiveState();
        setAuthMode('setup');
        return;
      }
      if (!status.authenticated) {
        resetInMemorySensitiveState();
        setAuthMode('locked');
        return;
      }
      setAuthMode('authenticated');
      await refreshBackendData();
    } catch (err) {
      console.warn('Auth status check retry:', err);
      setAuthMode('locked');
    }
  };

  const handleAuthSuccess = async () => {
    const status = await api.getAuthStatus().catch(() => ({
      configured: true,
      source: 'database' as const,
      authenticated: true,
      expiresAt: null,
    }));
    setAuthSource(status.source);
    setAuthMode('authenticated');
    await refreshBackendData();
  };

  const lockWorkspace = async () => {
    await api.logoutWorkspace();
    resetInMemorySensitiveState();
    setAuthMode('locked');
  };

  useEffect(() => {
    checkAuthAndBootstrap();
    const unsubscribe = onUnauthorized(() => {
      resetInMemorySensitiveState();
      setAuthMode((prev) => (prev === 'setup' ? 'setup' : 'locked'));
    });
    return unsubscribe;
  }, []);

  // Compute urgent reminders for notification log
  useEffect(() => {
    const urgentItems = items.filter((item) => {
      if (item.status !== 'active') return false;
      const days = getRemainingDays(item.estimatedExpiryDate);
      return days <= preferences.reminderLeadDays && days >= 0;
    });

    if (urgentItems.length > 0) {
      const log = [
        {
          id: `digest-${Date.now()}`,
          title: '🌅 Morning Kitchen Digest',
          message: `${urgentItems.length} item${urgentItems.length > 1 ? 's' : ''} in your kitchen require cooking soon (${urgentItems.slice(0, 3).map((i) => i.name).join(', ')}${urgentItems.length > 3 ? ` +${urgentItems.length - 3} more` : ''}). Tap Recipes to cook them today!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
      setNotificationLog(log);
    } else {
      setNotificationLog([]);
    }
  }, [items, preferences.reminderLeadDays]);

  const addItem = async (itemData: Omit<InventoryItem, 'id'>): Promise<string> => {
    const tempId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimistic: InventoryItem = { ...itemData, id: tempId };
    setItems((prev) => [optimistic, ...prev]);

    try {
      const saved = await api.createItem(itemData);
      setItems((prev) => prev.map((i) => (i.id === tempId ? saved : i)));
      api.getDbInfo().then(setDbInfo).catch(() => {});
      return saved.id;
    } catch (err) {
      console.error('Failed to save item to backend DB:', err);
      return tempId;
    }
  };

  const addMultipleItems = async (itemsData: Omit<InventoryItem, 'id'>[]): Promise<string[]> => {
    const tempItems: InventoryItem[] = itemsData.map((d, idx) => ({
      ...d,
      id: `item-${Date.now()}-${idx}`,
    }));
    setItems((prev) => [...tempItems, ...prev]);

    try {
      const saved = await api.createMultipleItems(itemsData);
      setItems((prev) => {
        const withoutTemp = prev.filter((i) => !tempItems.some((t) => t.id === i.id));
        return [...saved, ...withoutTemp];
      });
      api.getDbInfo().then(setDbInfo).catch(() => {});
      return saved.map((s) => s.id);
    } catch (err) {
      console.error('Failed to save bulk items to backend DB:', err);
      return tempItems.map((t) => t.id);
    }
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    try {
      await api.updateItem(id, updates);
      api.getDbInfo().then(setDbInfo).catch(() => {});
    } catch (err) {
      console.error('Failed to update item on backend:', err);
    }
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.deleteItem(id);
      api.getDbInfo().then(setDbInfo).catch(() => {});
    } catch (err) {
      console.error('Failed to delete item from backend:', err);
    }
  };

  const markAsUsed = async (id: string, options?: UseItemPayload) => {
    const existing = items.find((i) => i.id === id);
    if (!existing) return;

    const origQty = existing.originalQuantity || existing.quantity || 1;
    const currQty = existing.quantity || 1;
    let portion = 1.0;
    let qtyUsed = currQty;

    if (options && typeof options.portion === 'number' && options.portion > 0 && options.portion <= 1.0) {
      portion = options.portion;
      qtyUsed = Math.min(currQty, Number((currQty * portion).toFixed(2)));
    } else if (options && typeof options.usedQuantity === 'number' && options.usedQuantity > 0) {
      qtyUsed = Math.min(currQty, options.usedQuantity);
      portion = currQty > 0 ? (qtyUsed / currQty) : 1.0;
    }

    const remainingQty = Math.max(0, Number((currQty - qtyUsed).toFixed(2)));
    const portionRatioOfTotal = origQty > 0 ? (qtyUsed / origQty) : portion;
    const moneySavedFromThisPortion = existing.price ? Math.round(existing.price * portionRatioOfTotal) : 0;
    const newSavedMoney = (Number(existing.savedMoney) || 0) + moneySavedFromThisPortion;
    const nowIso = new Date().toISOString();
    const isFinished = remainingQty <= 0 || portion >= 0.98;

    const portionLabel = options?.usedPortionName || (isFinished ? 'Finished 100%' : `Used ${Math.round(portion * 100)}% (${qtyUsed} ${existing.unit})`);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const usageNote = `[${dateStr}] ${portionLabel} (Saved ₹${moneySavedFromThisPortion})`;
    const updatedNotes = existing.notes ? `${existing.notes} • ${usageNote}` : usageNote;

    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (isFinished) {
          return {
            ...i,
            status: 'used',
            quantity: 0,
            originalQuantity: origQty,
            savedMoney: newSavedMoney > 0 ? newSavedMoney : (existing.price || 0),
            usedAt: nowIso,
            notes: updatedNotes,
          };
        } else {
          return {
            ...i,
            status: 'active',
            quantity: remainingQty,
            originalQuantity: origQty,
            savedMoney: newSavedMoney,
            notes: updatedNotes,
          };
        }
      })
    );

    try {
      const serverUpdated = await api.markAsUsed(id, options);
      if (serverUpdated) {
        setItems((prev) => prev.map((i) => (i.id === id ? serverUpdated : i)));
      }
      api.getDbInfo().then(setDbInfo).catch(() => {});
      api.fetchRestockList().then(setRestockList).catch(() => {});
      refreshActivityLogs();
    } catch (err) {
      console.error('Failed to mark item as used in backend DB:', err);
    }
  };

  const markMultipleAsUsed = async (ids: string[]) => {
    const idSet = new Set(ids);
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) => (idSet.has(i.id) ? { ...i, status: 'used', quantity: 0, usedAt: nowIso } : i))
    );
    try {
      await api.markMultipleAsUsed(ids);
      api.getDbInfo().then(setDbInfo).catch(() => {});
      api.fetchRestockList().then(setRestockList).catch(() => {});
      refreshActivityLogs();
    } catch (err) {
      console.error('Failed to mark multiple items as used in DB:', err);
    }
  };

  const markAsExpired = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'expired' } : i)));
    try {
      await api.markAsExpired(id);
      api.getDbInfo().then(setDbInfo).catch(() => {});
      refreshActivityLogs();
    } catch (err) {
      console.error('Failed to mark item as expired:', err);
    }
  };

  const markMultipleAsExpired = async (ids: string[]) => {
    const idSet = new Set(ids);
    setItems((prev) => prev.map((i) => (idSet.has(i.id) ? { ...i, status: 'expired' } : i)));
    try {
      await api.markMultipleAsExpired(ids);
      api.getDbInfo().then(setDbInfo).catch(() => {});
      refreshActivityLogs();
    } catch (err) {
      console.error('Failed to mark multiple items expired:', err);
    }
  };

  const freezeAndExtendItem = async (id: string) => {
    try {
      const updated = await api.freezeAndExtendItem(id);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      api.getDbInfo().then(setDbInfo).catch(() => {});
      refreshActivityLogs();
    } catch (err) {
      console.error('Failed to freeze & extend item:', err);
    }
  };

  const markMultipleAsFrozen = async (ids: string[]) => {
    try {
      const updated = await api.markMultipleAsFrozen(ids);
      const map = new Map(updated.map((u) => [u.id, u]));
      setItems((prev) => prev.map((i) => map.get(i.id) || i));
      api.getDbInfo().then(setDbInfo).catch(() => {});
      refreshActivityLogs();
    } catch (err) {
      console.error('Failed to bulk freeze items:', err);
    }
  };

  const saveCustomRecipe = async (recipeData: Partial<CustomRecipe>): Promise<CustomRecipe> => {
    try {
      const saved = await api.saveCustomRecipe(recipeData);
      setCustomRecipes((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id);
        if (idx !== -1) {
          return prev.map((r) => (r.id === saved.id ? saved : r));
        }
        return [saved, ...prev];
      });
      return saved;
    } catch (err) {
      console.error('Failed to save custom recipe:', err);
      throw err;
    }
  };

  const deleteCustomRecipe = async (id: string) => {
    setCustomRecipes((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.deleteCustomRecipe(id);
    } catch (err) {
      console.error('Failed to delete custom recipe:', err);
    }
  };

  const cookCustomRecipe = async (
    id: string,
    deductions: { itemId: string; portion?: number; usedQuantity?: number; usedPortionName?: string }[]
  ) => {
    try {
      const res = await api.cookCustomRecipe(id, deductions);
      if (res && res.updatedItems) {
        setItems((prev) => {
          const map = new Map(res.updatedItems.map((u: InventoryItem) => [u.id, u]));
          return prev.map((i) => map.get(i.id) || i);
        });
      }
      if (res && res.recipe) {
        setCustomRecipes((prev) => prev.map((r) => (r.id === id ? res.recipe : r)));
      }
      api.getDbInfo().then(setDbInfo).catch(() => {});
      api.fetchRestockList().then(setRestockList).catch(() => {});
    } catch (err) {
      console.error('Failed to log custom recipe cooking:', err);
      for (const d of deductions) {
        await markAsUsed(d.itemId, {
          portion: d.portion,
          usedQuantity: d.usedQuantity,
          usedPortionName: d.usedPortionName,
        });
      }
    }
  };

  const addToRestockList = async (item: Partial<RestockItem>): Promise<RestockItem> => {
    const saved = await api.saveRestockItem(item);
    setRestockList((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx !== -1) return prev.map((r) => (r.id === saved.id ? saved : r));
      return [saved, ...prev];
    });
    return saved;
  };

  const updateRestockItem = async (id: string, updates: Partial<RestockItem>) => {
    setRestockList((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    try {
      const updated = await api.updateRestockItem(id, updates);
      setRestockList((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      console.error('Failed to update restock item:', err);
    }
  };

  const removeFromRestockItem = async (id: string) => {
    setRestockList((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.deleteRestockItem(id);
    } catch (err) {
      console.error('Failed to delete restock item:', err);
    }
  };

  const syncNeededRestock = async (): Promise<number> => {
    const res = await api.syncNeededRestockItems();
    setRestockList(res.items || []);
    return res.addedCount || 0;
  };

  const stockFromRestockList = async (
    id: string,
    overrides?: StockFromRestockPayload
  ): Promise<InventoryItem> => {
    const res = await api.stockRestockItem(id, overrides);
    if (res.stockedItem) {
      setItems((prev) => [res.stockedItem, ...prev]);
    }
    if (res.restockItem) {
      setRestockList((prev) => prev.map((r) => (r.id === id ? res.restockItem : r)));
    }
    api.getDbInfo().then(setDbInfo).catch(() => {});
    return res.stockedItem;
  };

  const bulkStockFromRestockList = async (ids: string[]): Promise<InventoryItem[]> => {
    const res = await api.bulkStockRestockItems(ids);
    if (res.stockedItems && res.stockedItems.length > 0) {
      setItems((prev) => [...res.stockedItems, ...prev]);
    }
    if (res.restockItems && res.restockItems.length > 0) {
      const updatedMap = new Map(res.restockItems.map((r) => [r.id, r]));
      setRestockList((prev) => prev.map((r) => updatedMap.get(r.id) || r));
    }
    api.getDbInfo().then(setDbInfo).catch(() => {});
    refreshActivityLogs();
    return res.stockedItems || [];
  };

  const saveMealPlan = async (entry: Partial<MealPlanEntry>): Promise<MealPlanEntry> => {
    const saved = await api.saveMealPlan(entry);
    setMealPlans((prev) => {
      const idx = prev.findIndex((m) => m.id === saved.id);
      if (idx !== -1) return prev.map((m) => (m.id === saved.id ? saved : m));
      return [...prev, saved];
    });
    return saved;
  };

  const deleteMealPlan = async (id: string) => {
    setMealPlans((prev) => prev.filter((m) => m.id !== id));
    try {
      await api.deleteMealPlan(id);
    } catch (err) {
      console.error('Failed to delete meal plan:', err);
    }
  };

  const clearMealPlans = async () => {
    setMealPlans([]);
    try {
      await api.clearMealPlans();
    } catch (err) {
      console.error('Failed to clear meal plans:', err);
    }
  };

  const saveSupplier = async (entry: Partial<Supplier>): Promise<Supplier> => {
    const saved = await api.saveSupplier(entry);
    setSuppliers((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx !== -1) return prev.map((s) => (s.id === saved.id ? saved : s));
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    refreshActivityLogs();
    return saved;
  };

  const deleteSupplier = async (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.deleteSupplier(id);
    } catch (err) {
      console.error('Failed to delete supplier:', err);
    }
  };

  const addStorageLog = async (entry: Partial<StorageLog>): Promise<StorageLog> => {
    const saved = await api.addStorageLog(entry);
    setStorageLogs((prev) => [saved, ...prev]);
    refreshActivityLogs();
    return saved;
  };

  const deleteStorageLog = async (id: string) => {
    setStorageLogs((prev) => prev.filter((l) => l.id !== id));
    try {
      await api.deleteStorageLog(id);
    } catch (err) {
      console.error('Failed to delete storage log:', err);
    }
  };

  const transferItem = async (id: string, payload: TransferItemPayload) => {
    const res = await api.transferItem(id, payload);
    setItems((prev) => {
      const updated = prev.map((i) => (i.id === id && res.sourceItem ? res.sourceItem : i));
      return res.transferredItem ? [res.transferredItem, ...updated] : updated;
    });
    api.getDbInfo().then(setDbInfo).catch(() => {});
    refreshActivityLogs();
  };

  const reconcileStocktake = async (entries: StocktakeEntryPayload[]): Promise<StocktakeResult> => {
    const res = await api.reconcileStocktake(entries);
    if (Array.isArray(res.items)) setItems(res.items);
    if (Array.isArray(res.restockList)) setRestockList(res.restockList);
    api.getDbInfo().then(setDbInfo).catch(() => {});
    refreshActivityLogs();
    return res;
  };

  const saveChecklistItem = async (entry: Partial<ChecklistItem>): Promise<ChecklistItem> => {
    const saved = await api.saveChecklistItem(entry);
    setChecklists((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx !== -1) return prev.map((c) => (c.id === saved.id ? saved : c));
      return [saved, ...prev];
    });
    return saved;
  };

  const toggleChecklistItem = async (id: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, completed: !c.completed, completedAt: !c.completed ? new Date().toISOString() : null }
          : c
      )
    );
    try {
      const updated = await api.toggleChecklistItem(id);
      setChecklists((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Failed to toggle checklist:', err);
    }
  };

  const deleteChecklistItem = async (id: string) => {
    setChecklists((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.deleteChecklistItem(id);
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    }
  };

  const resetDailyChecklists = async () => {
    const updated = await api.resetDailyChecklists();
    setChecklists(updated);
    refreshActivityLogs();
  };

  const logWaste = async (payload: LogWastePayload): Promise<WasteLogEntry> => {
    const res = await api.logWaste(payload);
    setWasteLogs((prev) => [res.log, ...prev]);
    if (res.updatedItem) {
      setItems((prev) => prev.map((i) => (i.id === res.updatedItem!.id ? res.updatedItem! : i)));
    }
    api.getDbInfo().then(setDbInfo).catch(() => {});
    refreshActivityLogs();
    return res.log;
  };

  const deleteWasteLog = async (id: string) => {
    setWasteLogs((prev) => prev.filter((w) => w.id !== id));
    try {
      await api.deleteWasteLog(id);
    } catch (err) {
      console.error('Failed to delete waste log:', err);
    }
  };

  const saveInvoice = async (entry: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> => {
    const saved = await api.saveInvoice(entry);
    setInvoices((prev) => {
      const idx = prev.findIndex((inv) => inv.id === saved.id);
      if (idx !== -1) return prev.map((inv) => (inv.id === saved.id ? saved : inv));
      return [saved, ...prev];
    });
    refreshActivityLogs();
    return saved;
  };

  const updateInvoiceStatus = async (id: string, paymentStatus: InvoiceStatus) => {
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, paymentStatus } : inv)));
    try {
      const updated = await api.updateInvoiceStatus(id, paymentStatus);
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
    } catch (err) {
      console.error('Failed to update invoice status:', err);
    }
  };

  const deleteInvoice = async (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    try {
      await api.deleteInvoice(id);
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  const exportBackupJson = async () => {
    const snapshot = await api.exportBackup();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `freshtrack_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const restoreBackupJson = async (snapshot: any) => {
    await api.restoreBackup(snapshot);
    await refreshBackendData();
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
    try {
      await api.updatePreferences(updates);
    } catch (err) {
      console.error('Failed to update preferences on backend:', err);
    }
  };

  const seedDemoData = async () => {
    try {
      const seeded = await api.seedDemoData();
      setItems(seeded);
      api.getDbInfo().then(setDbInfo).catch(() => {});
    } catch (err) {
      console.error('Failed to seed backend database:', err);
    }
  };

  const clearAllData = async () => {
    setItems([]);
    try {
      await api.clearAllItems();
      api.getDbInfo().then(setDbInfo).catch(() => {});
    } catch {}
  };

  const exportCsv = () => {
    const isCommercial = preferences.operationScale !== 'household';
    const headers = [
      'ID',
      'Name',
      'Category',
      'Storage',
      'Quantity',
      'Unit',
      'Purchase Date',
      'Expiry Date',
      'Price (INR)',
      'Status',
      'Used At',
      'Source',
      ...(isCommercial ? ['Batch Code', 'Supplier', 'Par Level', 'Branch/Zone', 'Reorder Needed'] : []),
    ];

    const rows = items.map((i) => [
      i.id,
      i.name,
      i.category,
      i.storage,
      i.quantity,
      i.unit,
      i.purchaseDate,
      i.estimatedExpiryDate,
      i.price !== null ? i.price : 'N/A',
      i.status,
      i.usedAt || 'N/A',
      i.source,
      ...(isCommercial
        ? [
            i.batchCode || '',
            i.supplierName || '',
            i.parLevel ?? '',
            i.branchZone || preferences.branchLocation || '',
            i.status === 'active' && i.parLevel !== null && i.parLevel !== undefined && i.quantity <= i.parLevel
              ? 'YES'
              : 'NO',
          ]
        : []),
    ]);

    const prefix = isCommercial ? `freshtrack_${preferences.operationScale}_audit` : 'freshtrack_inventory';
    downloadSafeCsv(`${prefix}_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const stats: InventoryStats = useMemo(() => {
    const totalLogged = items.length;
    let activeCount = 0;
    let usedCount = 0;
    let expiredCount = 0;
    let urgentCount = 0;
    let freshCount = 0;
    let moneySavedRs = 0;
    let moneyWastedRs = 0;
    let unpricedUsedCount = 0;
    let unpricedExpiredCount = 0;
    let totalScansLogged = 0;
    let lowStockCount = 0;
    let totalActiveValueRs = 0;
    let valueAtRiskRs = 0;

    for (const item of items) {
      if (item.source === 'barcode' || item.source === 'receipt') {
        totalScansLogged++;
      }

      // Add any money saved through partial cooking or finished usage
      if (item.savedMoney && item.savedMoney > 0) {
        moneySavedRs += item.savedMoney;
      }

      if (item.status === 'active') {
        activeCount++;
        if (item.parLevel !== null && item.parLevel !== undefined && Number(item.quantity) <= Number(item.parLevel)) {
          lowStockCount++;
        }

        const remainingValue =
          item.price !== null && !isNaN(item.price)
            ? item.originalQuantity && item.originalQuantity > 0 && item.quantity < item.originalQuantity
              ? Math.round(item.price * (item.quantity / item.originalQuantity))
              : item.price
            : 0;
        totalActiveValueRs += remainingValue;

        const rem = getRemainingDays(item.estimatedExpiryDate);
        if (rem <= 2) {
          urgentCount++;
          valueAtRiskRs += remainingValue;
        } else {
          freshCount++;
        }
      } else if (item.status === 'used') {
        usedCount++;
        // If savedMoney wasn't set, default to item price
        if (!item.savedMoney || item.savedMoney === 0) {
          if (item.price !== null && !isNaN(item.price)) {
            moneySavedRs += item.price;
          } else {
            unpricedUsedCount++;
          }
        }
      } else if (item.status === 'expired') {
        expiredCount++;
        if (item.price !== null && !isNaN(item.price)) {
          moneyWastedRs += item.price;
        } else {
          unpricedExpiredCount++;
        }
      }
    }

    const totalResolved = usedCount + expiredCount;
    const savingPercentage = totalResolved > 0 ? Math.round((usedCount / totalResolved) * 100) : 100;
    const zeroWasteStreakDays = expiredCount === 0 && usedCount > 0 ? Math.min(14, usedCount + 2) : 5;

    return {
      totalLogged,
      activeCount,
      usedCount,
      expiredCount,
      urgentCount,
      freshCount,
      moneySavedRs,
      moneyWastedRs,
      unpricedUsedCount,
      unpricedExpiredCount,
      savingPercentage,
      zeroWasteStreakDays,
      totalScansLogged,
      lowStockCount,
      totalActiveValueRs,
      valueAtRiskRs,
    };
  }, [items]);

  return (
    <InventoryContext.Provider
      value={{
        items,
        customRecipes,
        restockList,
        mealPlans,
        suppliers,
        storageLogs,
        checklists,
        wasteLogs,
        invoices,
        activityLogs,
        preferences,
        dbInfo,
        dbConnected,
        authMode,
        authSource,
        handleAuthSuccess,
        lockWorkspace,
        notificationLog,
        addItem,
        addMultipleItems,
        updateItem,
        deleteItem,
        markAsUsed,
        markMultipleAsUsed,
        markAsExpired,
        markMultipleAsExpired,
        freezeAndExtendItem,
        markMultipleAsFrozen,
        saveCustomRecipe,
        deleteCustomRecipe,
        cookCustomRecipe,
        addToRestockList,
        updateRestockItem,
        removeFromRestockItem,
        syncNeededRestock,
        stockFromRestockList,
        bulkStockFromRestockList,
        saveMealPlan,
        deleteMealPlan,
        clearMealPlans,
        saveSupplier,
        deleteSupplier,
        addStorageLog,
        deleteStorageLog,
        transferItem,
        reconcileStocktake,
        saveChecklistItem,
        toggleChecklistItem,
        deleteChecklistItem,
        resetDailyChecklists,
        logWaste,
        deleteWasteLog,
        saveInvoice,
        updateInvoiceStatus,
        deleteInvoice,
        refreshActivityLogs,
        exportBackupJson,
        restoreBackupJson,
        updatePreferences,
        seedDemoData,
        clearAllData,
        exportCsv,
        refreshBackendData,
        stats,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
