import { useCallback } from 'react';

const TRACKER_KEY = 'thought-canvas-img-tracker';
const IMAGES_PER_DAY_THRESHOLD = 5;

interface TrackerRecord {
  date: string;   // 'YYYY-MM-DD'
  count: number;  // images added today
  lastChecked: string; // 'YYYY-MM-DD' — date of last storage check
}

const today = () => new Date().toISOString().slice(0, 10);

const readTracker = (): TrackerRecord => {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (raw) return JSON.parse(raw) as TrackerRecord;
  } catch { /* ignore */ }
  return { date: today(), count: 0, lastChecked: '' };
};

const writeTracker = (record: TrackerRecord) => {
  localStorage.setItem(TRACKER_KEY, JSON.stringify(record));
};

/**
 * Returns `trackImageAdded` — call it every time the user adds or pastes an
 * image. It decides whether a storage check is due and, if so, calls
 * `onCheckNeeded` so the caller can invoke `refresh()` on useStorageMonitor.
 *
 * A check is triggered when either:
 *   - 5 images have been added today (IMAGES_PER_DAY_THRESHOLD), OR
 *   - the last check was on a previous calendar day (daily check).
 *
 * After a check the counter resets to 0 and lastChecked is updated to today.
 */
export const useImageStorageTracker = (onCheckNeeded: () => void) => {
  const trackImageAdded = useCallback(() => {
    const t = today();
    const record = readTracker();

    // Reset counter if it's a new day
    const isNewDay = record.date !== t;
    const count = isNewDay ? 1 : record.count + 1;
    const lastChecked = isNewDay ? record.lastChecked : record.lastChecked;

    const dailyCheckDue = record.lastChecked !== t;
    const thresholdReached = count >= IMAGES_PER_DAY_THRESHOLD;

    if (dailyCheckDue || thresholdReached) {
      writeTracker({ date: t, count: 0, lastChecked: t });
      onCheckNeeded();
    } else {
      writeTracker({ date: t, count, lastChecked });
    }
  }, [onCheckNeeded]);

  return { trackImageAdded };
};
