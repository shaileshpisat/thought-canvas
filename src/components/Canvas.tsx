'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useCanvas, getItemsAtPath } from '@/hooks/useCanvas';
import { CanvasItem as CanvasItemComponent } from './CanvasItem';
import {
    Plus,
    Type,
    Image as ImageIcon,
    Link as LinkIcon,
    Activity,
    Layers,
    Home,
    ChevronRight,
    Network,
    Download,
    Upload,
    CalendarDays,
    CalendarRange,
    ClipboardList,
    ChevronLeft,
    Search,
    Settings,
    LayoutGrid,
    Undo2,
    Pause,
    Play,
    Square,
    Timer,
    UserCircle,
    Inbox,
    RotateCcw,
    Archive,
    IndianRupee,
    Trash2,
} from 'lucide-react';
import { StorageStats } from './StorageStats';
import { StorageWarningBanner } from './StorageWarningBanner';
import { SearchPanel } from './SearchPanel';
import { DateFilterPanel } from './DateFilterPanel';
import { CalendarBoard } from './CalendarBoard';
import { PlanBoard } from './PlanBoard';
import { WeekBoard } from './WeekBoard';
import { QuickEntryBar, SubCanvasSuggestion } from './QuickEntryBar';
import { getAllSubCanvases } from '@/utils/searchUtils';
import { CHANGELOG } from '@/data/changelog';


import { findEmptyLocation, organizeItems } from '@/utils/canvasUtils';
import { ITEM_DEFAULTS } from '@/utils/canvasConstants';
import { flattenItems, getDateStatus, getDateBucket } from '@/utils/dateUtils';
import { CanvasItem, WalletAccount, WalletAccountType } from '@/types/canvas';
import { useStorageMonitor } from '@/hooks/useStorageMonitor';
import { useImageStorageTracker } from '@/hooks/useImageStorageTracker';
import { isIdbSentinel, sentinelId, getImage } from '@/utils/imageDB';
import type { CanvasItem as ICanvasItem } from '@/types/canvas';
import { useRecycleBin } from '@/hooks/useRecycleBin';
import { RecycleBin } from './RecycleBin';
import { CanvasSitemapPanel } from './CanvasSitemapPanel';

function canvasTotalNet(items: CanvasItem[]): number {
    return flattenItems(items).reduce((sum, item) => {
        return sum + (item.financials ?? []).reduce((s, f) => {
            const pos = f.type === 'income' || f.type === 'inflow' || f.type === 'redemption';
            return s + (pos ? f.amount : -f.amount);
        }, 0);
    }, 0);
}

const getBreadcrumbLabels = (items: CanvasItem[], path: string[]): string[] => {
    const labels: string[] = [];
    let current = items;
    for (const id of path) {
        const item = current.find((i) => i.id === id);
        if (!item) break;
        labels.push(item.content || 'Untitled Canvas');
        current = item.children ?? [];
    }
    return labels;
};

