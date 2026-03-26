import { useState, useEffect, useCallback } from 'react';
import { STORAGE_LIMIT_BYTES, STORAGE_WARN_THRESHOLD } from '@/config/storageConfig';

export interface StorageInfo {
  /** Bytes used across all storage for this origin */
  usage: number;
  /** Effective quota: the configured app limit or the browser quota, whichever is smaller */
  quota: number;
  /** 0–1 fraction of quota used */
  fraction: number;
  /** true when fraction >= STORAGE_WARN_THRESHOLD */
  isNearLimit: boolean;
  /** true while the estimate is being fetched */
  loading: boolean;
}

const DEFAULT: StorageInfo = {
  usage: 0,
  quota: STORAGE_LIMIT_BYTES ?? 0,
  fraction: 0,
  isNearLimit: false,
  loading: true,
};

/**
 * Fetches storage usage once on mount. Call `refresh()` to re-fetch on demand
 * (e.g. when the user opens the StorageStats modal).
 * No polling — storage only changes when the user adds or removes items.
 */
export const useStorageMonitor = (): StorageInfo & { refresh: () => void } => {
  const [info, setInfo] = useState<StorageInfo>(DEFAULT);

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      // Fallback: estimate from localStorage only
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) total += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
      }
      const quota = STORAGE_LIMIT_BYTES ?? 5 * 1024 * 1024;
      const fraction = Math.min(total / quota, 1);
      setInfo({ usage: total, quota, fraction, isNearLimit: fraction >= STORAGE_WARN_THRESHOLD, loading: false });
      return;
    }

    try {
      const { usage = 0, quota: browserQuota = 0 } = await navigator.storage.estimate();
      const effectiveQuota = STORAGE_LIMIT_BYTES !== null
        ? Math.min(STORAGE_LIMIT_BYTES, browserQuota)
        : browserQuota;
      const fraction = effectiveQuota > 0 ? Math.min(usage / effectiveQuota, 1) : 0;
      setInfo({
        usage,
        quota: effectiveQuota,
        fraction,
        isNearLimit: fraction >= STORAGE_WARN_THRESHOLD,
        loading: false,
      });
    } catch {
      setInfo((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Fetch once on mount
  useEffect(() => { refresh(); }, [refresh]);

  return { ...info, refresh };
};
