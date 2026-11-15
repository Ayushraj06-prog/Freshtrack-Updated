/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack Backend API Client
 * Typed client for interacting with the backend SQLite database.
 */

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
} from '../types/inventory';

export const api = {
  async getDbInfo(): Promise<DbInfo> {
    const res = await fetch('/api/db/info');
    if (!res.ok) throw new Error(`Failed to get DB info: ${res.status}`);
    return res.json();
  },

  async fetchItems(): Promise<InventoryItem[]> {
    const res = await fetch('/api/items');
    if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async createItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to create item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async createMultipleItems(items: Omit<InventoryItem, 'id'>[]): Promise<InventoryItem[]> {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`Failed to create items: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async deleteItem(id: string): Promise<boolean> {
    const res = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete item: ${res.status}`);
    return true;
  },

  async markAsUsed(id: string, options?: { portion?: number; usedQuantity?: number; usedPortionName?: string }): Promise<InventoryItem> {
    const res = await fetch(`/api/items/${id}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) throw new Error(`Failed to mark used: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async markAsExpired(id: string): Promise<InventoryItem> {
    const res = await fetch(`/api/items/${id}/expire`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to mark expired: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async freezeAndExtendItem(id: string): Promise<InventoryItem> {
    const res = await fetch(`/api/items/${id}/freeze`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to freeze & extend: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async markMultipleAsUsed(ids: string[]): Promise<InventoryItem[]> {
    const res = await fetch('/api/items/bulk-use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk use: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async markMultipleAsExpired(ids: string[]): Promise<InventoryItem[]> {
    const res = await fetch('/api/items/bulk-expire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk expire: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async markMultipleAsFrozen(ids: string[]): Promise<InventoryItem[]> {
    const res = await fetch('/api/items/bulk-freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk freeze: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async seedDemoData(): Promise<InventoryItem[]> {
    const res = await fetch('/api/items/seed', {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to seed demo data: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async clearAllItems(): Promise<boolean> {
    const res = await fetch('/api/items/clear', {
      method: 'POST',
    });
    return res.ok;
  },

  async fetchPreferences(): Promise<UserPreferences> {
    const res = await fetch('/api/preferences');
    if (!res.ok) throw new Error(`Failed to fetch preferences: ${res.status}`);
    const data = await res.json();
    return data.preferences;
  },

  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update preferences: ${res.status}`);
    const data = await res.json();
    return data.preferences;
  },

  async fetchStats(): Promise<InventoryStats> {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
    const data = await res.json();
    return data.stats;
  },

  // Custom User Recipes
  async fetchCustomRecipes(): Promise<CustomRecipe[]> {
    const res = await fetch('/api/recipes/custom');
    if (!res.ok) throw new Error(`Failed to fetch custom recipes: ${res.status}`);
    const data = await res.json();
    return data.recipes || [];
  },

  async saveCustomRecipe(recipe: Partial<CustomRecipe>): Promise<CustomRecipe> {
    const res = await fetch('/api/recipes/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    if (!res.ok) throw new Error(`Failed to save custom recipe: ${res.status}`);
    const data = await res.json();
    return data.recipe;
  },

  async deleteCustomRecipe(id: string): Promise<boolean> {
    const res = await fetch(`/api/recipes/custom/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete custom recipe: ${res.status}`);
    return true;
  },

  async cookCustomRecipe(
    id: string,
    deductions: { itemId: string; portion?: number; usedQuantity?: number; usedPortionName?: string }[]
  ): Promise<{ recipe: CustomRecipe; updatedItems: InventoryItem[] }> {
    const res = await fetch(`/api/recipes/custom/${id}/cook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deductions }),
    });
    if (!res.ok) throw new Error(`Failed to log cooking of custom recipe: ${res.status}`);
    return await res.json();
  },

  // Restock / Need-to-Buy Procurement List
  async fetchRestockList(): Promise<RestockItem[]> {
    const res = await fetch('/api/restock');
    if (!res.ok) throw new Error(`Failed to fetch restock list: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  },

  async saveRestockItem(item: Partial<RestockItem>): Promise<RestockItem> {
    const res = await fetch('/api/restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to save restock item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async updateRestockItem(id: string, updates: Partial<RestockItem>): Promise<RestockItem> {
    const res = await fetch(`/api/restock/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update restock item: ${res.status}`);
    const data = await res.json();
    return data.item;
  },

  async deleteRestockItem(id: string): Promise<boolean> {
    const res = await fetch(`/api/restock/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete restock item: ${res.status}`);
    return true;
  },

  async syncNeededRestockItems(): Promise<{ addedCount: number; items: RestockItem[] }> {
    const res = await fetch('/api/restock/sync', {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to sync needed restock items: ${res.status}`);
    return await res.json();
  },

  async stockRestockItem(
    id: string,
    overrides?: StockFromRestockPayload
  ): Promise<{ stockedItem: InventoryItem; restockItem: RestockItem }> {
    const res = await fetch(`/api/restock/${id}/stock`, {
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
    const res = await fetch('/api/restock/bulk-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Failed to bulk stock restock items: ${res.status}`);
    return await res.json();
  },

  // Weekly Meal & Prep Planner
  async fetchMealPlans(): Promise<MealPlanEntry[]> {
    const res = await fetch('/api/meal-plans');
    if (!res.ok) throw new Error(`Failed to fetch meal plans: ${res.status}`);
    const data = await res.json();
    return data.plans || [];
  },

  async saveMealPlan(plan: Partial<MealPlanEntry>): Promise<MealPlanEntry> {
    const res = await fetch('/api/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!res.ok) throw new Error(`Failed to save meal plan: ${res.status}`);
    const data = await res.json();
    return data.plan;
  },

  async deleteMealPlan(id: string): Promise<boolean> {
    const res = await fetch(`/api/meal-plans/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete meal plan: ${res.status}`);
    return true;
  },

  async clearMealPlans(): Promise<boolean> {
    const res = await fetch('/api/meal-plans/clear', { method: 'POST' });
    return res.ok;
  },

  // Activity Logs
  async fetchActivityLogs(limit = 40): Promise<ActivityLogEntry[]> {
    const res = await fetch(`/api/activity?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch activity logs: ${res.status}`);
    const data = await res.json();
    return data.logs || [];
  },

  // Full JSON Backup & Restore
  async exportBackup(): Promise<any> {
    const res = await fetch('/api/backup');
    if (!res.ok) throw new Error(`Failed to export backup: ${res.status}`);
    const data = await res.json();
    return data.snapshot;
  },

  async restoreBackup(snapshot: any): Promise<any> {
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    });
    if (!res.ok) throw new Error(`Failed to restore backup: ${res.status}`);
    return await res.json();
  },
};