export const Canvas: React.FC = () => {
    const {
        state,
        addItemAtPath,
        updateItemAtPath,
        removeItemAtPath,
        moveItemAtPath,
        moveItemBetweenPaths,
        logHistoryAtPath,
        batchUpdate,
        batchUpdateAtPath,
        clearCanvas,
        mergeItems,
        isLoaded,
        addToInbox,
        removeFromInbox,
        moveFromInboxToCanvas,
        updateInboxItem,
        addToArchive,
        removeFromArchive,
        updateArchiveItem,
        moveFromArchiveToCanvas,
        updateWallets,
    } = useCanvas();
    const recycleBin = useRecycleBin();
    const [showRecycleBin, setShowRecycleBin] = React.useState(false);
    const [showSitemap, setShowSitemap] = React.useState(false);
    const [showStats, setShowStats] = React.useState(false);
    const [showSearch, setShowSearch] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showWalletMaster, setShowWalletMaster] = React.useState(false);
    const [showProfileMenu, setShowProfileMenu] = React.useState(false);
    const [highlightedItemId, setHighlightedItemId] = React.useState<string | null>(null);
    const [recurringDays, setRecurringDays] = React.useState<number>(() => {
        try {
            const s = localStorage.getItem('black-board-settings');
            return s ? (JSON.parse(s).recurringDays ?? 30) : 30;
        } catch { return 30; }
    });
    const [showDateCalendar, setShowDateCalendar] = React.useState(false);
    const [showChangelog, setShowChangelog] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<'canvas' | 'calendar' | 'plan' | 'week' | 'inbox' | 'archive'>('canvas');
    const [inboxResurfaceFilter, setInboxResurfaceFilter] = React.useState(false);
    const [dateFilterDate, setDateFilterDate] = React.useState<string | null>(null);

    const [navigationPath, setNavigationPath] = React.useState<string[]>([]);
    const [preOrganizeSnapshot, setPreOrganizeSnapshot] = React.useState<
        { id: string; x: number; y: number; width?: number; height?: number }[] | null
    >(null);
    const [hoverCalMonth, setHoverCalMonth] = useState<Date>(() => {
        const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [tagMaster, setTagMaster] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        let tags = localStorage.getItem('black-board-tags');
        if (!tags) {
            tags = localStorage.getItem('thought-canvas-tags');
            if (tags) localStorage.setItem('black-board-tags', tags);
        }
        try { return JSON.parse(tags || '[]'); } catch { return []; }
    });
    const [ageFilter, setAgeFilter] = useState(10); // 10 = All, 0 = Older
    const [clockTick, setClockTick] = useState(0);
    const [alertingIds, setAlertingIds] = useState<Set<string>>(new Set());
    const lastAlertRef = useRef<number>(0);
    const stateRef = useRef(state);
    const { refresh: refreshStorage } = useStorageMonitor();
    const { trackImageAdded } = useImageStorageTracker(refreshStorage);

    const canvasRef = useRef<HTMLDivElement>(null);
    const importRef = useRef<HTMLInputElement>(null);

    /** Recursively re-hydrates IDB sentinel strings back to base64 data URLs for export. */
    const rehydrateItemsForExport = async (items: ICanvasItem[]): Promise<ICanvasItem[]> =>
        Promise.all(
            items.map(async (item) => {
                const children = item.children
                    ? await rehydrateItemsForExport(item.children)
                    : undefined;
                if (item.type === 'image' && isIdbSentinel(item.content)) {
                    const iblob = await getImage(sentinelId(item.content));
                    if (iblob) {
                        const base64 = await new Promise<string>((res) => {
                            const fr = new FileReader();
                            fr.onload = () => res(fr.result as string);
                            fr.readAsDataURL(iblob);
                        });
                        return { ...item, content: base64, ...(children ? { children } : {}) };
                    }
                }
                return children ? { ...item, children } : item;
            })
        );

    const handleExport = async () => {
        const rehydrated = await rehydrateItemsForExport(state.items);
        const exportState = { ...state, items: rehydrated };
        const json = JSON.stringify(exportState, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `black-board-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed && Array.isArray(parsed.items)) {
                    mergeItems(parsed.items);
                } else {
                    alert('Invalid canvas file.');
                }
            } catch {
                alert('Failed to read file.');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    // Find an item anywhere in the tree; returns { item, path } where path is the parent path for updateItemAtPath
    const findItemAnywhere = (id: string): { item: CanvasItem; path: string[] } | null => {
        const search = (items: CanvasItem[], path: string[]): { item: CanvasItem; path: string[] } | null => {
            for (const i of items) {
                if (i.id === id) return { item: i, path };
                if (i.children) {
                    const found = search(i.children, [...path, i.id]);
                    if (found) return found;
                }
            }
            return null;
        };
        return search(stateRef.current.items, []);
    };

    // Refs so paste handler never captures stale values
    const navigationPathRef = useRef(navigationPath);
    navigationPathRef.current = navigationPath;
    const showSearchRef = useRef(showSearch);
    showSearchRef.current = showSearch;
    const viewModeRef = useRef(viewMode);
    viewModeRef.current = viewMode;
    const currentItemsRef = useRef<CanvasItem[]>([]);

    const rawCurrentItems = getItemsAtPath(state.items, navigationPath);

    const ageFilteredItems = React.useMemo(() => {
        if (ageFilter === 10) return rawCurrentItems;
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();
        const yesterdayStart = todayStart - 86400000;
        const dow = today.getDay(); // 0=Sun
        const daysToMon = dow === 0 ? 6 : dow - 1;
        const thisWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysToMon, 0, 0, 0, 0).getTime();
        const lastWeekStart = thisWeekStart - 7 * 86400000;
        const prevWeekStart = lastWeekStart - 7 * 86400000;
        const prev2WeekStart = prevWeekStart - 7 * 86400000;
        const thisMonStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0).getTime();
        const lastMonStart = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
        const prev2MonStart = new Date(today.getFullYear(), today.getMonth() - 2, 1, 0, 0, 0, 0).getTime();
        const now = Date.now();
        return rawCurrentItems.filter((item) => {
            const created = item.modifiedAt ?? item.createdAt ?? now;
            switch (ageFilter) {
                case 9: return created >= todayStart;
                case 8: return created >= yesterdayStart && created < todayStart;
                case 7: return created >= thisWeekStart;
                case 6: return created >= lastWeekStart && created < thisWeekStart;
                case 5: return created >= prevWeekStart && created < lastWeekStart;
                case 4: return created >= prev2WeekStart && created < prevWeekStart;
                case 3: return created >= thisMonStart;
                case 2: return created >= lastMonStart && created < thisMonStart;
                case 1: return created >= prev2MonStart && created < lastMonStart;
                case 0: return created < prev2MonStart;
                default: return true;
            }
        });
    }, [rawCurrentItems, ageFilter]);

    const currentItems = ageFilteredItems;
    currentItemsRef.current = rawCurrentItems;

    const breadcrumbLabels = getBreadcrumbLabels(state.items, navigationPath);

    // Inbox items from dedicated state.inbox array
    const inboxItems = state.inbox ?? [];
    const inboxItemCount = inboxItems.length;
    const rootCanvasItems = state.items.filter((i) => i.type === 'canvas');

    const archiveItems = state.archive ?? [];
    const archiveItemCount = archiveItems.length;

    const resurfaceIds = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();
        const MS_PER_DAY = 86400000;
        return new Set(
            inboxItems.filter((item) => {
                const baseTs = item.modifiedAt ?? item.createdAt ?? todayMs;
                const baseDay = new Date(baseTs);
                baseDay.setHours(0, 0, 0, 0);
                const d = Math.round((todayMs - baseDay.getTime()) / MS_PER_DAY);
                return d === 0 || d === 1 || (d >= 7 && d % 7 === 0);
            }).map((i) => i.id)
        );
    }, [inboxItems, clockTick]); // clockTick ensures it updates at midnight if open
    const resurfaceCount = resurfaceIds.size;
    const visibleInboxItems = inboxResurfaceFilter ? inboxItems.filter((i) => resurfaceIds.has(i.id)) : inboxItems;

    // Date stats across all items (including nested)
    const allFlat = flattenItems(state.items);
    const itemsWithDate = allFlat.filter((i) => i.date);
    const bucket = (b: string) => itemsWithDate.filter((i) => getDateBucket(i.date!) === b).length;
    const todayCount     = bucket('today');
    const yesterdayCount = bucket('yesterday');
    const tomorrowCount  = bucket('tomorrow');
    const lastWeekCount  = bucket('last-week');
    const nextWeekCount  = bucket('next-week');
    const pastCount      = bucket('past');
    const upcomingCount  = bucket('upcoming');
    const overdueCount   = yesterdayCount + lastWeekCount + pastCount;

    // Curried path-aware operations for the current canvas level
    const addItem = (item: Omit<CanvasItem, 'id'> & { id?: string }) =>
        addItemAtPath(navigationPathRef.current, item);
    const updateItem = (id: string, updates: Partial<CanvasItem>) =>
        updateItemAtPath(navigationPathRef.current, id, updates);
    const removeItem = (id: string) => {
        // Move the item to the recycle bin before removing from canvas
        const currentItems = getItemsAtPath(state.items, navigationPathRef.current);
        const dying = currentItems.find((i) => i.id === id);
        if (dying) {
            recycleBin.addItem(dying, state.backgroundColor);
        }
        removeItemAtPath(navigationPathRef.current, id);
    };
    const moveItem = (id: string, x: number, y: number) =>
        moveItemAtPath(navigationPathRef.current, id, x, y);

    const handleLogHistory = (id: string, type: any, action: string, snapshot?: string) => {
        logHistoryAtPath(navigationPathRef.current, id, type, action, snapshot);
    };

    // Inbox-specific action/history handlers
    const handleInboxLogHistory = (id: string, type: any, action: string, snapshot?: string) => {
        const item = (state.inbox ?? []).find((i) => i.id === id);
        if (!item) return;
        const entry = { id: crypto.randomUUID(), type, action, timestamp: Date.now(), ...(snapshot ? { snapshot } : {}) };
        updateInboxItem(id, { history: [...(item.history ?? []), entry] });
    };

    const handleInboxLogAction = (id: string, label: string) => {
        if (!label.trim()) return;
        const item = (state.inbox ?? []).find((i) => i.id === id);
        if (!item) return;
        const now = Date.now();
        const prevActions = item.actions ?? [];
        let duration = 0;
        if (prevActions.length > 0) {
            duration = Math.floor((now - prevActions[prevActions.length - 1].timestamp) / 1000);
        } else if (item.timer) {
            duration = item.timer.totalElapsed + (item.timer.isRunning ? Math.floor((now - item.timer.startTime) / 1000) : 0);
        }
        const newAction = { id: crypto.randomUUID(), label: label.trim(), timestamp: now, duration };
        updateInboxItem(id, { actions: [...prevActions, newAction] });
    };

    const handleInboxDeleteAction = (id: string, actionId: string) => {
        const item = (state.inbox ?? []).find((i) => i.id === id);
        if (!item) return;
        updateInboxItem(id, { actions: (item.actions ?? []).filter((a) => a.id !== actionId) });
    };

    // Move a block out of current sub-canvas to parent level
    const handleEject = (item: CanvasItem) => {
        const parentPath = navigationPath.slice(0, -1);
        const parentItems = getItemsAtPath(state.items, parentPath);
        const { x, y } = findEmptyLocation(parentItems, item.width ?? 240, item.height ?? 120);
        moveItemBetweenPaths(navigationPath, parentPath, item, x, y);
    };

    // Move a block from current level into a sibling canvas
    const handleMoveInto = (item: CanvasItem, targetCanvasId: string) => {
        const targetPath = [...navigationPath, targetCanvasId];
        const targetItems = getItemsAtPath(state.items, targetPath);
        const { x, y } = findEmptyLocation(targetItems, item.width ?? 240, item.height ?? 120);
        moveItemBetweenPaths(navigationPath, targetPath, item, x, y);
    };

    const fetchMetadata = async (url: string, id: string) => {
        try {
            const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const metadata = await response.json();
                updateItemAtPath(navigationPathRef.current, id, { metadata });
            }
        } catch (error) {
            console.error('Failed to fetch metadata:', error);
        }
    };

    // Persist tagMaster to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('black-board-tags', JSON.stringify(tagMaster));
    }, [tagMaster]);

    const addToTagMaster = (tag: string) => {
        setTagMaster((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    };

    // Keep stateRef fresh so the interval below never reads stale state
    stateRef.current = state;

    // Clock tick + 15-min audible/visual alert for running timers
    useEffect(() => {
        const ALERT_INTERVAL_MS = 15 * 60 * 1000;

        const playAlert = () => {
            try {
                const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.6);
            } catch { /* AudioContext unavailable */ }
        };

        const id = setInterval(() => {
            setClockTick((t) => t + 1);

            const running = flattenItems(stateRef.current.items).filter((i) => i.timer?.isRunning);
            if (running.length === 0) return;

            const now = Date.now();
            if (now - lastAlertRef.current >= ALERT_INTERVAL_MS) {
                lastAlertRef.current = now;
                playAlert();
                const ids = new Set(running.map((i) => i.id));
                setAlertingIds(ids);
                setTimeout(() => setAlertingIds(new Set()), 2500);
            }
        }, 1000);

        return () => clearInterval(id);
    }, []);

    const formatElapsed = (totalElapsed: number, isRunning: boolean, startTime: number): string => {
        let s = totalElapsed;
        if (isRunning) s += Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const formatTodayElapsed = (timer: { isRunning: boolean; startTime: number; totalElapsed: number; sessions?: { start: number; end?: number }[] }): string => {
        const midnight = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
        let s = 0;
        for (const sess of timer.sessions ?? []) {
            if (sess.end !== undefined && sess.start >= midnight) {
                s += Math.floor((sess.end - sess.start) / 1000);
            }
        }
        if (timer.isRunning && timer.startTime >= midnight) {
            s += Math.floor((Date.now() - timer.startTime) / 1000);
        }
        // Fallback: no sessions data — use total elapsed
        if (!timer.sessions) {
            s = timer.totalElapsed;
            if (timer.isRunning) s += Math.floor((Date.now() - timer.startTime) / 1000);
        }
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const handleQuickSave = (content: string, tags: string[], date?: string) => {
        const { x, y } = findEmptyLocation(state.inbox ?? [], 280, 140);
        addToInbox({ type: 'text', content, x, y, tags, ...(date ? { date } : {}) });
    };

    const handleAddToSubCanvas = (path: string[], content: string, tags: string[], date?: string) => {
        const targetItems = getItemsAtPath(state.items, path);
        const { x, y } = findEmptyLocation(targetItems, 280, 140);
        addItemAtPath(path, { type: 'text', content, x, y, tags, ...(date ? { date } : {}) });
    };

    const handleQuickStartTimer = (content: string, tags: string[], date?: string) => {
        const now = Date.now();
        const { x, y } = findEmptyLocation(state.inbox ?? [], 280, 140);
        addToInbox({
            type: 'text',
            content,
            x,
            y,
            tags,
            ...(date ? { date } : {}),
            timer: { isRunning: true, startTime: now, totalElapsed: 0, sessions: [{ start: now }] },
        });
    };

    const handleArchive = (item: CanvasItem) => {
        const { x, y } = findEmptyLocation(state.archive ?? [], item.width ?? 280, item.height ?? 140);
        removeItemAtPath(navigationPathRef.current, item.id);
        addToArchive({ ...item, x, y });
    };

    const handleRecycleBinRestore = (id: string) => {
        const restored = recycleBin.restoreItem(id);
        if (!restored) return;
        // Place it on the root canvas (path = []) at its original position
        const { deletedAt: _deletedAt, originalCanvasColor: _color, ...originalItem } = restored;
        addItemAtPath([], originalItem);
    };

    const handleToggleTimer = (id: string) => {
        const found = findItemAnywhere(id) ?? (() => {
            const item = currentItemsRef.current.find((i) => i.id === id);
            return item ? { item, path: navigationPathRef.current } : null;
        })();
        if (!found) return;
        const { item, path } = found;
        const now = Date.now();
        const today = new Date().toISOString().slice(0, 10);
        if (!item.timer) {
            updateItemAtPath(path, id, {
                timer: { isRunning: true, startTime: now, totalElapsed: 0, sessions: [{ start: now }] },
                date: today,
            });
            return;
        }
        if (item.timer.isRunning) {
            const elapsed = item.timer.totalElapsed + Math.floor((now - item.timer.startTime) / 1000);
            const sessions = (item.timer.sessions ?? []).map((s) =>
                s.end === undefined ? { ...s, end: now } : s
            );
            updateItemAtPath(path, id, {
                timer: { ...item.timer, isRunning: false, totalElapsed: elapsed, sessions },
            }, { historyActionLabel: 'Paused timer' });
        } else {
            updateItemAtPath(path, id, {
                timer: {
                    ...item.timer,
                    isRunning: true,
                    startTime: now,
                    sessions: [...(item.timer.sessions ?? []), { start: now }],
                },
                date: today,
            });
        }
    };

    const handleStopTimer = (id: string) => {
        const found = findItemAnywhere(id) ?? (() => {
            const item = currentItemsRef.current.find((i) => i.id === id);
            return item ? { item, path: navigationPathRef.current } : null;
        })();
        if (!found?.item.timer) return;
        const { item, path } = found;
        const timer = item.timer!;
        const now = Date.now();
        const elapsed = timer.isRunning
            ? timer.totalElapsed + Math.floor((now - timer.startTime) / 1000)
            : timer.totalElapsed;
        const sessions = timer.isRunning
            ? (timer.sessions ?? []).map((s) => (s.end === undefined ? { ...s, end: now } : s))
            : (timer.sessions ?? []);
        updateItemAtPath(path, id, {
            timer: { ...timer, isRunning: false, totalElapsed: elapsed, sessions },
        }, { historyActionLabel: 'Stopped timer' });
    };

    const handleLogAction = (id: string, label: string) => {
        if (!label.trim()) return;
        const item = currentItemsRef.current.find((i) => i.id === id);
        if (!item) return;
        const now = Date.now();
        const prevActions = item.actions ?? [];
        let duration = 0;
        if (prevActions.length > 0) {
            duration = Math.floor((now - prevActions[prevActions.length - 1].timestamp) / 1000);
        } else if (item.timer) {
            duration = item.timer.totalElapsed + (item.timer.isRunning ? Math.floor((now - item.timer.startTime) / 1000) : 0);
        }
        const newAction = { id: crypto.randomUUID(), label: label.trim(), timestamp: now, duration };
        updateItemAtPath(navigationPathRef.current, id, { actions: [...prevActions, newAction] });
    };

    const handleDeleteAction = (id: string, actionId: string) => {
        const item = currentItemsRef.current.find((i) => i.id === id);
        if (!item) return;
        updateItemAtPath(navigationPathRef.current, id, {
            actions: (item.actions ?? []).filter((a) => a.id !== actionId),
        });
    };

    // Paste handler — uses refs so it doesn't need to re-register on path change
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const base64 = event.target?.result as string;
                            const { x, y } = findEmptyLocation(currentItemsRef.current, 300, 200);
                            addItemAtPath(navigationPathRef.current, {
                                type: 'image',
                                content: base64,
                                x,
                                y,
                                width: 300,
                                height: 200,
                                metadata: { naturalSize: true },
                            });
                            trackImageAdded();
                        };
                        reader.readAsDataURL(file);
                    }
                }

                if (item.type === 'text/plain') {
                    item.getAsString((text) => {
                        const trimmedText = text.trim();
                        const isUrl = /^https?:\/\//.test(trimmedText);
                        if (isUrl) {
                            const { x, y } = findEmptyLocation(currentItemsRef.current, 300, 280);
                            addItemAtPath(navigationPathRef.current, {
                                type: 'link',
                                content: trimmedText,
                                x,
                                y,
                                width: 300,
                                height: 280,
                            }).then((id) => fetchMetadata(trimmedText, id));
                        } else {
                            const { x, y } = findEmptyLocation(currentItemsRef.current, 240, 120);
                            addItemAtPath(navigationPathRef.current, {
                                type: 'text',
                                content: text,
                                x,
                                y,
                            });
                        }
                    });
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [addItemAtPath]);

    // Escape key to exit current sub-canvas level
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showSearchRef.current) return; // let SearchPanel handle its own Escape
                if (viewModeRef.current === 'inbox' || viewModeRef.current === 'archive') {
                    setInboxResurfaceFilter(false);
                    setViewMode('canvas');
                    return;
                }
                if (navigationPathRef.current.length > 0) {
                    setNavigationPath((prev) => prev.slice(0, -1));
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch((v) => !v);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    const handleDoubleClick = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current || e.currentTarget === canvasRef.current) {
            addItem({
                type: 'text',
                content: '',
                x: e.clientX - 120,
                y: e.clientY - 60,
            });
        }
    };

    const handleEnterCanvas = (id: string) => {
        setNavigationPath((prev) => [...prev, id]);
    };

    const navigateTo = (index: number) => {
        setNavigationPath((prev) => prev.slice(0, index));
    };

    if (!isLoaded) return null;

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-canvas-bg canvas-bg">

            {viewMode === 'canvas' ? (

                <div
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    onDoubleClick={handleDoubleClick}
                >
                    {currentItems.map((item) => (
                        <CanvasItemComponent
                            key={item.id}
                            item={item}
                            onUpdate={updateItem}
                            onRemove={removeItem}
                            onMove={moveItem}
                            onEnterCanvas={handleEnterCanvas}
                            canEject={navigationPath.length > 0}
                            onEject={() => handleEject(item)}
                            onArchive={() => handleArchive(item)}
                            moveTargets={currentItems.filter((i) => i.type === 'canvas' && i.id !== item.id)}
                            onMoveInto={(targetId) => handleMoveInto(item, targetId)}
                            clockTick={clockTick}
                            onToggleTimer={handleToggleTimer}
                            onStopTimer={handleStopTimer}
                            isAlerting={alertingIds.has(item.id)}
                            isHighlighted={highlightedItemId === item.id}
                            onLogAction={handleLogAction}
                            onDeleteAction={handleDeleteAction}
                            tagMaster={tagMaster}
                            onUpdateTags={(id, tags) => {
                                tags.forEach((t) => addToTagMaster(t));
                                updateItem(id, { tags });
                            }}
                            onLogHistory={handleLogHistory}
                            walletMaster={state.wallets ?? []}
                            allItems={state.items.map(i =>
                                i.type === 'canvas' && i.content === 'Inbox'
                                    ? { ...i, children: [] }
                                    : i
                            )}
                            onNavigateToBlock={(_ignoredPath, blockId) => {
                                // Resolve the full path by searching the tree
                                const findPath = (items: CanvasItem[], id: string, current: string[]): string[] | null => {
                                    for (const it of items) {
                                        if (it.id === id) return current;
                                        if (it.children?.length) {
                                            const found = findPath(it.children, id, [...current, it.id]);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };
                                const resolvedPath = findPath(state.items, blockId, []) ?? [];
                                setNavigationPath(resolvedPath);
                                setHighlightedItemId(blockId);
                                setTimeout(() => setHighlightedItemId(null), 2000);
                            }}
                        />
                    ))}
                </div>
            ) : viewMode === 'calendar' ? (
                <CalendarBoard
                    items={state.items}
                    onClose={() => setViewMode('canvas')}
                    onNavigateToItem={(item, path) => {
                        setNavigationPath(path);
                        setViewMode('canvas');
                    }}
                />
            ) : viewMode === 'plan' ? (
                <PlanBoard
                    items={state.items}
                    recurringDays={recurringDays}
                    onClose={() => setViewMode('canvas')}
                    onNavigateToItem={(item, path) => {
                        setNavigationPath(path);
                        setViewMode('canvas');
                    }}
                />
            ) : viewMode === 'week' ? (
                <WeekBoard
                    items={state.items}
                    onClose={() => setViewMode('canvas')}
                    onNavigateToItem={(item, path) => {
                        setNavigationPath(path);
                        setViewMode('canvas');
                    }}
                />
            ) : viewMode === 'inbox' ? (
                /* viewMode === 'inbox' */
                <div className="absolute inset-0 w-full h-full">
                    {visibleInboxItems.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                            <Inbox size={40} className="text-white/10" />
                            <p className="text-white/25 text-sm font-medium">{inboxResurfaceFilter ? 'No resurfacing items today' : 'Inbox is empty'}</p>
                            <p className="text-white/15 text-xs">New notes captured here by default</p>
                        </div>
                    ) : (
                        visibleInboxItems.map((item) => (
                            <CanvasItemComponent
                                key={item.id}
                                item={item}
                                onUpdate={(id, updates) => updateInboxItem(id, updates)}
                                onRemove={(id) => removeFromInbox(id)}
                                onMove={(id, x, y) => updateInboxItem(id, { x, y })}
                                onEnterCanvas={() => {}}
                                canEject={true}
                                onEject={() => {
                                    const { x, y } = findEmptyLocation(state.items, item.width ?? 240, item.height ?? 120);
                                    moveFromInboxToCanvas(item, [], x, y);
                                }}
                                moveTargets={rootCanvasItems}
                                onMoveInto={(targetId) => {
                                    const targetItems = getItemsAtPath(state.items, [targetId]);
                                    const { x, y } = findEmptyLocation(targetItems, item.width ?? 240, item.height ?? 120);
                                    moveFromInboxToCanvas(item, [targetId], x, y);
                                }}
                                clockTick={clockTick}
                                onToggleTimer={handleToggleTimer}
                                onStopTimer={handleStopTimer}
                                isAlerting={alertingIds.has(item.id)}
                                isHighlighted={false}
                                onLogAction={handleInboxLogAction}
                                onDeleteAction={handleInboxDeleteAction}
                                tagMaster={tagMaster}
                                onUpdateTags={(id, tags) => {
                                    tags.forEach((t) => addToTagMaster(t));
                                    updateInboxItem(id, { tags });
                                }}
                                onLogHistory={handleInboxLogHistory}
                                walletMaster={state.wallets ?? []}
                                allItems={state.items}
                                onNavigateToBlock={() => {}}
                            />
                        ))
                    )}
                </div>
            ) : (
                /* viewMode === 'archive' */
                <div className="absolute inset-0 w-full h-full">
                    {archiveItems.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                            <Archive size={40} className="text-white/10" />
                            <p className="text-white/25 text-sm font-medium">Archives is empty</p>
                            <p className="text-white/15 text-xs">Archived items appear here</p>
                        </div>
                    ) : (
                        archiveItems.map((item) => (
                            <CanvasItemComponent
                                key={item.id}
                                item={item}
                                onUpdate={(id, updates) => updateArchiveItem(id, updates)}
                                onRemove={(id) => removeFromArchive(id)}
                                onMove={(id, x, y) => updateArchiveItem(id, { x, y })}
                                onEnterCanvas={() => {}}
                                canEject={true}
                                onEject={() => {
                                    const { x, y } = findEmptyLocation(state.items, item.width ?? 240, item.height ?? 120);
                                    moveFromArchiveToCanvas(item, [], x, y);
                                }}
                                moveTargets={rootCanvasItems}
                                onMoveInto={(targetId) => {
                                    const targetItems = getItemsAtPath(state.items, [targetId]);
                                    const { x, y } = findEmptyLocation(targetItems, item.width ?? 240, item.height ?? 120);
                                    moveFromArchiveToCanvas(item, [targetId], x, y);
                                }}
                                clockTick={clockTick}
                                onToggleTimer={handleToggleTimer}
                                onStopTimer={handleStopTimer}
                                isAlerting={alertingIds.has(item.id)}
                                isHighlighted={false}
                                readOnly={true}
                                onLogAction={() => {}}
                                onDeleteAction={() => {}}
                                tagMaster={tagMaster}
                                onUpdateTags={() => {}}
                                onLogHistory={() => {}}
                                walletMaster={state.wallets ?? []}
                                allItems={state.items}
                                onNavigateToBlock={() => {}}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Quick Entry Bar — visible in canvas mode across all levels */}
            {(viewMode === 'canvas' || viewMode === 'inbox') && (
                <QuickEntryBar
                    onSave={handleQuickSave}
                    onAddToSubCanvas={handleAddToSubCanvas}
                    onAppendToBlock={(path, id, appendText) => {
                        const item = getItemsAtPath(state.items, path).find((i) => i.id === id);
                        if (!item) return;
                        const newContent = item.content.trimEnd() + '\n' + appendText;
                        updateItemAtPath(path, id, { content: newContent });
                    }}
                    onStartTimer={handleQuickStartTimer}
                    subCanvases={getAllSubCanvases(state.items)}
                    tagMaster={tagMaster}
                    onAddToTagMaster={addToTagMaster}
                    allItems={state.items}
                    hasInbox={true}
                    ageFilter={ageFilter}
                    onAgeFilterChange={setAgeFilter}
                    fundsNet={canvasTotalNet(getItemsAtPath(state.items, navigationPath))}
                />
            )}

            {/* Running Timers Capsule — top-right */}
            {viewMode === 'canvas' && (() => {
                const running = flattenItems(state.items).filter((i) => i.timer?.isRunning);
                if (running.length === 0) return null;
                return (
                    <div className="fixed top-5 right-6 z-[100] flex items-center gap-2 animate-in slide-in-from-top-4">
                        <div className="flex items-center gap-1.5 px-2 py-1 glass rounded-xl">
                            <Timer size={11} className="text-emerald-400/70 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                                {running.length} running
                            </span>
                        </div>
                        {running.map((item) => {
                            const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0].slice(0, 28) || 'Untitled';
                            const elapsed = formatTodayElapsed(item.timer!);

                            return (
                                <div
                                    key={item.id}
                                    className="group/rc flex items-center gap-2 px-3 py-1.5 glass rounded-xl shadow-lg animate-in fade-in"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                    <span className="text-xs text-white/70 font-medium truncate max-w-[140px]">{label}</span>
                                    <span className="font-mono text-[11px] font-bold tabular-nums text-emerald-400">{elapsed}</span>
                                    {/* Controls on hover */}
                                    <div className="flex items-center gap-0.5 w-0 overflow-hidden group-hover/rc:w-auto transition-all duration-150">
                                        <button
                                            onClick={() => handleToggleTimer(item.id)}
                                            className="p-1 rounded hover:bg-white/10 transition-colors"
                                            title="Pause"
                                        >
                                            <Pause size={10} className="text-emerald-400" />
                                        </button>
                                        <button
                                            onClick={() => handleStopTimer(item.id)}
                                            className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                            title="Stop"
                                        >
                                            <Square size={10} className="text-white/40 hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Breadcrumb — only visible when inside a sub-canvas */}
            {navigationPath.length > 0 && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-xl z-[99999] animate-in slide-in-from-top-4 bg-[#0b101c]/80 border border-white/20 backdrop-blur-md">
                    <button
                        onClick={() => setNavigationPath([])}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                        title="Go to root canvas"
                    >
                        <Home size={14} />
                    </button>
                    {breadcrumbLabels.map((label, index) => (
                        <React.Fragment key={index}>
                            <ChevronRight size={12} className="text-white/30 shrink-0" />
                            <button
                                onClick={() => navigateTo(index + 1)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors truncate max-w-[160px] ${
                                    index === breadcrumbLabels.length - 1
                                        ? 'text-purple-300 bg-purple-500/15 cursor-default'
                                        : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {label}
                            </button>
                        </React.Fragment>
                    ))}
                    <span className="ml-1 text-[10px] text-white/25 font-medium pl-1 border-l border-white/10">
                        Esc to exit
                    </span>
                </div>
            )}

            {/* Inbox header — visible when in inbox view */}
            {viewMode === 'inbox' && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-xl z-[99] glass border border-white/15 animate-in slide-in-from-top-4">
                    <Inbox size={14} className="text-sky-400 shrink-0" />
                    <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">Inbox</span>
                    {inboxItemCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/20">
                            {inboxItemCount}
                        </span>
                    )}
                    {resurfaceCount > 0 && (
                        <button
                            onClick={() => setInboxResurfaceFilter((f) => !f)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black border transition-all ${inboxResurfaceFilter ? 'bg-amber-500/30 text-amber-300 border-amber-400/40' : 'bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse hover:bg-amber-500/25'}`}
                            title={inboxResurfaceFilter ? 'Show all inbox items' : 'Show only resurfacing items'}
                        >
                            <RotateCcw size={8} />
                            {resurfaceCount}
                        </button>
                    )}
                    <span className="ml-1 text-[10px] text-white/20 pl-1 border-l border-white/10">
                        Eject to board · Esc to exit
                    </span>
                </div>
            )}

            {/* Archive header — visible when in archive view */}
            {viewMode === 'archive' && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-xl z-[99] glass border border-white/15 animate-in slide-in-from-top-4">
                    <Archive size={14} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Archives</span>
                    {archiveItemCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/20">
                            {archiveItemCount}
                        </span>
                    )}
                    <span className="ml-1 text-[10px] text-white/20 pl-1 border-l border-white/10">
                        Eject to board · Esc to exit
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 glass rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-8">
                {/* View Switcher */}
                <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl mr-2">
                    <button
                        onClick={() => setViewMode('canvas')}
                        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                            viewMode === 'canvas' 
                                ? 'bg-white/10 text-white shadow-inner' 
                                : 'text-white/30 hover:text-white/60'
                        }`}
                        title="Switch to Board View"
                    >
                        <LayoutGrid size={20} className={viewMode === 'canvas' ? 'text-sky-400' : ''} />
                        <span className="text-[9px] uppercase font-black tracking-widest">Board</span>
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                            viewMode === 'calendar' 
                                ? 'bg-white/10 text-white shadow-inner' 
                                : 'text-white/30 hover:text-white/60'
                        }`}
                        title="Switch to Week View"
                    >
                        <CalendarDays size={20} className={viewMode === 'calendar' ? 'text-sky-400' : ''} />
                        <span className="text-[9px] uppercase font-black tracking-widest">Week</span>
                    </button>
                    <button
                        onClick={() => setViewMode('plan')}
                        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                            viewMode === 'plan'
                                ? 'bg-white/10 text-white shadow-inner'
                                : 'text-white/30 hover:text-white/60'
                        }`}
                        title="Switch to Plan View"
                    >
                        <ClipboardList size={20} className={viewMode === 'plan' ? 'text-violet-400' : ''} />
                        <span className="text-[9px] uppercase font-black tracking-widest">Plan</span>
                    </button>
                    <button
                        onClick={() => setViewMode('week')}
                        className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                            viewMode === 'week'
                                ? 'bg-white/10 text-white shadow-inner'
                                : 'text-white/30 hover:text-white/60'
                        }`}
                        title="Switch to Week Board"
                    >
                        <CalendarRange size={20} className={viewMode === 'week' ? 'text-sky-400' : ''} />
                        <span className="text-[9px] uppercase font-black tracking-widest">Week</span>
                    </button>
                </div>

                <div className="w-[1px] h-10 bg-white/10" />

                <button

                    onClick={() => {
                        const { x, y } = findEmptyLocation(currentItems, 240, 120);
                        addItem({ type: 'text', content: '', x, y });
                    }}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                >
                    <Type size={20} className="text-white/60 group-hover:text-sky-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Text</span>
                </button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <label className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group cursor-pointer">
                    <ImageIcon size={20} className="text-white/60 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Image</span>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const { x, y } = findEmptyLocation(currentItems, 300, 200);
                                    addItem({
                                        type: 'image',
                                        content: event.target?.result as string,
                                        x,
                                        y,
                                        width: 300,
                                        height: 200,
                                        metadata: { naturalSize: true },
                                    });
                                    trackImageAdded();
                                };
                                reader.readAsDataURL(file);
                            }
                        }}
                    />
                </label>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <button
                    onClick={async () => {
                        const url = prompt('Enter a URL');
                        if (url) {
                            const trimmedUrl = url.trim();
                            const { x, y } = findEmptyLocation(currentItems, 300, 280);
                            const id = await addItem({
                                type: 'link',
                                content: trimmedUrl,
                                x,
                                y,
                                width: 300,
                                height: 280,
                            });
                            await fetchMetadata(trimmedUrl, id);
                        }
                    }}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                >
                    <LinkIcon size={20} className="text-white/60 group-hover:text-amber-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Link</span>
                </button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <button
                    onClick={() => {
                        const { x, y } = findEmptyLocation(currentItems, 320, 240);
                        addItem({
                            type: 'canvas',
                            content: 'New Canvas',
                            x,
                            y,
                            width: 320,
                            height: 240,
                            children: [],
                        });
                    }}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                >
                    <Layers size={20} className="text-white/60 group-hover:text-purple-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Canvas</span>
                </button>

                <button
                    onClick={() => setShowSitemap((v) => !v)}
                    className={`flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group ${showSitemap ? 'bg-purple-500/15' : ''}`}
                    title="Canvas Map (tree view)"
                >
                    <Network size={20} className={`transition-colors ${showSitemap ? 'text-purple-400' : 'text-white/60 group-hover:text-purple-400'}`} />
                    <span className={`text-[10px] uppercase font-bold tracking-wider transition-colors ${showSitemap ? 'text-purple-400' : 'text-white/30 group-hover:text-white/60'}`}>Tree</span>
                </button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <button
                    onClick={() => {
                        // Snapshot current positions/sizes before organizing
                        setPreOrganizeSnapshot(
                            currentItems.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
                        );
                        const positions = organizeItems(currentItems);
                        const updatesMap: Record<string, Partial<CanvasItem>> = {};
                        positions.forEach(({ id, x, y, width, height }) => {
                            updatesMap[id] = {
                                x,
                                y,
                                ...(width !== undefined  ? { width }  : {}),
                                ...(height !== undefined ? { height } : {}),
                            };
                        });
                        batchUpdateAtPath(navigationPathRef.current, updatesMap, { silent: true });
                    }}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                    title="Organize items into a clean grid"
                >
                    <LayoutGrid size={20} className="text-white/60 group-hover:text-teal-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Organize</span>
                </button>

                {preOrganizeSnapshot && (
                    <>
                        <div className="w-[1px] h-10 bg-white/10 mx-1" />
                        <button
                            onClick={() => {
                                const updatesMap: Record<string, Partial<CanvasItem>> = {};
                                preOrganizeSnapshot.forEach(({ id, x, y, width, height }) => {
                                    updatesMap[id] = {
                                        x,
                                        y,
                                        width: width ?? ITEM_DEFAULTS[currentItems.find(i => i.id === id)?.type || 'text'].width,
                                        height: height ?? ITEM_DEFAULTS[currentItems.find(i => i.id === id)?.type || 'text'].height,
                                    };
                                });
                                batchUpdateAtPath(navigationPathRef.current, updatesMap, { silent: true });
                                setPreOrganizeSnapshot(null);
                            }}
                            className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                            title="Undo organize"
                        >
                            <Undo2 size={20} className="text-white/60 group-hover:text-orange-400 transition-colors" />
                            <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Undo</span>
                        </button>
                    </>
                )}

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <button
                    onClick={() => { setViewMode((v) => v === 'inbox' ? 'canvas' : 'inbox'); setInboxResurfaceFilter(false); }}
                    className={`flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group ${viewMode === 'inbox' ? 'text-sky-400' : ''}`}
                    title={`Inbox (${inboxItemCount} items${resurfaceCount > 0 ? `, ${resurfaceCount} resurfacing` : ''})`}
                >
                    <div className="relative">
                        <Inbox size={20} className={`transition-colors ${viewMode === 'inbox' ? 'text-sky-400' : 'text-white/60 group-hover:text-sky-400'}`} />
                        {inboxItemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[8px] font-black bg-sky-500/80 text-sky-100">
                                {inboxItemCount > 9 ? '9+' : inboxItemCount}
                            </span>
                        )}
                        {resurfaceCount > 0 && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[8px] font-black bg-amber-500/80 text-amber-100 animate-pulse">
                                {resurfaceCount > 9 ? '9+' : resurfaceCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Inbox</span>
                </button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <button
                    onClick={() => setViewMode((v) => v === 'archive' ? 'canvas' : 'archive')}
                    className={`flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group ${viewMode === 'archive' ? 'text-amber-400' : ''}`}
                    title={`Archives (${archiveItemCount} items)`}
                >
                    <div className="relative">
                        <Archive size={20} className={`transition-colors ${viewMode === 'archive' ? 'text-amber-400' : 'text-white/60 group-hover:text-amber-400'}`} />
                        {archiveItemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[8px] font-black bg-amber-500/80 text-amber-100">
                                {archiveItemCount > 9 ? '9+' : archiveItemCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Archive</span>
                </button>

                <button
                    onClick={() => setShowRecycleBin(true)}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                    title={`Recycle Bin (${recycleBin.count} item${recycleBin.count !== 1 ? 's' : ''})`}
                >
                    <div className="relative">
                        <Trash2 size={20} className="text-white/60 group-hover:text-red-400 transition-colors" />
                        {recycleBin.count > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[8px] font-black bg-red-500/80 text-red-100">
                                {recycleBin.count > 9 ? '9+' : recycleBin.count}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Trash</span>
                </button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <button
                    onClick={() => setShowSearch(true)}
                    className="flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group"
                    title="Search (Ctrl+K)"
                >
                    <Search size={20} className="text-white/60 group-hover:text-sky-400 transition-colors" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Search</span>
                </button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <div className="relative group/datebtn">
                    <button
                        onClick={() => setShowDateCalendar((v) => !v)}
                        className={`flex flex-col items-center gap-1 p-3 hover:bg-white/5 rounded-xl transition-all group
                            ${showDateCalendar ? 'text-sky-400' : overdueCount > 0 ? 'text-red-400/70 hover:text-red-400' : 'text-white/60 hover:text-white/90'}
                        `}
                    >
                        <div className="relative">
                            <CalendarDays size={20} className={`transition-colors ${showDateCalendar ? 'text-sky-400' : overdueCount > 0 ? 'text-red-400/70' : 'text-white/60 group-hover:text-sky-400'}`} />
                            {itemsWithDate.length > 0 && (
                                <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full text-[8px] font-black ${overdueCount > 0 ? 'bg-red-500/80 text-red-100' : 'bg-sky-500/80 text-sky-100'}`}>
                                    {itemsWithDate.length > 9 ? '9+' : itemsWithDate.length}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 group-hover:text-white/60">Dates</span>
                    </button>

                    {/* Hover stats tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[150] w-48 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 opacity-0 group-hover/datebtn:opacity-100 pointer-events-none transition-opacity duration-150 p-3 text-[10px]"
                        style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                        <div className="font-bold text-white/40 uppercase tracking-wider mb-2 text-[9px]">Date Stats</div>
                        {itemsWithDate.length === 0
                            ? <div className="text-white/25">No dated blocks yet</div>
                            : (() => {
                                const rows: { label: string; count: number; color: string; dot: string }[] = [
                                    { label: 'Today',     count: todayCount,     color: 'text-green-400',  dot: 'bg-green-400' },
                                    { label: 'Yesterday', count: yesterdayCount, color: 'text-red-400',    dot: 'bg-red-400' },
                                    { label: 'Tomorrow',  count: tomorrowCount,  color: 'text-sky-400',    dot: 'bg-sky-400' },
                                    { label: 'Last Week', count: lastWeekCount,  color: 'text-red-400',    dot: 'bg-red-400' },
                                    { label: 'Next Week', count: nextWeekCount,  color: 'text-sky-400',    dot: 'bg-sky-400' },
                                    { label: 'Past',      count: pastCount,      color: 'text-red-400/70', dot: 'bg-red-400/70' },
                                    { label: 'Upcoming',  count: upcomingCount,  color: 'text-sky-400/70', dot: 'bg-sky-400/70' },
                                ];
                                return (
                                    <div className="space-y-1.5">
                                        {rows.filter(r => r.count > 0).map(r => (
                                            <div key={r.label} className="flex justify-between items-center">
                                                <span className="flex items-center gap-1.5 text-white/50">
                                                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${r.dot}`} />
                                                    {r.label}
                                                </span>
                                                <span className={`font-bold ${r.color}`}>{r.count}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
                                            <span className="text-white/30">Total</span>
                                            <span className="text-white/60 font-bold">{itemsWithDate.length}</span>
                                        </div>
                                    </div>
                                );
                            })()
                        }
                    </div>

                    {/* Click calendar — shown above the button */}
                    {showDateCalendar && (() => {
                        const yr = hoverCalMonth.getFullYear();
                        const mo = hoverCalMonth.getMonth();
                        const firstDay = new Date(yr, mo, 1);
                        const lastDay = new Date(yr, mo + 1, 0);
                        const startPad = (firstDay.getDay() + 6) % 7;
                        const days: (number | null)[] = [];
                        for (let i = 0; i < startPad; i++) days.push(null);
                        for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const today = new Date();
                        const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                        const getDs = (d: number) => `${yr}-${pad(mo + 1)}-${pad(d)}`;
                        const datesMap = new Map<string, string>();
                        for (const item of itemsWithDate) {
                            if (item.date && !datesMap.has(item.date)) {
                                datesMap.set(item.date, getDateStatus(item.date));
                            }
                        }
                        return (
                            <div
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[160] rounded-xl shadow-2xl shadow-black/80 ring-1 ring-white/10 p-3 w-56 animate-in fade-in slide-in-from-bottom-2 duration-150"
                                style={{ background: 'rgba(6, 10, 20, 0.99)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
                            >
                                {/* Month nav */}
                                <div className="flex items-center justify-between mb-2">
                                    <button onClick={() => setHoverCalMonth(new Date(yr, mo - 1, 1))} className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white">
                                        <ChevronLeft size={12} />
                                    </button>
                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                        {hoverCalMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => setHoverCalMonth(new Date(yr, mo + 1, 1))} className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white">
                                        <ChevronRight size={12} />
                                    </button>
                                </div>
                                {/* Day headers */}
                                <div className="grid grid-cols-7 mb-1">
                                    {['M','T','W','T','F','S','S'].map((d, i) => (
                                        <div key={i} className="text-center text-[9px] font-bold text-white/25 py-0.5">{d}</div>
                                    ))}
                                </div>
                                {/* Days */}
                                <div className="grid grid-cols-7 gap-y-0.5">
                                    {days.map((day, i) => {
                                        if (!day) return <div key={`e${i}`} className="h-7" />;
                                        const ds = getDs(day);
                                        const status = datesMap.get(ds);
                                        const isToday = ds === todayStr;
                                        return (
                                            <div
                                                key={day}
                                                className={`flex flex-col items-center justify-center h-7 ${status ? 'cursor-pointer' : ''}`}
                                                onClick={() => {
                                                    if (status) {
                                                        setDateFilterDate(ds);
                                                        setShowDateCalendar(false);
                                                    }
                                                }}
                                            >
                                                <span className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full font-medium transition-all
                                                    ${status === 'today' ? 'bg-green-500/30 text-green-300 ring-1 ring-green-500/50' :
                                                      status === 'past-old' || status === 'past-week' ? 'bg-red-500/25 text-red-300 ring-1 ring-red-500/40' :
                                                      status === 'future' ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/40' :
                                                      isToday ? 'ring-1 ring-white/25 text-white/70' :
                                                      'text-white/35'}`}>
                                                    {day}
                                                </span>
                                                {status && (
                                                    <div className={`w-1 h-1 rounded-full mt-0.5
                                                        ${status === 'today' ? 'bg-green-400' :
                                                          status === 'past-old' || status === 'past-week' ? 'bg-red-400' :
                                                          'bg-sky-400'}`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Legend */}
                                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/35">
                                    {todayCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />{todayCount} today</span>}
                                    {overdueCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />{overdueCount} overdue</span>}
                                    {upcomingCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />{upcomingCount} upcoming</span>}
                                    {itemsWithDate.length === 0 && <span>No dated blocks</span>}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* App Header */}
            <div className="fixed top-6 left-8 z-[100] flex items-start gap-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 glass rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-lg shadow-sky-500/10">
                        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h1 className="text-2xl font-display font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                                Black Board
                            </h1>
                            <button
                                onClick={() => setShowChangelog(true)}
                                className="text-[10px] font-mono text-white/25 tracking-wider hover:text-sky-400/70 transition-colors cursor-pointer"
                            >{CHANGELOG[0].version}</button>
                        </div>
                        <p className="text-xs text-white/30 font-medium tracking-wide uppercase">The Spatial Thinking Board</p>
                        <p className="text-[10px] text-white/20 tracking-wide flex items-center gap-1">
                            Developed &amp; managed by
                            <a href="https://allwebtech.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white/50 transition-colors">
                                <img src="https://www.google.com/s2/favicons?domain=allwebtech.in&sz=16" alt="" className="w-3 h-3 rounded-sm" />
                                <span className="font-bold text-[11px]" style={{ color: '#1256c1' }}>AllWebTech</span>
                            </a>
                        </p>
                    </div>
                </div>



            </div>

            {/* Profile floating button — extreme right */}
            <div className="fixed bottom-8 right-8 z-[100]">
                <div className="relative">
                    <button
                        onClick={() => setShowProfileMenu((v) => !v)}
                        className={`w-14 h-14 glass rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${showProfileMenu ? 'ring-1 ring-sky-500/50 text-sky-400' : 'text-white/50 hover:text-white/80'}`}
                    >
                        <UserCircle size={26} />
                    </button>

                    {showProfileMenu && (
                        <>
                            <div className="fixed inset-0 z-[-1]" onClick={() => setShowProfileMenu(false)} />
                            <div className="absolute bottom-full right-0 mb-3 w-44 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
                                style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
                            >
                                <div className="px-4 py-3 border-b border-white/5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Account</p>
                                </div>
                                <div className="p-1.5 flex flex-col gap-0.5">
                                    <button
                                        onClick={() => setShowProfileMenu(false)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left group"
                                    >
                                        <UserCircle size={16} className="text-white/40 group-hover:text-sky-400 transition-colors shrink-0" />
                                        <span className="text-sm font-semibold text-white/60 group-hover:text-white/90 transition-colors">Profile</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowSettings(true); setShowProfileMenu(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left group"
                                    >
                                        <Settings size={16} className="text-white/40 group-hover:text-sky-400 transition-colors shrink-0" />
                                        <span className="text-sm font-semibold text-white/60 group-hover:text-white/90 transition-colors">Settings</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <StorageWarningBanner onOpenStats={() => setShowStats(true)} />
            {showStats && <StorageStats onClose={() => setShowStats(false)} onClearCanvas={clearCanvas} />}

            {/* Recycle Bin Modal */}
            {showRecycleBin && (
                <RecycleBin
                    items={recycleBin.items}
                    onRestore={handleRecycleBinRestore}
                    onDeletePermanently={(id) => recycleBin.deletePermanently(id)}
                    onEmptyBin={recycleBin.emptyBin}
                    onClose={() => setShowRecycleBin(false)}
                    daysRemaining={recycleBin.daysRemaining}
                />
            )}

            {/* Settings Popup */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center"
                    onClick={() => setShowSettings(false)}
                >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-80 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 p-6 animate-in fade-in zoom-in-95 duration-150"
                        style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <Settings size={16} className="text-sky-400" />
                                <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">Settings</h2>
                            </div>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 px-1 mb-2">Data</p>

                            <button
                                onClick={async () => { await handleExport(); setShowSettings(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            >
                                <Download size={16} className="shrink-0" />
                                <div className="text-left">
                                    <div className="font-semibold text-[13px]">Export</div>
                                    <div className="text-[10px] text-white/30">Save canvas as JSON file</div>
                                </div>
                            </button>

                            <label className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-sky-400 hover:bg-sky-500/10 transition-all cursor-pointer">
                                <Upload size={16} className="shrink-0" />
                                <div className="text-left">
                                    <div className="font-semibold text-[13px]">Import</div>
                                    <div className="text-[10px] text-white/30">Merge from JSON file</div>
                                </div>
                                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={(e) => { handleImport(e); setShowSettings(false); }} />
                            </label>

                            <div className="h-px bg-white/10 my-2" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 px-1 mb-2">Plan Board</p>

                            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all">
                                <div>
                                    <div className="text-[13px] font-semibold text-white/60">Recurring repeat days</div>
                                    <div className="text-[10px] text-white/30">How many days from start to repeat a recurring block</div>
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={recurringDays}
                                    onChange={e => {
                                        const v = Math.max(1, Math.min(365, Number(e.target.value) || 30));
                                        setRecurringDays(v);
                                        try {
                                            const s = localStorage.getItem('black-board-settings');
                                            const prev = s ? JSON.parse(s) : {};
                                            localStorage.setItem('black-board-settings', JSON.stringify({ ...prev, recurringDays: v }));
                                        } catch {}
                                    }}
                                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm font-mono font-bold text-violet-300 text-center focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/10 transition-all"
                                />
                            </div>

                            <div className="h-px bg-white/10 my-2" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 px-1 mb-2">Financials</p>
                            <button
                                onClick={() => { setShowWalletMaster(true); setShowSettings(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            >
                                <IndianRupee size={16} className="shrink-0" />
                                <div className="text-left">
                                    <div className="font-semibold text-[13px]">Wallet Accounts</div>
                                    <div className="text-[10px] text-white/30">Manage wallets for financial entries</div>
                                </div>
                            </button>

                            <div className="h-px bg-white/10 my-2" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 px-1 mb-2">Info</p>

                            <button
                                onClick={() => { setShowStats(true); setShowSettings(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                            >
                                <Activity size={16} className="shrink-0" />
                                <div className="text-left">
                                    <div className="font-semibold text-[13px]">Storage Stats</div>
                                    <div className="text-[10px] text-white/30">View localStorage usage</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Wallet Master Modal */}
            {showWalletMaster && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={() => setShowWalletMaster(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative w-[480px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150"
                        style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
                            <div className="flex items-center gap-2">
                                <IndianRupee size={16} className="text-emerald-400" />
                                <h2 className="text-sm font-bold text-white/80 uppercase tracking-widest">Wallet Accounts</h2>
                            </div>
                            <button onClick={() => setShowWalletMaster(false)} className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none">×</button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 flex flex-col gap-1">
                            {(state.wallets ?? []).map((wallet) => (
                                <div key={wallet.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 group transition-colors">
                                    <input
                                        type="text"
                                        value={wallet.name}
                                        onChange={e => updateWallets((state.wallets ?? []).map(w => w.id === wallet.id ? { ...w, name: e.target.value } : w))}
                                        className="flex-1 bg-transparent text-sm font-semibold text-white/80 focus:outline-none focus:text-white min-w-0"
                                    />
                                    <select
                                        value={wallet.accountType}
                                        onChange={e => updateWallets((state.wallets ?? []).map(w => w.id === wallet.id ? { ...w, accountType: e.target.value as WalletAccountType } : w))}
                                        className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 focus:outline-none focus:border-emerald-500/50 focus:text-white/80 transition-all"
                                    >
                                        <option value="Savings">Savings</option>
                                        <option value="Current">Current</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Debit Card">Debit Card</option>
                                    </select>
                                    <button
                                        onClick={() => updateWallets((state.wallets ?? []).filter(w => w.id !== wallet.id))}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                                        title="Remove"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add new */}
                        <div className="px-4 py-3 border-t border-white/8">
                            <WalletAddForm onAdd={wallet => updateWallets([...(state.wallets ?? []), wallet])} />
                        </div>
                    </div>
                </div>
            )}

            {showSitemap && (
                <CanvasSitemapPanel
                    items={state.items}
                    currentPath={navigationPath}
                    onNavigate={(path) => setNavigationPath(path)}
                    onClose={() => setShowSitemap(false)}
                />
            )}

            {showSearch && (
                <SearchPanel
                    allItems={state.items}
                    onNavigate={(path, itemId) => {
                        setNavigationPath(path);
                        if (itemId) {
                            setHighlightedItemId(itemId);
                            setTimeout(() => setHighlightedItemId(null), 2000);
                        }
                    }}
                    onClose={() => setShowSearch(false)}
                />
            )}

            {dateFilterDate && (
                <DateFilterPanel
                    allItems={state.items}
                    initialDate={dateFilterDate}
                    onNavigate={(path) => setNavigationPath(path)}
                    onClose={() => setDateFilterDate(null)}
                />
            )}

            {showChangelog && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center"
                    onClick={() => setShowChangelog(false)}
                >
                    <div
                        className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                            <h2 className="text-sm font-semibold text-white/80 tracking-wide">What&apos;s Changed</h2>
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                            >✕</button>
                        </div>
                        <div className="overflow-y-auto px-5 py-4 space-y-5 text-sm">
                            {CHANGELOG.map(({ version, sections }) => (
                                <div key={version}>
                                    <div className="text-[11px] font-mono text-sky-400/70 font-semibold mb-1.5 tracking-wider">{version}</div>
                                    {sections.map((section, si) => (
                                        <div key={si} className={si > 0 ? 'mt-2' : ''}>
                                            {section.heading && (
                                                <div className="text-[11px] text-white/30 font-semibold mb-1">{section.heading}</div>
                                            )}
                                            <ul className="space-y-1">
                                                {section.changes.map((c, i) => (
                                                    <li key={i} className="text-[13px] text-white/50 flex gap-2">
                                                        <span className="text-white/20 shrink-0">•</span>
                                                        <span>{c}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {currentItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center animate-in fade-in zoom-in duration-1000">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                            {navigationPath.length > 0 ? (
                                <Layers size={32} className="text-purple-500/40" />
                            ) : (
                                <Plus size={32} className="text-white/20" />
                            )}
                        </div>
                        <p className="text-white/20 font-medium italic">
                            {navigationPath.length > 0
                                ? 'Empty sub-canvas. Paste something or use the toolbar.'
                                : 'Canvas is empty. Paste something or use the toolbar.'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

function WalletAddForm({ onAdd }: { onAdd: (w: WalletAccount) => void }) {
    const [name, setName] = React.useState('');
    const [accountType, setAccountType] = React.useState<WalletAccountType>('Savings');
    return (
        <form
            onSubmit={e => {
                e.preventDefault();
                if (!name.trim()) return;
                onAdd({ id: crypto.randomUUID(), name: name.trim(), accountType });
                setName('');
                setAccountType('Savings');
            }}
            className="flex items-center gap-2"
        >
            <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Account name…"
                className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/80 placeholder-white/25 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
            <select
                value={accountType}
                onChange={e => setAccountType(e.target.value as WalletAccountType)}
                className="text-[11px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 focus:outline-none focus:border-emerald-500/50 transition-all"
            >
                <option value="Savings">Savings</option>
                <option value="Current">Current</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
            </select>
            <button
                type="submit"
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30 transition-colors shrink-0"
            >
                Add
            </button>
        </form>
    );
}
