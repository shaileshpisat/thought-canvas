/**
 * Daily image backup — exports all IDB image blobs to a downloadable JSON file
 * once per calendar day, and provides a restore function that re-populates IDB
 * from a previously saved backup file.
 */

import { getImage, putImage, getAllImageIds } from '@/utils/imageDB';

const LAST_BACKUP_KEY = 'bb-last-image-backup-date';

function todayString(): string {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function getLastBackupDate(): string | null {
    return localStorage.getItem(LAST_BACKUP_KEY);
}

export function isDailyBackupDue(): boolean {
    const last = getLastBackupDate();
    return last !== todayString();
}

/** Serialise all blobs currently in IDB to a base64 JSON file and trigger download. */
export async function runDailyBackup(): Promise<void> {
    const allIdbIds = await getAllImageIds();

    if (allIdbIds.length === 0) {
        // Nothing to back up — still mark as done so we don't re-check all day
        localStorage.setItem(LAST_BACKUP_KEY, todayString());
        return;
    }

    const images: Record<string, string> = {};

    await Promise.all(
        allIdbIds.map(async (id) => {
            const blob = await getImage(id);
            if (!blob) return;
            const base64 = await blobToBase64(blob);
            images[id] = base64;
        })
    );

    if (Object.keys(images).length === 0) {
        localStorage.setItem(LAST_BACKUP_KEY, todayString());
        return;
    }

    const payload = JSON.stringify({ date: todayString(), version: 1, images });
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `thought-canvas-images-${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    localStorage.setItem(LAST_BACKUP_KEY, todayString());
}

/**
 * Given a backup JSON file and the set of broken sentinel IDs,
 * restores matching blobs into IDB. Returns the count restored.
 */
export async function restoreFromBackup(
    file: File,
    brokenIds: string[]
): Promise<number> {
    const text = await file.text();
    let data: { version: number; images: Record<string, string> };
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Invalid backup file — could not parse JSON.');
    }

    if (!data.images || typeof data.images !== 'object') {
        throw new Error('Invalid backup file — missing images map.');
    }

    const brokenSet = new Set(brokenIds);
    let restored = 0;

    await Promise.all(
        Object.entries(data.images).map(async ([id, base64]) => {
            if (!brokenSet.has(id)) return;
            if (typeof base64 !== 'string' || !base64.startsWith('data:image/')) return;
            const blob = await base64ToBlob(base64);
            await putImage(id, blob);
            restored++;
        })
    );

    return restored;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

async function base64ToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
}
