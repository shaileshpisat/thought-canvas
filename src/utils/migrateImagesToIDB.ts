import { isBase64DataUrl, offloadAllImagesInTree } from './imageDB';
import type { CanvasState } from '@/types/canvas';

const STORAGE_KEY = 'thought-canvas-data';

/**
 * One-time migration: moves base64 image content from localStorage into IndexedDB.
 * Safe to call on every startup — items already using sentinels are left untouched.
 * Runs before useCanvas sets state, so the hook always sees the migrated data.
 */
export async function migrateImagesToIDB(): Promise<void> {
  if (typeof window === 'undefined') return;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let state: CanvasState;
  try {
    state = JSON.parse(raw) as CanvasState;
  } catch {
    return; // corrupt data — leave it for the hook to handle
  }

  // Quick check: if no base64 images exist anywhere in the raw JSON, skip
  if (!raw.includes('data:image/')) return;

  try {
    const migratedItems = await offloadAllImagesInTree(state.items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, items: migratedItems }));
  } catch (e) {
    // Migration failed — log and continue. The app will still work with base64.
    console.error('[migrateImagesToIDB] Migration failed, continuing with localStorage data', e);
  }
}
