/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { calculateExpiryDate, getRemainingDays } from '../data/shelfLifeData';
import { api } from '../services/api';
import {
  InventoryItem,
  UserPreferences,
  InventoryStats,
  DbInfo,
  UseItemPayload,
} from '../types/inventory';

interface InventoryContextType {
  items: InventoryItem[];
  preferences: UserPreferences;
  dbInfo: DbInfo | null;
  dbConnected: boolean;
  notificationLog: { id: string; title: string; message: string; timestamp: string }[];
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<string>;
  addMultipleItems: (items: Omit<InventoryItem, 'id'>[]) => Promise<string[]>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  markAsUsed: (id: string, options?: UseItemPayload) => Promise<void>;
  markMultipleAsUsed: (ids: string[]) => Promise<void>;
  markAsExpired: (id: string) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  seedDemoData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  exportCsv: () => void;
  refreshBackendData: () => Promise<void>;
  stats: InventoryStats;
}

const DEFAULT_PREFS: UserPreferences = {
  diet: 'veg',
  reminderLeadDays: 2,
  morningDigestEnabled: true,
  morningDigestTime: '08:30',
  defaultStorage: 'fridge',
};

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [notificationLog, setNotificationLog] = useState<
    { id: string; title: string; message: string; timestamp: string }[]
  >([]);

  // Load state from backend SQLite database on mount
  const refreshBackendData = async () => {
    try {
      const [backendItems, backendPrefs, info] = await Promise.all([
        api.fetchItems(),
        api.fetchPreferences(),
        api.getDbInfo(),
      ]);
      setItems(backendItems);
      if (backendPrefs) setPreferences(backendPrefs);
      setDbInfo(info);
      setDbConnected(true);
    } catch (err) {
      console.warn('Backend DB initial sync retry:', err);
      setDbConnected(false);
      // Local fallback if server is starting
      try {
        const saved = localStorage.getItem('freshtrack_inventory_backup');
        if (saved) setItems(JSON.parse(saved));
      } catch {}
    }
  };

  useEffect(() => {
    refreshBackendData();
  }, []);

  // Sync to local backup cache
  useEffect(() => {
    try {
      localStorage.setItem('freshtrack_inventory_backup', JSON.stringify(items));
    } catch {}
  }, [items]);

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
    } catch (err) {
      console.error('Failed to mark item as used in backend DB:', err);
    }
  };

  const markMultipleAsUsed = async (ids: string[]) => {
    const idSet = new Set(ids);
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) => (idSet.has(i.id) ? { ...i, status: 'used', usedAt: nowIso } : i))
    );
    try {
      await api.markMultipleAsUsed(ids);
      api.getDbInfo().then(setDbInfo).catch(() => {});
    } catch (err) {
      console.error('Failed to mark multiple items as used in DB:', err);
    }
  };

  const markAsExpired = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'expired' } : i)));
    try {
      await api.markAsExpired(id);
      api.getDbInfo().then(setDbInfo).catch(() => {});
    } catch (err) {
      console.error('Failed to mark item as expired:', err);
    }
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
    localStorage.removeItem('freshtrack_inventory_backup');
  };

  const exportCsv = () => {
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
    ];

    const rows = items.map((i) => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
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
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `freshtrack_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        const rem = getRemainingDays(item.estimatedExpiryDate);
        if (rem <= 2) {
          urgentCount++;
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
    };
  }, [items]);

  return (
    <InventoryContext.Provider
      value={{
        items,
        preferences,
        dbInfo,
        dbConnected,
        notificationLog,
        addItem,
        addMultipleItems,
        updateItem,
        deleteItem,
        markAsUsed,
        markMultipleAsUsed,
        markAsExpired,
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
