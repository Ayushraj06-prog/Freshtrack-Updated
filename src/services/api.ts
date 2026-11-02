/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * FreshTrack Backend API Client
 * Typed client for interacting with the backend SQLite database.
 */

import { InventoryItem, UserPreferences, InventoryStats, DbInfo } from '../types/inventory';

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

  async markAsUsed(id: string): Promise<InventoryItem> {
    const res = await fetch(`/api/items/${id}/use`, {
      method: 'POST',
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
};
