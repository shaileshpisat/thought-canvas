'use client';

import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronDown, FolderOpen, Folder, Home, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { CanvasItem, FinancialEntry } from '@/types/canvas';

// ── Stat helpers ────────────────────────────────────────────────────────────

/** Count of direct sub-canvases inside a canvas item (non-recursive). */
function countSubCanvases(item: CanvasItem): number {
    return (item.children ?? []).filter((c) => c.type === 'canvas').length;
}

/** Count of non-canvas blocks (direct children only). */
function countBlocks(item: CanvasItem): number {
    return (item.children ?? []).filter((c) => c.type !== 'canvas').length;
}

/** Recursively flatten all descendants of a canvas item (not including itself). */
function flattenDescendants(item: CanvasItem): CanvasItem[] {
    const result: CanvasItem[] = [];
    for (const child of item.children ?? []) {
        result.push(child);
        if (child.children) result.push(...flattenDescendants(child));
    }
    return result;
}

/** Total timer seconds across all descendants (recursive). */
function aggregateSeconds(item: CanvasItem): number {
    return flattenDescendants(item).reduce((sum, c) => {
        const t = c.timer;
        if (!t) return sum;
        const extra = t.isRunning ? Math.floor((Date.now() - t.startTime) / 1000) : 0;
        return sum + t.totalElapsed + extra;
    }, 0);
}

/** Net financial amount across all descendants (recursive). Income/inflow/redemption positive; expense/investment/outflow negative. */
function aggregateNet(item: CanvasItem): number {
    return flattenDescendants(item).reduce((sum, c) => {
        return sum + (c.financials ?? []).reduce((s, f: FinancialEntry) => {
            const pos = f.type === 'income' || f.type === 'inflow' || f.type === 'redemption';
            return s + (pos ? f.amount : -f.amount);
        }, 0);
    }, 0);
}

/** Format seconds as "Xh Ym" or "Ym" or "—". */
function fmtTime(seconds: number): string | null {
    if (seconds <= 0) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
}

/** Format a rupee amount, abbreviated (K/L/Cr). */
function fmtRupee(amount: number): string | null {
    if (amount === 0) return null;
    const abs = Math.abs(amount);
    let formatted: string;
    if (abs >= 1_00_00_000) formatted = `${(abs / 1_00_00_000).toFixed(1)}Cr`;
    else if (abs >= 1_00_000) formatted = `${(abs / 1_00_000).toFixed(1)}L`;
    else if (abs >= 1_000) formatted = `${(abs / 1_000).toFixed(1)}K`;
    else formatted = `${abs.toLocaleString('en-IN')}`;
    return `${amount < 0 ? '−' : '+'}₹${formatted}`;
}

// ── Search helpers ──────────────────────────────────────────────────────────

/** Case-insensitive match against a canvas name (falls back to "Untitled Canvas"). */
function nameMatches(item: CanvasItem, query: string): boolean {
    if (!query) return true;
    const name = (item.content || 'Untitled Canvas').toLowerCase();
    return name.includes(query.toLowerCase());
}

/** True if this canvas or any descendant canvas matches the query. */
function subtreeMatches(item: CanvasItem, query: string): boolean {
    if (!query) return true;
    if (nameMatches(item, query)) return true;
    for (const child of item.children ?? []) {
        if (child.type === 'canvas' && subtreeMatches(child, query)) return true;
    }
    return false;
}

/** Render a canvas name with matched substring highlighted. */
const HighlightedName: React.FC<{ text: string; query: string }> = ({ text, query }) => {
    if (!query) return <>{text}</>;
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return <>{text}</>;
    return (
        <>
            {text.slice(0, i)}
            <span className="bg-amber-400/30 text-amber-200 rounded px-0.5">{text.slice(i, i + query.length)}</span>
            {text.slice(i + query.length)}
        </>
    );
};

// ── Stat pill ────────────────────────────────────────────────────────────────

