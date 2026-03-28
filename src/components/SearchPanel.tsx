'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, X, Type, Image as ImageIcon, Link as LinkIcon, Layers, ChevronRight, Home, Hash } from 'lucide-react';
import { CanvasItem } from '@/types/canvas';

interface SearchResult {
    item: CanvasItem;
    path: string[];          // IDs of parent canvases
    pathLabels: string[];    // Display names for path
    snippet: string;
}

function flattenWithPaths(
    items: CanvasItem[],
    path: string[] = [],
    pathLabels: string[] = [],
): SearchResult[] {
    const results: SearchResult[] = [];
    for (const item of items) {
        const snippet = getSnippet(item);
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

function getSnippet(item: CanvasItem): string {
    if (item.type === 'link') {
        return item.metadata?.title || item.content;
    }
    return item.content || '';
}

function matchesQuery(result: SearchResult, query: string): boolean {
    const q = query.toLowerCase();
    const { item } = result;
    if (item.content?.toLowerCase().includes(q)) return true;
    if (item.metadata?.title?.toLowerCase().includes(q)) return true;
    if (item.metadata?.description?.toLowerCase().includes(q)) return true;
    return false;
}

function matchesTagQuery(result: SearchResult, tagQuery: string): boolean {
    const q = tagQuery.toLowerCase();
    return (result.item.tags ?? []).some(t => t.toLowerCase().includes(q));
}

function collectAllTags(items: CanvasItem[]): string[] {
    const tags = new Set<string>();
    const walk = (list: CanvasItem[]) => {
        for (const item of list) {
            (item.tags ?? []).forEach(t => tags.add(t));
            if (item.children?.length) walk(item.children);
        }
    };
    walk(items);
    return [...tags].sort();
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    text:   <Type   size={13} className="text-sky-400/80"    />,
    image:  <ImageIcon size={13} className="text-emerald-400/80" />,
    link:   <LinkIcon size={13} className="text-amber-400/80"   />,
    canvas: <Layers size={13} className="text-purple-400/80" />,
};

interface Props {
    allItems: CanvasItem[];
    onNavigate: (path: string[]) => void;
    onClose: () => void;
}

export const SearchPanel: React.FC<Props> = ({ allItems, onNavigate, onClose }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    useLayoutEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const all = flattenWithPaths(allItems);
    const allTags = collectAllTags(allItems);

    const isTagSearch = query.startsWith('#');
    const tagQuery = isTagSearch ? query.slice(1) : '';

    // Tag suggestions when user typed # but no results yet
    const tagSuggestions = isTagSearch
        ? allTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase())).slice(0, 12)
        : [];

    const results = query.trim()
        ? isTagSearch
            ? tagQuery.trim()
                ? all.filter(r => matchesTagQuery(r, tagQuery.trim()))
                : []
            : all.filter(r => matchesQuery(r, query.trim()))
        : [];

    // Reset active index when results change
    useEffect(() => { setActiveIndex(0); }, [results.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[activeIndex]) {
            navigate(results[activeIndex]);
        }
    };

    const navigate = (result: SearchResult) => {
        onNavigate(result.path);
        onClose();
    };

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl mx-4 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Input row */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                    <Search size={16} className="text-white/40 shrink-0" />
                    <input
                        ref={inputRef}
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search cards… or #tag"
                        className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none"
                    />
                    {isTagSearch && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 text-[10px] font-semibold border border-sky-500/20">
                            tag mode
                        </span>
                    )}
                    {query && (
                        <button onClick={() => setQuery('')} className="text-white/30 hover:text-white/60 transition-colors">
                            <X size={14} />
                        </button>
                    )}
                    <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-[10px] font-mono border border-white/15 rounded px-1.5 py-0.5">
                        Esc
                    </button>
                </div>

                {/* Tag suggestions when # typed but no tag yet */}
                {isTagSearch && !tagQuery.trim() && tagSuggestions.length > 0 && (
                    <div className="max-h-[60vh] overflow-y-auto">
                        <div className="px-4 pt-3 pb-1 text-[10px] text-white/30 uppercase tracking-wider font-semibold">All tags</div>
                        <div className="py-1.5">
                            {tagSuggestions.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setQuery(`#${tag}`)}
                                    className="w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
                                >
                                    <Hash size={12} className="text-sky-400/60 shrink-0" />
                                    <span className="text-sm text-white/70">{tag}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {query.trim() && (!isTagSearch || tagQuery.trim()) && (
                    <div className="max-h-[60vh] overflow-y-auto">
                        {results.length === 0 ? (
                            <div className="px-4 py-8 text-center text-white/30 text-sm">No results found</div>
                        ) : (
                            <div className="py-1.5">
                                {results.map((result, i) => (
                                    <button
                                        key={result.item.id}
                                        onClick={() => navigate(result)}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                                            i === activeIndex ? 'bg-white/8' : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="mt-0.5 shrink-0">{TYPE_ICONS[result.item.type]}</span>
                                        <div className="min-w-0 flex-1">
                                            {/* Snippet */}
                                            <div className="text-sm text-white/80 truncate">
                                                {result.snippet || <span className="italic text-white/30">Empty</span>}
                                            </div>
                                            {/* Tags */}
                                            {result.item.tags && result.item.tags.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                    {result.item.tags.map(t => (
                                                        <span
                                                            key={t}
                                                            className={`px-1.5 py-0 rounded-full text-[9px] font-semibold border ${
                                                                isTagSearch && t.toLowerCase().includes(tagQuery.toLowerCase())
                                                                    ? 'bg-sky-500/25 text-sky-300 border-sky-500/40'
                                                                    : 'bg-white/5 text-white/30 border-white/10'
                                                            }`}
                                                        >
                                                            #{t}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Path breadcrumb */}
                                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/30">
                                                <Home size={9} className="shrink-0" />
                                                {result.pathLabels.map((label, pi) => (
                                                    <React.Fragment key={pi}>
                                                        <ChevronRight size={8} className="shrink-0" />
                                                        <span className="truncate max-w-[100px]">{label}</span>
                                                    </React.Fragment>
                                                ))}
                                                {result.pathLabels.length === 0 && (
                                                    <span>Root canvas</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Type badge */}
                                        <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider text-white/20 mt-0.5">
                                            {result.item.type}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state hint */}
                {!query.trim() && (
                    <div className="px-4 py-6 text-center text-white/20 text-xs space-y-1">
                        <div>Type to search across all cards and canvases</div>
                        <div>Use <span className="text-sky-400/50 font-mono">#tag</span> to filter by tag</div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-2 border-t border-white/8 flex items-center gap-4 text-[10px] text-white/20">
                    <span>↑↓ navigate</span>
                    <span>↵ open</span>
                    <span className="ml-auto">{results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''}` : ''}</span>
                </div>
            </div>
        </div>
    );
};
