import { useState, useEffect, useCallback } from 'react';
import { CanvasItem, CanvasState, CanvasHistoryEntry, WalletAccount, InfoCardType } from '../types/canvas';
import { DEFAULT_INFO_CARD_TYPES } from '@/utils/infoCardTypes';
import {
  isBase64DataUrl,
  isIdbSentinel,
  makeIdbSentinel,
  sentinelId,
  base64ToBlob,
  putImage,
  deleteImage,
  offloadAllImagesInTree,
} from '@/utils/imageDB';
import { migrateImagesToIDB } from '@/utils/migrateImagesToIDB';

const mergeCanvasItems = (existingItems: CanvasItem[], importedItems: CanvasItem[]): CanvasItem[] => {
  const importedIds = new Set(importedItems.map((i) => i.id));
  const reIdedExisting = existingItems.map((item) =>
    importedIds.has(item.id) ? { ...item, id: crypto.randomUUID() } : item
  );
  return [...reIdedExisting, ...importedItems];
};

const STORAGE_KEY = 'black-board-data';

const initialState: CanvasState = {
  items: [],
  inbox: [],
  archive: [],
  backgroundColor: '#0f172a',
  zoom: 1,
  wallets: [
    { id: 'icici-cc',    name: 'ICICI CC',     accountType: 'Credit Card' },
    { id: 'axis-cc',     name: 'AXIS CC',      accountType: 'Credit Card' },
    { id: 'indusind-cc', name: 'IndusInd CC',  accountType: 'Credit Card' },
    { id: 'kmb',         name: 'KMB',          accountType: 'Savings' },
    { id: 'huf',         name: 'HUF',          accountType: 'Current' },
    { id: 'idfc',        name: 'IDFC',         accountType: 'Savings' },
    { id: 'dbs',         name: 'DBS',          accountType: 'Savings' },
    { id: 'icici',       name: 'ICICI',        accountType: 'Savings' },
    { id: 'cash',        name: 'Cash',         accountType: 'Debit Card' },
  ] as WalletAccount[],
  infoCardTypes: DEFAULT_INFO_CARD_TYPES,
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

/** Move a base64 image to IDB and return the sentinel, or return content unchanged. */
async function offloadImageIfNeeded(
  item: Omit<CanvasItem, 'id'> & { id?: string }
): Promise<typeof item> {
  if (item.type !== 'image' || !isBase64DataUrl(item.content)) return item;
  const id = crypto.randomUUID();
  const blob = await base64ToBlob(item.content);
  await putImage(id, blob);
  return { ...item, content: makeIdbSentinel(id) };
}

export const useCanvas = () => {
  const [state, setState] = useState<CanvasState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Run migration then load state
  useEffect(() => {
    (async () => {
      await migrateImagesToIDB();
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Migrate old Inbox canvas item → dedicated inbox array
          if (!Array.isArray(parsed.inbox)) {
            const oldInbox = parsed.items?.find((i: CanvasItem) => i.type === 'canvas' && i.content === 'Inbox');
            parsed.inbox = oldInbox?.children ?? [];
            if (oldInbox) {
              parsed.items = parsed.items.filter((i: CanvasItem) => !(i.type === 'canvas' && i.content === 'Inbox'));
            }
          }
          if (!Array.isArray(parsed.archive)) {
            parsed.archive = [];
          }
          if (!Array.isArray(parsed.wallets)) {
            parsed.wallets = initialState.wallets;
          }
          if (!Array.isArray(parsed.infoCardTypes)) {
            parsed.infoCardTypes = DEFAULT_INFO_CARD_TYPES;
          }
          setState(parsed);
        } catch (e) {
          console.error('Failed to load canvas state', e);
        }
      }
      setIsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isLoaded]);

  const addItemAtPath = useCallback(
    async (path: string[], item: Omit<CanvasItem, 'id'> & { id?: string }): Promise<string> => {
      const sanitised = await offloadImageIfNeeded(item);
      const id = sanitised.id || crypto.randomUUID();
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) => [
          ...items,
          { ...sanitised, id, createdAt: sanitised.createdAt ?? Date.now(), modifiedAt: Date.now() },
        ]),
      }));
      return id;
    },
    []
  );

  const batchUpdateAtPath = useCallback(
    (
      path: string[],
      updatesMap: Record<string, Partial<CanvasItem>>,
      options?: { silent?: boolean; historyActionLabel?: string }
    ) => {
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) =>
          items.map((item) => {
            const updates = updatesMap[item.id];
            if (updates) {
              const now = Date.now();
              const history = [...(item.history ?? [])];
              const pushHistory = (
                type: CanvasHistoryEntry['type'],
                action: string,
                snapshot?: string
              ) => {
                history.push({
                  id: crypto.randomUUID(),
                  type,
                  action,
                  timestamp: now,
                  ...(snapshot ? { snapshot } : {}),
                });
              };

              if (!options?.silent) {
                // Tags
                if (updates.tags) {
                  const oldTags = item.tags ?? [];
                  const newTags = updates.tags;
                  newTags
                    .filter((t) => !oldTags.includes(t))
                    .forEach((t) => pushHistory('tag', `Added tag: ${t}`));
                  oldTags
                    .filter((t) => !newTags.includes(t))
                    .forEach((t) => pushHistory('tag', `Removed tag: ${t}`));
                }

                // Date
                if (Object.hasOwn(updates, 'date') && updates.date !== item.date) {
                  if (updates.date && !item.date) pushHistory('date', `Added date: ${updates.date}`);
                  else if (!updates.date && item.date)
                    pushHistory('date', `Removed date (was: ${item.date})`);
                  else if (updates.date) pushHistory('date', `Changed date: ${item.date} → ${updates.date}`);
                }

                // Recurring
                if (Object.hasOwn(updates, 'recurring')) {
                  const oldR = item.recurring;
                  const newR = updates.recurring;
                  const rLabel = (r: import('@/types/canvas').RecurringRule | undefined) => {
                    if (!r) return 'None';
                    const freqMap: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
                    let s = r.interval > 1 ? `Every ${r.interval} ${r.freq}` : freqMap[r.freq] ?? r.freq;
                    if (r.freq === 'weekly' && r.days && r.days.length > 0) {
                      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                      s += ` (${r.days.map((d) => dayNames[d]).join(', ')})`;
                    }
                    if (r.endType === 'count' && r.endCount) s += `, ${r.endCount}×`;
                    else if (r.endType === 'date' && r.endDate) s += `, until ${r.endDate}`;
                    return s;
                  };
                  if (!oldR && newR) pushHistory('date', `Recurring enabled: ${rLabel(newR)}`);
                  else if (oldR && !newR) pushHistory('date', `Recurring removed (was: ${rLabel(oldR)})`);
                  else if (oldR && newR) pushHistory('date', `Recurring changed: ${rLabel(oldR)} → ${rLabel(newR)}`);
                }

                // Geometry (Move/Resize)
                const moved =
                  (updates.x !== undefined && updates.x !== item.x) ||
                  (updates.y !== undefined && updates.y !== item.y);
                const resized =
                  (updates.width !== undefined && updates.width !== item.width) ||
                  (updates.height !== undefined && updates.height !== item.height);

                if (moved) pushHistory('geometry', 'Moved block');
                if (resized) pushHistory('geometry', 'Resized block');

                // Timer
                if (updates.timer) {
                  if (updates.timer.isRunning && !item.timer?.isRunning) {
                    pushHistory(
                      'timer',
                      item.timer?.sessions?.length ? 'Resumed timer' : 'Started timer'
                    );
                  } else if (!updates.timer.isRunning && item.timer?.isRunning) {
                    pushHistory('timer', options?.historyActionLabel || 'Paused timer');
                  }
                }

                // Manual explicit label
                if (options?.historyActionLabel && !updates.timer) {
                  pushHistory('navigation', options.historyActionLabel);
                }
              }

              return {
                ...item,
                ...updates,
                modifiedAt: Date.now(),
                history: history.length > (item.history?.length ?? 0) ? history : item.history,
              };
            }
            return item;
          })
        ),
      }));
    },
    []
  );

  const updateItemAtPath = useCallback(
    (path: string[], id: string, updates: Partial<CanvasItem>, options?: { silent?: boolean; historyActionLabel?: string }) => {
      batchUpdateAtPath(path, { [id]: updates }, options);
    },
    [batchUpdateAtPath]
  );

  const logHistoryAtPath = useCallback(
    (path: string[], id: string, type: CanvasHistoryEntry['type'], action: string, snapshot?: string) => {
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) =>
          items.map((item) => {
            if (item.id === id) {
              const history = [...(item.history ?? [])];
              history.push({
                id: crypto.randomUUID(),
                type,
                action,
                snapshot,
                timestamp: Date.now(),
              });
              return { ...item, history };
            }
            return item;
          })
        ),
      }));
    },
    []
  );

  const removeItemAtPath = useCallback((path: string[], id: string) => {
    setState((prev) => {
      // Clean up IDB blob if this is an image item with a sentinel
      const targets = getItemsAtPath(prev.items, path);
      const dying = targets.find((i) => i.id === id);
      if (dying?.type === 'image' && isIdbSentinel(dying.content)) {
        deleteImage(sentinelId(dying.content)); // fire-and-forget
      }
      return {
        ...prev,
        items: updateItemsAtPath(prev.items, path, (items) =>
          items.filter((item) => item.id !== id)
        ),
      };
    });
  }, []);

  const moveItemAtPath = useCallback(
    (path: string[], id: string, x: number, y: number) => {
      batchUpdateAtPath(path, { [id]: { x, y } });
    },
    [batchUpdateAtPath]
  );

  /** Reorder canvas-type items within a parent. Non-canvas items keep their positions in the array. */
  const reorderCanvasAtPath = useCallback(
    (parentPath: string[], fromIndex: number, toIndex: number) => {
      setState((prev) => ({
        ...prev,
        items: updateItemsAtPath(prev.items, parentPath, (items) => {
          const canvases = items.filter((i) => i.type === 'canvas');
          if (fromIndex < 0 || fromIndex >= canvases.length) return items;
          const clampedTo = Math.max(0, Math.min(canvases.length - 1, toIndex));
          if (fromIndex === clampedTo) return items;
          const reordered = [...canvases];
          const [moved] = reordered.splice(fromIndex, 1);
          reordered.splice(clampedTo, 0, moved);
          let ci = 0;
          return items.map((i) => (i.type === 'canvas' ? reordered[ci++] : i));
        }),
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
    (id: string, updates: Partial<CanvasItem>, options?: { silent?: boolean; historyActionLabel?: string }) =>
      updateItemAtPath([], id, updates, options),
    [updateItemAtPath]
  );

  const batchUpdate = useCallback(
    (updatesMap: Record<string, Partial<CanvasItem>>, options?: { silent?: boolean; historyActionLabel?: string }) =>
      batchUpdateAtPath([], updatesMap, options),
    [batchUpdateAtPath]
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

        const history = [...(item.history ?? [])];
        if (item.type !== 'canvas') {
          const into = toPath.length > fromPath.length;
          history.push({
            id: crypto.randomUUID(),
            type: 'navigation',
            action: into ? 'Moved into sub-canvas' : 'Moved out to parent canvas',
            timestamp: Date.now(),
          });
        }

        const movedItem = {
          ...item,
          ...(newX !== undefined ? { x: newX, y: newY ?? item.y } : {}),
          history: history.length > (item.history?.length ?? 0) ? history : item.history,
        };

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

  const mergeItems = useCallback(async (importedItems: CanvasItem[]) => {
    const sanitised = await offloadAllImagesInTree(importedItems);
    setState((prev) => ({
      ...prev,
      items: mergeCanvasItems(prev.items, sanitised),
    }));
  }, []);

  const addToInbox = useCallback(
    async (item: Omit<CanvasItem, 'id'> & { id?: string }): Promise<string> => {
      const sanitised = await offloadImageIfNeeded(item);
      const id = sanitised.id || crypto.randomUUID();
      const history: CanvasHistoryEntry[] = [
        ...(sanitised.history ?? []),
        { id: crypto.randomUUID(), type: 'navigation', action: 'Sent to Inbox', timestamp: Date.now() },
      ];
      setState((prev) => ({
        ...prev,
        inbox: [...(prev.inbox ?? []), { ...sanitised, id, createdAt: sanitised.createdAt ?? Date.now(), history }],
      }));
      return id;
    },
    []
  );

  const removeFromInbox = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      inbox: (prev.inbox ?? []).filter((i) => i.id !== id),
    }));
  }, []);

  const updateInboxItem = useCallback((id: string, updates: Partial<CanvasItem>) => {
    setState((prev) => ({
      ...prev,
      inbox: (prev.inbox ?? []).map((i) => (i.id === id ? { ...i, ...updates, modifiedAt: Date.now() } : i)),
    }));
  }, []);

  const moveFromInboxToCanvas = useCallback(
    (item: CanvasItem, toPath: string[], newX?: number, newY?: number) => {
      setState((prev) => {
        const history: CanvasHistoryEntry[] = [
          ...(item.history ?? []),
          { id: crypto.randomUUID(), type: 'navigation', action: toPath.length > 0 ? 'Moved from Inbox to sub-canvas' : 'Moved from Inbox to board', timestamp: Date.now() },
        ];
        const movedItem = { ...item, history, ...(newX !== undefined ? { x: newX, y: newY ?? item.y } : {}) };
        const newItems = updateItemsAtPath(prev.items, toPath, (items) => [...items, movedItem]);
        return { ...prev, items: newItems, inbox: (prev.inbox ?? []).filter((i) => i.id !== item.id) };
      });
    },
    []
  );

  const addToArchive = useCallback(
    async (item: Omit<CanvasItem, 'id'> & { id?: string }): Promise<string> => {
      const sanitised = await offloadImageIfNeeded(item);
      const id = sanitised.id || crypto.randomUUID();
      const history: CanvasHistoryEntry[] = [
        ...(sanitised.history ?? []),
        { id: crypto.randomUUID(), type: 'navigation', action: 'Archived', timestamp: Date.now() },
      ];
      setState((prev) => ({
        ...prev,
        archive: [...(prev.archive ?? []), { ...sanitised, id, createdAt: sanitised.createdAt ?? Date.now(), history }],
      }));
      return id;
    },
    []
  );

  const removeFromArchive = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      archive: (prev.archive ?? []).filter((i) => i.id !== id),
    }));
  }, []);

  const updateArchiveItem = useCallback((id: string, updates: Partial<CanvasItem>) => {
    setState((prev) => ({
      ...prev,
      archive: (prev.archive ?? []).map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  }, []);

  const updateWallets = useCallback((wallets: WalletAccount[]) => {
    setState(prev => ({ ...prev, wallets }));
  }, []);

  const updateInfoCardTypes = useCallback((types: InfoCardType[]) => {
    setState(prev => ({ ...prev, infoCardTypes: types }));
  }, []);

  const renameTagGlobally = useCallback((oldTag: string, newTag: string) => {
    const renameInItems = (items: CanvasItem[]): CanvasItem[] =>
      items.map(item => ({
        ...item,
        tags: item.tags?.map(t => t === oldTag ? newTag : t),
        children: item.children ? renameInItems(item.children) : item.children,
      }));
    setState(prev => ({ ...prev, items: renameInItems(prev.items) }));
  }, []);

  const moveFromArchiveToCanvas = useCallback(
    (item: CanvasItem, toPath: string[], newX?: number, newY?: number) => {
      setState((prev) => {
        const history: CanvasHistoryEntry[] = [
          ...(item.history ?? []),
          { id: crypto.randomUUID(), type: 'navigation', action: toPath.length > 0 ? 'Restored from Archives to sub-canvas' : 'Restored from Archives', timestamp: Date.now() },
        ];
        const movedItem = { ...item, history, ...(newX !== undefined ? { x: newX, y: newY ?? item.y } : {}) };
        const newItems = updateItemsAtPath(prev.items, toPath, (items) => [...items, movedItem]);
        return { ...prev, items: newItems, archive: (prev.archive ?? []).filter((i) => i.id !== item.id) };
      });
    },
    []
  );

  return {
    state,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    batchUpdate,
    addItemAtPath,
    updateItemAtPath,
    removeItemAtPath,
    moveItemAtPath,
    reorderCanvasAtPath,
    batchUpdateAtPath,
    moveItemBetweenPaths,
    logHistoryAtPath,
    clearCanvas,
    loadState,
    mergeItems,
    isLoaded,
    addToInbox,
    removeFromInbox,
    updateInboxItem,
    moveFromInboxToCanvas,
    addToArchive,
    removeFromArchive,
    updateArchiveItem,
    moveFromArchiveToCanvas,
    updateWallets,
    updateInfoCardTypes,
    renameTagGlobally,
  };
};
