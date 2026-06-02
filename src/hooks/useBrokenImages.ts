'use client';

import { useEffect, useState } from 'react';
import { CanvasItem } from '@/types/canvas';
import { isIdbSentinel, sentinelId, getImage } from '@/utils/imageDB';

/** Recursively collect all idb: sentinel IDs from a tree of canvas items. */
function collectSentinelIds(items: CanvasItem[]): string[] {
    const ids: string[] = [];
    for (const item of items) {
        if (item.type === 'image' && isIdbSentinel(item.content)) {
            ids.push(sentinelId(item.content));
        }
        if (item.children?.length) {
            ids.push(...collectSentinelIds(item.children));
        }
    }
    return ids;
}

export interface BrokenImagesState {
    brokenIds: string[];   // IDB IDs that have no blob
    checked: boolean;
    recheck: () => void;
}

/**
 * On mount (and on demand via recheck), walks all canvas items and tests each
 * idb: sentinel against IndexedDB. Any ID with no blob is reported as broken.
 */
export function useBrokenImages(items: CanvasItem[]): BrokenImagesState {
    const [brokenIds, setBrokenIds] = useState<string[]>([]);
    const [checked, setChecked] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const sentinelIds = collectSentinelIds(items);
        if (sentinelIds.length === 0) {
            setBrokenIds([]);
            setChecked(true);
            return;
        }

        let cancelled = false;
        Promise.all(
            sentinelIds.map(async (id) => {
                const blob = await getImage(id);
                return blob ? null : id;
            })
        ).then((results) => {
            if (cancelled) return;
            setBrokenIds(results.filter((id): id is string => id !== null));
            setChecked(true);
        });

        return () => { cancelled = true; };
    }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
    // items intentionally excluded — we only re-check on mount and explicit recheck

    const recheck = () => setTick((t) => t + 1);

    return { brokenIds, checked, recheck };
}
