/**
 * Thin IndexedDB wrapper for storing image blobs.
 * Database: "thought-canvas-images", object store: "images", keys: UUID strings.
 */

const DB_NAME = 'thought-canvas-images';
const DB_VERSION = 1;
const STORE = 'images';

// ─── Sentinel helpers ────────────────────────────────────────────────────────

export const IDB_PREFIX = 'idb:';
export const isIdbSentinel = (s: string) => s.startsWith(IDB_PREFIX);
export const makeIdbSentinel = (id: string) => `${IDB_PREFIX}${id}`;
export const sentinelId = (sentinel: string) => sentinel.slice(IDB_PREFIX.length);

// ─── Base64 helpers ──────────────────────────────────────────────────────────

export const isBase64DataUrl = (s: string) => s.startsWith('data:image/');

export async function base64ToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ─── IDB connection ──────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function putImage(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(blob, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getImage(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllImageIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Tree offload ─────────────────────────────────────────────────────────────

import type { CanvasItem } from '@/types/canvas';

/**
 * Recursively walks a tree of CanvasItems. For every image item whose content
 * is a raw base64 data URL, stores the blob in IndexedDB and replaces content
 * with the sentinel string. Returns a new tree (items are cloned only when
 * modified). Safe to call on already-migrated data — sentinels are left as-is.
 */
export async function offloadAllImagesInTree(items: CanvasItem[]): Promise<CanvasItem[]> {
  return Promise.all(
    items.map(async (item) => {
      // Recurse into canvas children first
      const children = item.children
        ? await offloadAllImagesInTree(item.children)
        : undefined;

      if (item.type === 'image' && isBase64DataUrl(item.content)) {
        const id = crypto.randomUUID();
        const blob = await base64ToBlob(item.content);
        await putImage(id, blob);
        return { ...item, content: makeIdbSentinel(id), ...(children ? { children } : {}) };
      }

      if (children && children !== item.children) {
        return { ...item, children };
      }
      return item;
    })
  );
}
