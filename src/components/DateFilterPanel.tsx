'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, X, Type, Image as ImageIcon, Link as LinkIcon, Layers, ChevronRight, Home, ChevronLeft } from 'lucide-react';
import { CanvasItem } from '@/types/canvas';
import { getDateStatus } from '@/utils/dateUtils';

interface DateResult {
    item: CanvasItem;
    path: string[];
    pathLabels: string[];
}

function flattenWithPaths(
    items: CanvasItem[],
    path: string[] = [],
    pathLabels: string[] = [],
): DateResult[] {
    const results: DateResult[] = [];
    for (const item of items) {
        results.push({ item, path, pathLabels });
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
    if (item.type === 'link') return item.metadata?.title || item.content;
    return item.content || '';
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    text:   <Type      size={13} className="text-sky-400/80"      />,
    image:  <ImageIcon size={13} className="text-emerald-400/80"  />,
    link:   <LinkIcon  size={13} className="text-amber-400/80"    />,
    canvas: <Layers    size={13} className="text-purple-400/80"   />,
};

const STATUS_DOT: Record<string, string> = {
    today:      'bg-green-400',
    'past-week': 'bg-red-400',
    'past-old':  'bg-red-400',
    future:     'bg-sky-400',
};

interface Props {
    allItems: CanvasItem[];
    initialDate: string;           // YYYY-MM-DD clicked in the calendar
    onNavigate: (path: string[]) => void;
    onClose: () => void;
}

export const DateFilterPanel: React.FC<Props> = ({ allItems, initialDate, onNavigate, onClose }) => {
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [activeIndex, setActiveIndex] = useState(0);

    // Calendar nav state
    const [calDate] = useState(() => {
        const [y, m] = selectedDate.split('-').map(Number);
        return new Date(y, m - 1, 1);
    });
    const [viewDate, setViewDate] = useState(calDate);

    const pad = (n: number) => String(n).padStart(2, '0');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const all = flattenWithPaths(allItems);

    // Build a set of dates that have items, for the mini calendar
    const datesWithItems = new Set(all.filter(r => r.item.date).map(r => r.item.date!));

    const results = all.filter(r => r.item.date === selectedDate);

    useEffect(() => { setActiveIndex(0); }, [selectedDate]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') setActiveIndex(i => Math.min(i + 1, results.length - 1));
            if (e.key === 'ArrowUp')   setActiveIndex(i => Math.max(i - 1, 0));
            if (e.key === 'Enter' && results[activeIndex]) navigate(results[activeIndex]);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [results, activeIndex, onClose]);

    const navigate = (result: DateResult) => {
        onNavigate(result.path);
        onClose();
    };

    // Mini calendar helpers
    const yr = viewDate.getFullYear();
    const mo = viewDate.getMonth();
    const firstDay = new Date(yr, mo, 1);
    const lastDay  = new Date(yr, mo + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    const getDs = (d: number) => `${yr}-${pad(mo + 1)}-${pad(d)}`;

    const status = getDateStatus(selectedDate);
    const dotColor = STATUS_DOT[status] ?? 'bg-white/30';

    const formatDate = (ds: string) => {
        const [y, m, d] = ds.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl mx-4 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex"
                style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)', maxHeight: '75vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Left: mini calendar */}
                <div className="w-52 shrink-0 border-r border-white/10 p-3 flex flex-col gap-2">
                    {/* Month nav */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setViewDate(new Date(yr, mo - 1, 1))}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white"
                        >
                            <ChevronLeft size={12} />
                        </button>
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                            {viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                        <button
                            onClick={() => setViewDate(new Date(yr, mo + 1, 1))}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white"
                        >
                            <ChevronRight size={12} />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7">
                        {['M','T','W','T','F','S','S'].map((d, i) => (
                            <div key={i} className="text-center text-[9px] font-bold text-white/20 py-0.5">{d}</div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-y-0.5">
                        {days.map((day, i) => {
                            if (!day) return <div key={`e${i}`} className="h-6" />;
                            const ds = getDs(day);
                            const hasItems = datesWithItems.has(ds);
                            const isSelected = ds === selectedDate;
                            const isToday = ds === todayStr;
                            const s = hasItems ? getDateStatus(ds) : null;
                            return (
                                <div
                                    key={day}
                                    className={`flex flex-col items-center justify-center h-6 ${hasItems ? 'cursor-pointer' : ''}`}
                                    onClick={() => hasItems && setSelectedDate(ds)}
                                >
                                    <span className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-medium transition-all
                                        ${isSelected ? 'bg-white/20 ring-2 ring-white/50 text-white' :
                                          s === 'today' ? 'bg-green-500/25 text-green-300 ring-1 ring-green-500/40' :
                                          s === 'past-old' || s === 'past-week' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' :
                                          s === 'future' ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30' :
                                          isToday ? 'ring-1 ring-white/20 text-white/60' :
                                          'text-white/30'}`}>
                                        {day}
                                    </span>
                                    {hasItems && !isSelected && (
                                        <div className={`w-1 h-1 rounded-full mt-0.5 ${s ? STATUS_DOT[s] : 'bg-white/20'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: results */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10">
                        <CalendarDays size={15} className="text-white/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white/80">{formatDate(selectedDate)}</span>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                            </div>
                            <div className="text-[10px] text-white/30 mt-0.5">
                                {results.length} block{results.length !== 1 ? 's' : ''} on this date
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-[10px] font-mono border border-white/15 rounded px-1.5 py-0.5">
                            Esc
                        </button>
                    </div>

                    {/* Results list */}
                    <div className="flex-1 overflow-y-auto">
                        {results.length === 0 ? (
                            <div className="px-4 py-10 text-center text-white/25 text-sm">No blocks on this date</div>
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
                                            <div className="text-sm text-white/80 truncate">
                                                {getSnippet(result.item) || <span className="italic text-white/30">Empty</span>}
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/30">
                                                <Home size={9} className="shrink-0" />
                                                {result.pathLabels.map((label, pi) => (
                                                    <React.Fragment key={pi}>
                                                        <ChevronRight size={8} className="shrink-0" />
                                                        <span className="truncate max-w-[100px]">{label}</span>
                                                    </React.Fragment>
                                                ))}
                                                {result.pathLabels.length === 0 && <span>Root canvas</span>}
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider text-white/20 mt-0.5">
                                            {result.item.type}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-white/8 flex items-center gap-4 text-[10px] text-white/20">
                        <span>↑↓ navigate</span>
                        <span>↵ open</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