const Pill: React.FC<{ label: string; color: string }> = ({ label, color }) => (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${color}`}>
        {label}
    </span>
);

// ── Tree node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
    item: CanvasItem;
    path: string[];
    currentPath: string[];
    depth: number;
    showDetails: boolean;
    reorderMode: boolean;
    query: string;
    siblingIndex: number;
    siblingCount: number;
    onNavigate: (path: string[]) => void;
    onReorder: (parentPath: string[], fromIndex: number, toIndex: number) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
    item, path, currentPath, depth, showDetails,
    reorderMode, query, siblingIndex, siblingCount,
    onNavigate, onReorder,
}) => {
    const allSubCanvases = (item.children ?? []).filter((c) => c.type === 'canvas');
    const subCanvases = query
        ? allSubCanvases.filter((c) => subtreeMatches(c, query))
        : allSubCanvases;

    const isActive = path.length === currentPath.length && path.every((id, i) => currentPath[i] === id);
    const isAncestor = !isActive && path.every((id, i) => currentPath[i] === id);

    const [open, setOpen] = useState(isActive || isAncestor || allSubCanvases.length > 0);
    // Force-open while searching so matching descendants are visible
    const effectiveOpen = query ? subCanvases.length > 0 : open;
    const hasChildren = subCanvases.length > 0;

    const parentPath = path.slice(0, -1);
    const canMoveUp = siblingIndex > 0;
    const canMoveDown = siblingIndex < siblingCount - 1;
    const [seqDraft, setSeqDraft] = useState<string>(String(siblingIndex + 1));
    React.useEffect(() => { setSeqDraft(String(siblingIndex + 1)); }, [siblingIndex]);

    const commitSeq = () => {
        const n = parseInt(seqDraft, 10);
        if (!Number.isFinite(n)) { setSeqDraft(String(siblingIndex + 1)); return; }
        const target = Math.max(1, Math.min(siblingCount, n)) - 1;
        if (target !== siblingIndex) onReorder(parentPath, siblingIndex, target);
        else setSeqDraft(String(siblingIndex + 1));
    };

    // stats
    const subCount = countSubCanvases(item);
    const blockCount = countBlocks(item);
    const timeStr = fmtTime(aggregateSeconds(item));
    const netStr = fmtRupee(aggregateNet(item));

    return (
        <div>
            <div
                className={`flex flex-col py-1 rounded-lg cursor-pointer group transition-colors ${
                    isActive
                        ? 'bg-purple-500/20 text-purple-300'
                        : isAncestor
                        ? 'text-white/80 hover:bg-white/10'
                        : 'text-white/50 hover:bg-white/8 hover:text-white/80'
                }`}
                style={{ paddingLeft: `${8 + depth * 18}px`, paddingRight: '8px' }}
                onClick={() => onNavigate(path)}
            >
                {/* Name row */}
                <div className="flex items-center gap-1.5">
                    {hasChildren ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); if (!query) setOpen((v) => !v); }}
                            disabled={!!query}
                            className="p-0.5 rounded hover:bg-white/10 shrink-0 text-white/40 hover:text-white/70 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                            title={query ? 'Expanded for search' : undefined}
                        >
                            {effectiveOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    ) : (
                        <span className="w-[20px] shrink-0" />
                    )}
                    {effectiveOpen && hasChildren
                        ? <FolderOpen size={14} className="shrink-0 text-purple-400/80" />
                        : <Folder size={14} className={`shrink-0 ${isActive ? 'text-purple-400' : 'text-white/30 group-hover:text-purple-400/60'}`} />
                    }
                    <span className="text-xs font-medium flex-1">
                        <HighlightedName text={item.content || 'Untitled Canvas'} query={query} />
                    </span>
                    {reorderMode && (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="number"
                                min={1}
                                max={siblingCount}
                                value={seqDraft}
                                onChange={(e) => setSeqDraft(e.target.value)}
                                onBlur={commitSeq}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') { setSeqDraft(String(siblingIndex + 1)); (e.target as HTMLInputElement).blur(); }
                                }}
                                className="w-10 text-center text-[10px] font-bold text-white/80 bg-white/5 border border-white/10 rounded px-1 py-0.5 focus:outline-none focus:border-purple-400/60 focus:bg-white/10"
                                title={`Sequence (1–${siblingCount})`}
                            />
                            <button
                                onClick={() => canMoveUp && onReorder(parentPath, siblingIndex, siblingIndex - 1)}
                                disabled={!canMoveUp}
                                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-purple-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/60 transition-colors"
                                title="Move up"
                            >
                                <ArrowUp size={12} />
                            </button>
                            <button
                                onClick={() => canMoveDown && onReorder(parentPath, siblingIndex, siblingIndex + 1)}
                                disabled={!canMoveDown}
                                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-purple-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/60 transition-colors"
                                title="Move down"
                            >
                                <ArrowDown size={12} />
                            </button>
                        </div>
                    )}
                    {!reorderMode && isActive && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400/70 shrink-0">here</span>
                    )}
                </div>

                {/* Details row */}
                {showDetails && (
                    <div className="flex flex-wrap items-center gap-1 mt-1 ml-[20px] pl-[18px]">
                        {subCount > 0 && (
                            <Pill label={`${subCount} canvas${subCount !== 1 ? 'es' : ''}`} color="bg-purple-500/15 text-purple-300/80" />
                        )}
                        {blockCount > 0 && (
                            <Pill label={`${blockCount} block${blockCount !== 1 ? 's' : ''}`} color="bg-sky-500/15 text-sky-300/80" />
                        )}
                        {timeStr && (
                            <Pill label={timeStr} color="bg-emerald-500/15 text-emerald-300/80" />
                        )}
                        {netStr && (
                            <Pill
                                label={netStr}
                                color={netStr.startsWith('+') ? 'bg-green-500/15 text-green-300/80' : 'bg-red-500/15 text-red-300/80'}
                            />
                        )}
                        {subCount === 0 && blockCount === 0 && !timeStr && !netStr && (
                            <span className="text-[9px] text-white/20 italic">empty</span>
                        )}
                    </div>
                )}
            </div>

            {effectiveOpen && hasChildren && (
                <div>
                    {subCanvases.map((child) => {
                        const origIdx = allSubCanvases.findIndex((c) => c.id === child.id);
                        return (
                            <TreeNode
                                key={child.id}
                                item={child}
                                path={[...path, child.id]}
                                currentPath={currentPath}
                                depth={depth + 1}
                                showDetails={showDetails}
                                reorderMode={reorderMode}
                                query={query}
                                siblingIndex={origIdx}
                                siblingCount={allSubCanvases.length}
                                onNavigate={onNavigate}
                                onReorder={onReorder}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ── Panel ────────────────────────────────────────────────────────────────────

interface CanvasSitemapPanelProps {
    items: CanvasItem[];
    currentPath: string[];
    onNavigate: (path: string[]) => void;
    onReorder: (parentPath: string[], fromIndex: number, toIndex: number) => void;
    onClose: () => void;
}

export const CanvasSitemapPanel: React.FC<CanvasSitemapPanelProps> = ({
    items,
    currentPath,
    onNavigate,
    onReorder,
    onClose,
}) => {
    const rootCanvases = items.filter((i) => i.type === 'canvas');
    const [showDetails, setShowDetails] = useState(false);
    const [reorderMode, setReorderMode] = useState(false);
    const [query, setQuery] = useState('');
    const trimmedQuery = query.trim();

    const filteredRoots = useMemo(
        () => (trimmedQuery ? rootCanvases.filter((c) => subtreeMatches(c, trimmedQuery)) : rootCanvases),
        [rootCanvases, trimmedQuery]
    );

    const handleNavigate = (path: string[]) => {
        if (reorderMode) return; // clicks in reorder mode shouldn't navigate
        onNavigate(path);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-24 pointer-events-none">
            <div
                className="pointer-events-auto max-h-[70vh] flex flex-col rounded-2xl shadow-2xl border border-white/15 bg-[#0b101c]/90 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200"
                style={{ minWidth: '32rem', maxWidth: '90vw', width: 'max-content' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white/80 tracking-wide">Canvas Map</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                            {rootCanvases.length} root
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setReorderMode((v) => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                reorderMode
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                            title="Reorder canvases via up/down arrows or sequence number"
                        >
                            <ArrowUpDown size={12} />
                            {reorderMode ? 'Done' : 'Reorder'}
                        </button>
                        <button
                            onClick={() => setShowDetails((v) => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                showDetails
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                            }`}
                            title="Toggle stats per canvas"
                        >
                            <LayoutList size={12} />
                            {showDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-3 py-2 border-b border-white/10 shrink-0">
                    <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
                            placeholder="Search canvases..."
                            autoFocus
                            className="w-full pl-7 pr-7 py-1.5 text-xs text-white/80 placeholder-white/30 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-400/60 focus:bg-white/10 transition-colors"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                                title="Clear search"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tree */}
                <div className="overflow-y-auto flex-1 py-2 px-1">
                    {/* Root board row (hidden while searching — it has no name to match) */}
                    {!trimmedQuery && <div
                        className={`flex flex-col py-1 px-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                            currentPath.length === 0
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'text-white/50 hover:bg-white/8 hover:text-white/80'
                        }`}
                        onClick={() => { onNavigate([]); onClose(); }}
                    >
                        <div className="flex items-center gap-2">
                            <Home size={13} className={currentPath.length === 0 ? 'text-sky-400' : 'text-white/30'} />
                            <span className="text-xs font-semibold flex-1">Root Board</span>
                            {currentPath.length === 0 && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400/70">here</span>
                            )}
                        </div>
                        {showDetails && (() => {
                            const rootBlocks = items.filter((i) => i.type !== 'canvas').length;
                            const rootCanvasCount = rootCanvases.length;
                            const rootTime = fmtTime(items.reduce((s, i) => {
                                const t = i.timer;
                                if (!t) return s;
                                return s + t.totalElapsed + (t.isRunning ? Math.floor((Date.now() - t.startTime) / 1000) : 0);
                            }, 0));
                            const rootNet = fmtRupee(items.reduce((sum, i) => {
                                return sum + (i.financials ?? []).reduce((s, f: FinancialEntry) => {
                                    const pos = f.type === 'income' || f.type === 'inflow' || f.type === 'redemption';
                                    return s + (pos ? f.amount : -f.amount);
                                }, 0);
                            }, 0));
                            return (
                                <div className="flex flex-wrap items-center gap-1 mt-1 ml-5">
                                    {rootCanvasCount > 0 && <Pill label={`${rootCanvasCount} canvas${rootCanvasCount !== 1 ? 'es' : ''}`} color="bg-purple-500/15 text-purple-300/80" />}
                                    {rootBlocks > 0 && <Pill label={`${rootBlocks} block${rootBlocks !== 1 ? 's' : ''}`} color="bg-sky-500/15 text-sky-300/80" />}
                                    {rootTime && <Pill label={rootTime} color="bg-emerald-500/15 text-emerald-300/80" />}
                                    {rootNet && <Pill label={rootNet} color={rootNet.startsWith('+') ? 'bg-green-500/15 text-green-300/80' : 'bg-red-500/15 text-red-300/80'} />}
                                </div>
                            );
                        })()}
                    </div>}

                    {rootCanvases.length === 0 ? (
                        <p className="text-xs text-white/30 text-center py-6">No sub-canvases yet</p>
                    ) : filteredRoots.length === 0 ? (
                        <p className="text-xs text-white/30 text-center py-6">No matches for &ldquo;{trimmedQuery}&rdquo;</p>
                    ) : (
                        filteredRoots.map((canvas) => {
                            const origIdx = rootCanvases.findIndex((c) => c.id === canvas.id);
                            return (
                                <TreeNode
                                    key={canvas.id}
                                    item={canvas}
                                    path={[canvas.id]}
                                    currentPath={currentPath}
                                    depth={0}
                                    showDetails={showDetails}
                                    reorderMode={reorderMode}
                                    query={trimmedQuery}
                                    siblingIndex={origIdx}
                                    siblingCount={rootCanvases.length}
                                    onNavigate={handleNavigate}
                                    onReorder={onReorder}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Click-outside overlay */}
            <div className="fixed inset-0 -z-10" onClick={onClose} />
        </div>
    );
};
