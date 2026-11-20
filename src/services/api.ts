/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FreshTrack Backend API Client
 * Authenticated typed client for interacting with the hardened SQLite backend.
 */

import { authFetch, setAuthToken, clearAuthToken } from './authSession';
import {
  InventoryItem,
  UserPreferences,
  InventoryStats,
  DbInfo,
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

export interface AuthStatusResponse {
  configured: boolean;
  source: 'env' | 'database' | 'unclaimed';
  authenticated: boolean;
  expiresAt: string | null;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error && typeof data.error === 'string') return data.error;
  } catch {}
  return `${fallback} (${res.status})`;
}

export const api = {
  // ---------------- Authentication & Security ----------------
  async getAuthStatus(): Promise<AuthStatusResponse> {
    const res = await authFetch('/api/auth/status');
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to check security status'));
    return res.json();
  },

  async setupWorkspacePasscode(passcode: string): Promise<{ token: string; expiresAt: string }> {
    const res = await authFetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to configure passcode'));
    const data = await res.json();
    if (data.token) setAuthToken(data.token);
    return data;
  },

  async loginWorkspace(passcode: string): Promise<{ token: string; expiresAt: string }> {
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Sign in failed'));
    const data = await res.json();
    if (data.token) setAuthToken(data.token);
    return data;
  },

  async logoutWorkspace(): Promise<void> {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearAuthToken();
  },

  async changeWorkspacePasscode(currentPasscode: string, newPasscode: string): Promise<void> {
    const res = await authFetch('/api/auth/change-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPasscode, newPasscode }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to update passcode'));
    const data = await res.json();
    if (data.token) setAuthToken(data.token);
  },

  async downloadProjectZip(): Promise<void> {
    const res = await authFetch('/api/download-zip');
    if (!res.ok) throw new Error(await parseErrorMessage(res, 'Failed to download archive'));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'freshtrack-kitchen-app.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  // ---------------- Core Inventory & Database ----------------
  async getDbInfo(): Promise<DbInfo> {
    const res = await authFetch('/api/db/info');
    if (!res.ok) throw new Error(`Failed to get DB info: ${res.status}`);
    return res.json();
  },

  async fetchItems(): Promise<InventoryItem[]> {
    const res = await authFetch('/api/items');
    if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async createItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
    const res = await authFetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to create item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async createMultipleItems(items: Omit<InventoryItem, 'id'>[]): Promise<InventoryItem[]> {
    const res = await authFetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`Failed to create items: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await authFetch(`/api/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async deleteItem(id: string): Promise<boolean> {
    const res = await authFetch(`/api/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete item: ${res.status}`);
    return true;
  },

  async markAsUsed(id: string, options?: { portion?: number; usedQuantity?: number; usedPortionName?: string }): Promise<InventoryItem> {
    const res = await authFetch(`/api/items/${encodeURIComponent(id)}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) throw new Error(`Failed to mark used: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async markAsExpired(id: string): Promise<InventoryItem> {
    const res = await authFetch(`/api/items/${encodeURIComponent(id)}/expire`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to mark expired: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async freezeAndExtendItem(id: string): Promise<InventoryItem> {
    const res = await authFetch(`/api/items/${encodeURIComponent(id)}/freeze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to freeze & extend: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async markMultipleAsUsed(ids: string[]): Promise<InventoryItem[]> {
    const res = await authFetch('/api/items/bulk-use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk use: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async markMultipleAsExpired(ids: string[]): Promise<InventoryItem[]> {
    const res = await authFetch('/api/items/bulk-expire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk expire: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async markMultipleAsFrozen(ids: string[]): Promise<InventoryItem[]> {
    const res = await authFetch('/api/items/bulk-freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk freeze: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async seedDemoData(): Promise<InventoryItem[]> {
    const res = await authFetch('/api/items/seed', {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to seed demo data: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async clearAllItems(): Promise<boolean> {
    const res = await authFetch('/api/items/clear', {
      method: 'POST',
    });
    return res.ok;
  },

  async fetchPreferences(): Promise<UserPreferences> {
    const res = await authFetch('/api/preferences');
    if (!res.ok) throw new Error(`Failed to fetch preferences: ${res.status}`);
    const data = await res.json();
    return data.preferences;
  },

  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await authFetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update preferences: ${res.status}`);
    const data = await res.json();
    return data.preferences;
  },

  async fetchStats(): Promise<InventoryStats> {
    const res = await authFetch('/api/stats');
    if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
    const data = await res.json();
    return data.stats;
  },

  // Custom User Recipes
  async fetchCustomRecipes(): Promise<CustomRecipe[]> {
    const res = await authFetch('/api/recipes/custom');
    if (!res.ok) throw new Error(`Failed to fetch custom recipes: ${res.status}`);
    const data = await res.json();
    return data.recipes || [];
  },

  async saveCustomRecipe(recipe: Partial<CustomRecipe>): Promise<CustomRecipe> {
    const res = await authFetch('/api/recipes/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    if (!res.ok) throw new Error(`Failed to save custom recipe: ${res.status}`);
    const data = await res.json();
    return data.recipe;
  },

  async deleteCustomRecipe(id: string): Promise<boolean> {
    const res = await authFetch(`/api/recipes/custom/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete custom recipe: ${res.status}`);
    return true;
  },

  async cookCustomRecipe(
    id: string,
    deductions: { itemId: string; portion?: number; usedQuantity?: number; usedPortionName?: string }[]
  ): Promise<{ recipe: CustomRecipe; updatedItems: InventoryItem[] }> {
    const res = await authFetch(`/api/recipes/custom/${encodeURIComponent(id)}/cook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deductions }),
    });
    if (!res.ok) throw new Error(`Failed to log cooking of custom recipe: ${res.status}`);
    return await res.json();
  },

  // Restock / Need-to-Buy Procurement List
  async fetchRestockList(): Promise<RestockItem[]> {
    const res = await authFetch('/api/restock');
    if (!res.ok) throw new Error(`Failed to fetch restock list: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async saveRestockItem(item: Partial<RestockItem>): Promise<RestockItem> {
    const res = await authFetch('/api/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to save restock item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async updateRestockItem(id: string, updates: Partial<RestockItem>): Promise<RestockItem> {
    const res = await authFetch(`/api/restock/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update restock item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async deleteRestockItem(id: string): Promise<boolean> {
    const res = await authFetch(`/api/restock/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete restock item: ${res.status}`);
    return true;
  },

  async syncNeededRestockItems(): Promise<{ addedCount: number; items: RestockItem[] }> {
    const res = await authFetch('/api/restock/sync', {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to sync needed restock items: ${res.status}`);
    return await res.json();
  },

  async stockRestockItem(
    id: string,
    overrides?: StockFromRestockPayload
  ): Promise<{ stockedItem: InventoryItem; restockItem: RestockItem }> {
    const res = await authFetch(`/api/restock/${encodeURIComponent(id)}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {}),
    });
    if (!res.ok) throw new Error(`Failed to stock restock item: ${res.status}`);
    return await res.json();
  },

  async bulkStockRestockItems(
    ids: string[]
  ): Promise<{ stockedItems: InventoryItem[]; restockItems: RestockItem[] }> {
    const res = await authFetch('/api/restock/bulk-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk stock restock items: ${res.status}`);
    return await res.json();
  },

  // Weekly Meal & Prep Planner
  async fetchMealPlans(): Promise<MealPlanEntry[]> {
    const res = await authFetch('/api/meal-plans');
    if (!res.ok) throw new Error(`Failed to fetch meal plans: ${res.status}`);
    const data = await res.json();
    return data.plans || [];
  },

  async saveMealPlan(plan: Partial<MealPlanEntry>): Promise<MealPlanEntry> {
    const res = await authFetch('/api/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!res.ok) throw new Error(`Failed to save meal plan: ${res.status}`);
    const data = await res.json();
    return data.plan;
  },

  async deleteMealPlan(id: string): Promise<boolean> {
    const res = await authFetch(`/api/meal-plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete meal plan: ${res.status}`);
    return true;
  },

  async clearMealPlans(): Promise<boolean> {
    const res = await authFetch('/api/meal-plans/clear', { method: 'POST' });
    return res.ok;
  },

  // Activity Logs
  async fetchActivityLogs(limit = 40): Promise<ActivityLogEntry[]> {
    const res = await authFetch(`/api/activity?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch activity logs: ${res.status}`);
    const data = await res.json();
    return data.logs || [];
  },

  // Full JSON Backup & Restore
  async exportBackup(): Promise<any> {
    const res = await authFetch('/api/backup');
    if (!res.ok) throw new Error(`Failed to export backup: ${res.status}`);
    const data = await res.json();
    return data.snapshot;
  },

  async restoreBackup(snapshot: any): Promise<any> {
    const res = await authFetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    });
    if (!res.ok) throw new Error(`Failed to restore backup: ${res.status}`);
    return await res.json();
  },

  // Suppliers Directory
  async fetchSuppliers(): Promise<Supplier[]> {
    const res = await authFetch('/api/suppliers');
    if (!res.ok) throw new Error(`Failed to fetch suppliers: ${res.status}`);
    const data = await res.json();
    return data.suppliers || [];
  },

  async saveSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    const res = await authFetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier),
    });
    if (!res.ok) throw new Error(`Failed to save supplier: ${res.status}`);
    const data = await res.json();
    return data.supplier;
  },

  async deleteSupplier(id: string): Promise<boolean> {
    const res = await authFetch(`/api/suppliers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete supplier: ${res.status}`);
    return true;
  },

  // Storage Temperature & Hygiene Logs
  async fetchStorageLogs(limit = 60): Promise<StorageLog[]> {
    const res = await authFetch(`/api/storage-logs?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch storage logs: ${res.status}`);
    const data = await res.json();
    return data.logs || [];
  },

  async addStorageLog(entry: Partial<StorageLog>): Promise<StorageLog> {
    const res = await authFetch('/api/storage-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`Failed to add storage log: ${res.status}`);
    const data = await res.json();
    return data.log;
  },

  async deleteStorageLog(id: string): Promise<boolean> {
    const res = await authFetch(`/api/storage-logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete storage log: ${res.status}`);
    return true;
  },

  // Inter-Zone / Branch Stock Transfer
  async transferItem(
    id: string,
    payload: TransferItemPayload
  ): Promise<{ sourceItem: InventoryItem; transferredItem: InventoryItem | null }> {
    const res = await authFetch(`/api/items/${encodeURIComponent(id)}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to transfer item: ${res.status}`);
    return await res.json();
  },

  // Physical Stocktake & Variance Reconciliation
  async reconcileStocktake(entries: StocktakeEntryPayload[]): Promise<StocktakeResult> {
    const res = await authFetch('/api/stocktake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error(`Failed to reconcile stocktake: ${res.status}`);
    return await res.json();
  },

  // Daily Kitchen Checklists & Shift Handover
  async fetchChecklists(): Promise<ChecklistItem[]> {
    const res = await authFetch('/api/checklists');
    if (!res.ok) throw new Error(`Failed to fetch checklists: ${res.status}`);
    const data = await res.json();
    return data.checklists || [];
  },

  async saveChecklistItem(entry: Partial<ChecklistItem>): Promise<ChecklistItem> {
    const res = await authFetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`Failed to save checklist item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async toggleChecklistItem(id: string): Promise<ChecklistItem> {
    const res = await authFetch(`/api/checklists/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to toggle checklist item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async deleteChecklistItem(id: string): Promise<boolean> {
    const res = await authFetch(`/api/checklists/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete checklist item: ${res.status}`);
    return true;
  },

  async resetDailyChecklists(): Promise<ChecklistItem[]> {
    const res = await authFetch('/api/checklists/reset', { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to reset daily checklists: ${res.status}`);
    const data = await res.json();
    return data.checklists || [];
  },

  // Root-Cause Waste Logs
  async fetchWasteLogs(limit = 100): Promise<WasteLogEntry[]> {
    const res = await authFetch(`/api/waste-logs?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch waste logs: ${res.status}`);
    const data = await res.json();
    return data.logs || [];
  },

  async logWaste(
    payload: LogWastePayload
  ): Promise<{ log: WasteLogEntry; updatedItem: InventoryItem | null }> {
    const res = await authFetch('/api/waste-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to log waste: ${res.status}`);
    return await res.json();
  },

  async deleteWasteLog(id: string): Promise<boolean> {
    const res = await authFetch(`/api/waste-logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete waste log: ${res.status}`);
    return true;
  },

  // Purchase Invoices & Spend Ledger
  async fetchInvoices(limit = 100): Promise<PurchaseInvoice[]> {
    const res = await authFetch(`/api/invoices?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch invoices: ${res.status}`);
    const data = await res.json();
    return data.invoices || [];
  },

  async saveInvoice(entry: Partial<PurchaseInvoice>): Promise<PurchaseInvoice> {
    const res = await authFetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`Failed to save invoice: ${res.status}`);
    const data = await res.json();
    return data.invoice;
  },

  async updateInvoiceStatus(id: string, paymentStatus: InvoiceStatus): Promise<PurchaseInvoice> {
    const res = await authFetch(`/api/invoices/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus }),
    });
    if (!res.ok) throw new Error(`Failed to update invoice status: ${res.status}`);
    const data = await res.json();
    return data.invoice;
  },

  async deleteInvoice(id: string): Promise<boolean> {
    const res = await authFetch(`/api/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete invoice: ${res.status}`);
    return true;
  },
};
