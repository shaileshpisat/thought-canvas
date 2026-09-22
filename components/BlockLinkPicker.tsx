'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Type, Image as ImageIcon, Link as LinkIcon, Layers, ChevronRight, Home } from 'lucide-react';
import { CanvasItem } from '@/types/canvas';

interface SearchResult {
    item: CanvasItem;
    path: string[];
    pathLabels: string[];
    snippet: string;
}

function flattenWithPaths(
    items: CanvasItem[],
    path: string[] = [],
    pathLabels: string[] = [],
): SearchResult[] {
    const results: SearchResult[] = [];
    for (const item of items) {
        const snippet = item.type === 'link'
            ? (item.metadata?.title || item.content)
            : (item.content || '');
        results.push({ item, path, pathLabels, snippet });
        if (item.children?.length) {
            results.push(
                ...flattenWithPaths(
                    item.children,
                    [...path, item.id],
                    [...pathLabels, item.content || 'Untitled Canvas'],
                ),
            );
        }
    }
    return results;
}

function matchesQuery(result: SearchResult, query: string): boolean {
    const q = query.toLowerCase();
    const { item } = result;
    if (item.content?.toLowerCase().includes(q)) return true;
    if (item.metadata?.title?.toLowerCase().includes(q)) return true;
    return false;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    text:   <Type   size={13} className="text-sky-400/80"    />,
    image:  <ImageIcon size={13} className="text-emerald-400/80" />,
    link:   <LinkIcon size={13} className="text-amber-400/80"   />,
    canvas: <Layers size={13} className="text-purple-400/80" />,
};

interface Props {
    allItems: CanvasItem[];
    /** Anchor position for the popup (near the cursor in the textarea) */
    anchorPos: { top: number; left: number };
    /** Called with the chosen item so the caller can insert the block link */
    onPick: (item: CanvasItem, path: string[]) => void;
    onClose: () => void;
}

export const BlockLinkPicker: React.FC<Props> = ({ allItems, anchorPos, onPick, onClose }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    useLayoutEffect(() => { inputRef.current?.focus(); }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const all = flattenWithPaths(allItems);
    const results = query.trim()
        ? all.filter(r => matchesQuery(r, query.trim()))
        : all.slice(0, 20);

    useEffect(() => { setActiveIndex(0); }, [results.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && results[activeIndex]) {
            e.preventDefault();
            onPick(results[activeIndex].item, results[activeIndex].path);
        }
    };

    // Position: prefer below anchor, stay within viewport
    const panelWidth = 340;
    const left = Math.min(anchorPos.left, window.innerWidth - panelWidth - 16);

    return createPortal(
        <div
            className="fixed inset-0 z-[500]"
            onMouseDown={onClose}
        >
            <div
                className="absolute rounded-xl shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                style={{
                    top: anchorPos.top,
                    left: Math.max(8, left),
                    width: panelWidth,
                    background: 'rgba(8, 12, 24, 0.98)',
                    backdropFilter: 'blur(20px)',
                }}
                onMouseDown={e => e.stopPropagation()}
            >
                {/* Input */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
                    <Search size={13} className="text-white/35 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Link to a block…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none"
                    />
                    <span className="text-[9px] font-mono text-white/25 border border-white/15 rounded px-1">Esc</span>
                </div>

                {/* Results */}
                <div className="max-h-60 overflow-y-auto py-1">
                    {results.length === 0 ? (
                        <div className="px-4 py-5 text-center text-white/30 text-xs">No blocks found</div>
                    ) : results.map((r, i) => (
                        <button
                            key={r.item.id}
                            onMouseEnter={() => setActiveIndex(i)}
                            onMouseDown={e => { e.preventDefault(); onPick(r.item, r.path); }}
                            className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${
                                i === activeIndex ? 'bg-white/8' : 'hover:bg-white/5'
                            }`}
                        >
                            <span className="mt-0.5 shrink-0">{TYPE_ICONS[r.item.type]}</span>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm text-white/80 truncate">
                                    {r.snippet || <span className="italic text-white/30">Empty</span>}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/30">
                                    <Home size={9} className="shrink-0" />
                                    {r.pathLabels.map((label, pi) => (
                                        <React.Fragment key={pi}>
                                            <ChevronRight size={8} className="shrink-0" />
                                            <span className="truncate max-w-[80px]">{label}</span>
                                        </React.Fragment>
                                    ))}
                                    {r.pathLabels.length === 0 && <span>Root</span>}
                                </div>
                            </div>
                            <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider text-white/20 mt-0.5">
                                {r.item.type}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};
