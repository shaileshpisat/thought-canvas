import { useState, useEffect, useCallback } from 'react';
import { CanvasItem, RecycleBinItem } from '@/types/canvas';

const STORAGE_KEY = 'black-board-recycle-bin';
const MAX_AGE_DAYS = 45;

function purgeExpired(items: RecycleBinItem[]): RecycleBinItem[] {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.deletedAt).getTime() > cutoff);
}

function loadFromStorage(): RecycleBinItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecycleBinItem[];
    return purgeExpired(parsed);
  } catch {
    return [];
  }
}

function saveToStorage(items: RecycleBinItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save recycle bin', e);
  }
}

export function useRecycleBin() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);

  // Load and auto-purge on mount
  useEffect(() => {
    const loaded = loadFromStorage();
    setItems(loaded);
    saveToStorage(loaded); // persist the purged version immediately
  }, []);

  // Persist to localStorage whenever items change
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addItem = useCallback((item: CanvasItem, canvasColor?: string) => {
    const binItem: RecycleBinItem = {
      ...item,
      deletedAt: new Date().toISOString(),
      ...(canvasColor ? { originalCanvasColor: canvasColor } : {}),
    };
    setItems((prev) => [binItem, ...prev]);
  }, []);

  const restoreItem = useCallback((id: string): RecycleBinItem | null => {
    let restored: RecycleBinItem | null = null;
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) restored = found;
      return prev.filter((i) => i.id !== id);
    });
    return restored;
  }, []);

  const deletePermanently = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const emptyBin = useCallback(() => {
    setItems([]);
  }, []);

  const daysRemaining = (item: RecycleBinItem): number => {
    const deletedMs = new Date(item.deletedAt).getTime();
    const expiresMs = deletedMs + MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const remaining = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  };

  return {
    items,
    addItem,
    restoreItem,
    deletePermanently,
    emptyBin,
    daysRemaining,
    count: items.length,
  };
}
