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
    Download,
    Upload,
    CalendarDays,
    ChevronLeft,
    Search,
    Settings,
} from 'lucide-react';
import { StorageStats } from './StorageStats';
import { StorageWarningBanner } from './StorageWarningBanner';
import { SearchPanel } from './SearchPanel';
import { DateFilterPanel } from './DateFilterPanel';

import { findEmptyLocation } from '@/utils/canvasUtils';
import { flattenItems, getDateStatus, getDateBucket } from '@/utils/dateUtils';
import { CanvasItem } from '@/types/canvas';
import { useStorageMonitor } from '@/hooks/useStorageMonitor';
import { useImageStorageTracker } from '@/hooks/useImageStorageTracker';
import { isIdbSentinel, sentinelId, getImage } from '@/utils/imageDB';
import type { CanvasItem as ICanvasItem } from '@/types/canvas';

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
        clearCanvas,
        mergeItems,
        isLoaded,
    } = useCanvas();
    const [showStats, setShowStats] = React.useState(false);
    const [showSearch, setShowSearch] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const [showDateCalendar, setShowDateCalendar] = React.useState(false);
    const [dateFilterDate, setDateFilterDate] = React.useState<string | null>(null);
    const [navigationPath, setNavigationPath] = React.useState<string[]>([]);
    const [hoverCalMonth, setHoverCalMonth] = useState<Date>(() => {
        const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
    });
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
        a.download = `thought-canvas-${new Date().toISOString().slice(0, 10)}.json`;
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

    // Refs so paste handler never captures stale values
    const navigationPathRef = useRef(navigationPath);
    navigationPathRef.current = navigationPath;
    const showSearchRef = useRef(showSearch);
    showSearchRef.current = showSearch;
    const currentItemsRef = useRef<CanvasItem[]>([]);

    const currentItems = getItemsAtPath(state.items, navigationPath);
    currentItemsRef.current = currentItems;

    const breadcrumbLabels = getBreadcrumbLabels(state.items, navigationPath);

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
    const removeItem = (id: string) =>
        removeItemAtPath(navigationPathRef.current, id);
    const moveItem = (id: string, x: number, y: number) =>
        moveItemAtPath(navigationPathRef.current, id, x, y);

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
                        moveTargets={currentItems.filter((i) => i.type === 'canvas' && i.id !== item.id)}
                        onMoveInto={(targetId) => handleMoveInto(item, targetId)}
                    />
                ))}
            </div>

            {/* Breadcrumb — only visible when inside a sub-canvas */}
            {navigationPath.length > 0 && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 glass rounded-xl shadow-xl z-[100] animate-in slide-in-from-top-4">
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

            {/* Toolbar */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 glass rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-8">
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
                                Thought Canvas
                            </h1>
                            <span className="text-[10px] font-mono text-white/25 tracking-wider">v1.4.1</span>
                        </div>
                        <p className="text-xs text-white/30 font-medium tracking-wide uppercase">Your digital mind garden</p>
                        <p className="text-[10px] text-white/20 tracking-wide flex items-center gap-1">
                            Developed &amp; managed by
                            <a href="https://allwebtech.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white/50 transition-colors">
                                <img src="https://www.google.com/s2/favicons?domain=allwebtech.in&sz=16" alt="" className="w-3 h-3 rounded-sm" />
                                <span className="font-bold text-[11px]" style={{ color: '#1256c1' }}>AllWebTech</span>
                            </a>
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setShowSearch(true)}
                    className="mt-1 h-7 px-3 glass rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-sky-400 hover:border-sky-500/30 transition-all flex items-center gap-2"
                    title="Search (Ctrl+K)"
                >
                    <Search size={12} />
                    Search
                </button>

                <button
                    onClick={() => setShowSettings(true)}
                    className="mt-1 h-7 px-3 glass rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-sky-400 hover:border-sky-500/30 transition-all flex items-center gap-2"
                >
                    <Settings size={12} />
                    Settings
                </button>

                <div className="relative group/datebtn">
                    <button
                        onClick={() => setShowDateCalendar((v) => !v)}
                        className={`mt-1 h-7 px-3 glass rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2
                            ${showDateCalendar ? 'text-sky-400 border-sky-500/30' : overdueCount > 0 ? 'text-red-400/70 hover:text-red-400' : 'text-white/40 hover:text-sky-400 hover:border-sky-500/30'}
                        `}
                    >
                        <CalendarDays size={12} />
                        Dates
                        {itemsWithDate.length > 0 && (
                            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${overdueCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-sky-500/20 text-sky-400'}`}>
                                {itemsWithDate.length}
                            </span>
                        )}
                    </button>

                    {/* Hover stats tooltip */}
                    <div className="absolute top-full left-0 mt-2 z-[150] w-44 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 opacity-0 group-hover/datebtn:opacity-100 pointer-events-none transition-opacity duration-150 p-3 w-48 text-[10px]"
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

                    {/* Click calendar — shown below the button */}
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
                                className="absolute top-full left-0 mt-8 z-[160] rounded-xl shadow-2xl shadow-black/80 ring-1 ring-white/10 p-3 w-56 animate-in fade-in slide-in-from-top-2 duration-150"
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

            <StorageWarningBanner onOpenStats={() => setShowStats(true)} />
            {showStats && <StorageStats onClose={() => setShowStats(false)} onClearCanvas={clearCanvas} />}

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

            {showSearch && (
                <SearchPanel
                    allItems={state.items}
                    onNavigate={(path) => setNavigationPath(path)}
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
