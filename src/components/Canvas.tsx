'use client';

import React, { useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { StorageStats } from './StorageStats';
import { findEmptyLocation } from '@/utils/canvasUtils';
import { CanvasItem } from '@/types/canvas';

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
        clearCanvas,
        loadState,
        isLoaded,
    } = useCanvas();
    const [showStats, setShowStats] = React.useState(false);
    const [navigationPath, setNavigationPath] = React.useState<string[]>([]);
    const canvasRef = useRef<HTMLDivElement>(null);
    const importRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        const json = JSON.stringify(state, null, 2);
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
                    if (confirm('This will replace your current canvas. Continue?')) {
                        loadState(parsed);
                    }
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
    const currentItemsRef = useRef<CanvasItem[]>([]);

    const currentItems = getItemsAtPath(state.items, navigationPath);
    currentItemsRef.current = currentItems;

    const breadcrumbLabels = getBreadcrumbLabels(state.items, navigationPath);

    // Curried path-aware operations for the current canvas level
    const addItem = (item: Omit<CanvasItem, 'id'> & { id?: string }) =>
        addItemAtPath(navigationPathRef.current, item);
    const updateItem = (id: string, updates: Partial<CanvasItem>) =>
        updateItemAtPath(navigationPathRef.current, id, updates);
    const removeItem = (id: string) =>
        removeItemAtPath(navigationPathRef.current, id);
    const moveItem = (id: string, x: number, y: number) =>
        moveItemAtPath(navigationPathRef.current, id, x, y);

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
                            });
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
                            const id = addItemAtPath(navigationPathRef.current, {
                                type: 'link',
                                content: trimmedText,
                                x,
                                y,
                                width: 300,
                                height: 280,
                            });
                            fetchMetadata(trimmedText, id);
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
            if (e.key === 'Escape' && navigationPathRef.current.length > 0) {
                setNavigationPath((prev) => prev.slice(0, -1));
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
                                    });
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
                            const id = addItem({
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
            <div className="fixed top-6 left-8 z-[100] flex items-start gap-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 glass rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-lg shadow-sky-500/10">
                        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                            Thought Canvas
                        </h1>
                        <p className="text-xs text-white/30 font-medium tracking-wide uppercase">Your digital mind garden</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowStats(true)}
                    className="mt-1 px-3 py-1.5 glass rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-sky-400 hover:border-sky-500/30 transition-all flex items-center gap-2"
                >
                    <Activity size={12} />
                    Stats
                </button>

                <button
                    onClick={handleExport}
                    className="mt-1 px-3 py-1.5 glass rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center gap-2"
                >
                    <Download size={12} />
                    Export
                </button>

                <label className="mt-1 px-3 py-1.5 glass rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-sky-400 hover:border-sky-500/30 transition-all flex items-center gap-2 cursor-pointer">
                    <Upload size={12} />
                    Import
                    <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>

                <button
                    onClick={clearCanvas}
                    className="mt-1 px-3 py-1.5 glass rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all"
                >
                    Clear Canvas
                </button>
            </div>

            {showStats && <StorageStats onClose={() => setShowStats(false)} />}

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
