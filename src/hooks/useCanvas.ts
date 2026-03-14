import { useState, useEffect, useCallback } from 'react';
import { CanvasItem, CanvasState } from '../types/canvas';

const mergeCanvasItems = (existingItems: CanvasItem[], importedItems: CanvasItem[]): CanvasItem[] => {
  const importedIds = new Set(importedItems.map((i) => i.id));
  // Re-ID any existing items whose IDs collide with an imported item
  const reIdedExisting = existingItems.map((item) =>
    importedIds.has(item.id) ? { ...item, id: crypto.randomUUID() } : item
  );
  return [...reIdedExisting, ...importedItems];
};

const STORAGE_KEY = 'thought-canvas-data';

const initialState: CanvasState = {
  items: [],
  backgroundColor: '#0f172a',
  zoom: 1,
};

// Traverse nested canvas items to get items at a given path
export const getItemsAtPath = (items: CanvasItem[], path: string[]): CanvasItem[] => {
  if (path.length === 0) return items;
  const [head, ...tail] = path;
  const parent = items.find((i) => i.id === head);
  if (!parent || !parent.children) return [];
  return getItemsAtPath(parent.children, tail);
};

// Immutably update items at a nested path using an updater function
const updateItemsAtPath = (
  items: CanvasItem[],
  path: string[],
  updater: (items: CanvasItem[]) => CanvasItem[]
): CanvasItem[] => {
  if (path.length === 0) return updater(items);
  const [head, ...tail] = path;
  return items.map((item) =>
    item.id === head
      ? { ...item, children: updateItemsAtPath(item.children ?? [], tail, updater) }
      : item
  );
};

export const useCanvas = () => {
  const [state, setState] = useState<CanvasState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load canvas state', e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const addItemAtPath = useCallback(
    (path: string[], item: Omit<CanvasItem, 'id'> & { id?: string }) => {
      const id = item.id || crypto.randomUUID();
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) => [
          ...items,
          { ...item, id },
        ]),
      }));
      return id;
    },
    []
  );

  const updateItemAtPath = useCallback(
    (path: string[], id: string, updates: Partial<CanvasItem>) => {
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) =>
          items.map((item) => (item.id === id ? { ...item, ...updates } : item))
        ),
      }));
    },
    []
  );

  const removeItemAtPath = useCallback((path: string[], id: string) => {
    setState((prev) => ({
      ...prev,
      items: updateItemsAtPath(prev.items, path, (items) =>
        items.filter((item) => item.id !== id)
      ),
    }));
  }, []);

  const moveItemAtPath = useCallback(
    (path: string[], id: string, x: number, y: number) => {
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) =>
          items.map((item) => (item.id === id ? { ...item, x, y } : item))
        ),
      }));
    },
    []
  );

  // Root-level convenience wrappers (path = [])
  const addItem = useCallback(
    (item: Omit<CanvasItem, 'id'> & { id?: string }) =>
      addItemAtPath([], item),
    [addItemAtPath]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<CanvasItem>) =>
      updateItemAtPath([], id, updates),
    [updateItemAtPath]
  );

  const removeItem = useCallback(
    (id: string) => removeItemAtPath([], id),
    [removeItemAtPath]
  );

  const moveItem = useCallback(
    (id: string, x: number, y: number) => moveItemAtPath([], id, x, y),
    [moveItemAtPath]
  );

  const moveItemBetweenPaths = useCallback(
    (fromPath: string[], toPath: string[], item: CanvasItem, newX?: number, newY?: number) => {
      setState((prev) => {
        let newItems = updateItemsAtPath(prev.items, fromPath, (items) =>
          items.filter((i) => i.id !== item.id)
        );
        const movedItem = newX !== undefined ? { ...item, x: newX, y: newY ?? item.y } : item;
        newItems = updateItemsAtPath(newItems, toPath, (items) => [...items, movedItem]);
        return { ...prev, items: newItems };
      });
    },
    []
  );

  const clearCanvas = useCallback(() => {
    if (confirm('Are you sure you want to clear the entire canvas?')) {
      setState(initialState);
    }
  }, []);

  const loadState = useCallback((newState: CanvasState) => {
    setState(newState);
  }, []);

  const mergeItems = useCallback((importedItems: CanvasItem[]) => {
    setState((prev) => ({
      ...prev,
      items: mergeCanvasItems(prev.items, importedItems),
    }));
  }, []);

  return {
    state,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    addItemAtPath,
    updateItemAtPath,
    removeItemAtPath,
    moveItemAtPath,
    moveItemBetweenPaths,
    clearCanvas,
    loadState,
    mergeItems,
    isLoaded,
  };
};
