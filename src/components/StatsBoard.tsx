'use client';

import React, { useEffect, useMemo } from 'react';
import {
    Type, Image as ImageIcon, Layers, Link as LinkIcon,
    Hash, Calendar, Repeat, Home, ChevronRight, Pin, Wallet, Activity,
} from 'lucide-react';
import { CanvasItem, WalletAccount, FinancialEntry, CanvasAction } from '@/types/canvas';
import { flattenItems, recursOnDate, todayDateStr } from '@/utils/dateUtils';

interface BlockRow {
    item: CanvasItem;
    path: string[];
    pathLabels: string[];
}

function flattenWithPaths(
    items: CanvasItem[],
    path: string[] = [],
    pathLabels: string[] = [],
): BlockRow[] {
    const rows: BlockRow[] = [];
    for (const item of items) {
        rows.push({ item, path, pathLabels });
        if (item.children?.length) {
            rows.push(
                ...flattenWithPaths(
                    item.children,
                    [...path, item.id],
                    [...pathLabels, item.content || 'Untitled Canvas'],
                ),
            );
        }
    }
    return rows;
}

function stripMarkdown(md: string): string {
    return md
        .replace(/```[\s\S]*?```/g, '')              // fenced code blocks
        .replace(/`([^`]+)`/g, '$1')                  // inline code
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')         // images
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')      // links → text
        .replace(/^#{1,6}\s+/gm, '')                  // headings
        .replace(/^\s*>\s?/gm, '')                    // blockquotes
        .replace(/^\s*[-*+]\s+/gm, '')                // bullets
        .replace(/^\s*\d+\.\s+/gm, '')                // numbered lists
        .replace(/\*\*([^*]+)\*\*/g, '$1')            // bold
        .replace(/__([^_]+)__/g, '$1')                // bold
        .replace(/\*([^*]+)\*/g, '$1')                // italic
        .replace(/_([^_]+)_/g, '$1')                  // italic
        .replace(/~~([^~]+)~~/g, '$1')                // strikethrough
        .replace(/^\s*[-–—]{3,}\s*$/gm, '')           // hr
        .replace(/\n{2,}/g, ' · ')                    // paragraph breaks → bullet sep
        .replace(/\s+/g, ' ')
        .trim();
}

function getSnippet(item: CanvasItem): string {
    if (item.type === 'link') return item.metadata?.title || item.content;
    if (item.type === 'image') return item.caption || 'Image';
    if (item.type === 'canvas') return item.content || 'Untitled Canvas';
    return stripMarkdown(item.content || '');
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    text:   <Type      size={13} className="text-sky-400/80"     />,
    image:  <ImageIcon size={13} className="text-emerald-400/80" />,
    link:   <LinkIcon  size={13} className="text-amber-400/80"   />,
    canvas: <Layers    size={13} className="text-purple-400/80"  />,
};

interface WalletSummary {
    wallet: WalletAccount | { id: string; name: string; accountType: string };
    totalIn: number;
    totalOut: number;
    net: number;
}

const UNASSIGNED_ID = '__unassigned__';
const INFLOW_TYPES = new Set(['income', 'inflow', 'redemption']);

function buildWalletSummaries(allFlat: CanvasItem[], wallets: WalletAccount[]): WalletSummary[] {
    const totals = new Map<string, { totalIn: number; totalOut: number }>();
    for (const w of wallets) totals.set(w.id, { totalIn: 0, totalOut: 0 });
    totals.set(UNASSIGNED_ID, { totalIn: 0, totalOut: 0 });

    for (const item of allFlat) {
        for (const fe of (item.financials ?? []) as FinancialEntry[]) {
            const key = fe.wallet && totals.has(fe.wallet) ? fe.wallet : UNASSIGNED_ID;
            const t = totals.get(key)!;
            if (INFLOW_TYPES.has(fe.type)) t.totalIn += fe.amount;
            else t.totalOut += fe.amount;
        }
    }

    const results: WalletSummary[] = wallets
        .map(w => { const t = totals.get(w.id)!; return { wallet: w, ...t, net: t.totalIn - t.totalOut }; })
        .filter(s => s.totalIn > 0 || s.totalOut > 0);

    const u = totals.get(UNASSIGNED_ID)!;
    if (u.totalIn > 0 || u.totalOut > 0) {
        results.push({ wallet: { id: UNASSIGNED_ID, name: 'Unassigned', accountType: '' }, ...u, net: u.totalIn - u.totalOut });
    }
    return results;
}

interface Props {
    allItems: CanvasItem[];
    wallets: WalletAccount[];
    onNavigate: (path: string[], itemId?: string) => void;
    onClose: () => void;
    fullScreen?: boolean;
}

export const StatsBoard: React.FC<Props> = ({ allItems, wallets, onNavigate, onClose, fullScreen }) => {
    useEffect(() => {
        if (fullScreen) return; // Canvas handles Escape for full-screen view
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, fullScreen]);

    const today = todayDateStr();
    const allFlat = useMemo(() => flattenItems(allItems), [allItems]);
    const rows = useMemo(() => flattenWithPaths(allItems), [allItems]);

    const counts = useMemo(() => {
        let canvas = 0, text = 0, image = 0, link = 0;
        for (const it of allFlat) {
            if (it.type === 'canvas') canvas++;
            else if (it.type === 'text') text++;
            else if (it.type === 'image') image++;
            else if (it.type === 'link') link++;
        }
        return { canvas, text, image, link };
    }, [allFlat]);

    const tagCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const it of allFlat) {
            for (const t of it.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }, [allFlat]);

    const maxTagCount = tagCounts.length > 0 ? tagCounts[0][1] : 0;

    const walletSummaries = useMemo(
        () => buildWalletSummaries(allFlat, wallets),
        [allFlat, wallets],
    );

    const fmt = (n: number) =>
        n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

    const todayBlocks = useMemo(
        () => rows.filter(r => r.item.date === today && !r.item.recurring),
        [rows, today],
    );

    const recurringToday = useMemo(
        () => rows.filter(r => r.item.recurring && recursOnDate(r.item, today)),
        [rows, today],
    );

    const pinnedItems = useMemo(
        () => rows.filter(r => r.item.pinned),
        [rows],
    );

    interface ActivityEntry extends CanvasAction {
        itemLabel: string;
        itemPath: string[];
        itemId: string;
    }

    const allActivity = useMemo<ActivityEntry[]>(() => {
        const entries: ActivityEntry[] = [];
        for (const row of rows) {
            for (const action of row.item.actions ?? []) {
                entries.push({
                    ...action,
                    itemLabel: getSnippet(row.item) || 'Untitled',
                    itemPath: row.path,
                    itemId: row.item.id,
                });
            }
        }
        return entries.sort((a, b) => b.timestamp - a.timestamp);
    }, [rows]);

    const tagFontSize = (count: number) => {
        if (maxTagCount <= 1) return 14;
        const ratio = count / maxTagCount;
        return Math.round(11 + ratio * 17); // 11 → 28 px
    };

    const tagOpacity = (count: number) => {
        if (maxTagCount <= 1) return 0.8;
        return 0.45 + (count / maxTagCount) * 0.55; // 0.45 → 1.0
    };

    const navigate = (row: BlockRow) => {
        onNavigate(row.path, row.item.id);
        onClose();
    };

    const inner = (
        <div
            className={fullScreen
                ? 'absolute inset-x-0 bottom-0 flex flex-col overflow-hidden'
                : 'w-full max-w-6xl mx-4 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]'}
            style={fullScreen ? { background: 'rgba(8, 12, 24, 0.98)', top: '88px' } : { background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)' }}
            onClick={fullScreen ? undefined : e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
                <Home size={18} className="text-sky-400 shrink-0" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">Home</h2>
                <span className="text-[11px] text-white/30 ml-1">
                    {new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {!fullScreen && (
                    <button
                        onClick={onClose}
                        className="ml-auto text-white/30 hover:text-white/60 transition-colors text-[10px] font-mono border border-white/15 rounded px-1.5 py-0.5"
                    >
                        Esc
                    </button>
                )}
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* Left column — wider: pinned + today + recurring */}
                <div className="flex-[3] overflow-y-auto px-6 py-5 space-y-6 border-r border-white/[0.06]">

                    {/* Pinned Items */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Pin size={12} className="text-amber-300/80 fill-current" />
                            <div className="text-[10px] uppercase tracking-wider font-bold text-white/30">Pinned Items</div>
                            <div className="text-[10px] text-white/25">{pinnedItems.length}</div>
                        </div>
                        <HorizontalCardStrip rows={pinnedItems} onSelect={navigate} emptyText="No pinned items." scheme="amber" />
                    </section>

                    {/* Today's blocks */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar size={12} className="text-green-400/80" />
                            <div className="text-[10px] uppercase tracking-wider font-bold text-white/30">Blocks Dated Today</div>
                            <div className="text-[10px] text-white/25">{todayBlocks.length}</div>
                        </div>
                        <CardGrid5 rows={todayBlocks} onSelect={navigate} emptyText="No blocks scheduled for today." scheme="emerald" />
                    </section>

                    {/* Recurring today */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Repeat size={12} className="text-emerald-400/80" />
                            <div className="text-[10px] uppercase tracking-wider font-bold text-white/30">Recurring Today</div>
                            <div className="text-[10px] text-white/25">{recurringToday.length}</div>
                        </div>
                        <CardGrid5 rows={recurringToday} onSelect={navigate} emptyText="No recurring blocks fall on today." scheme="emerald" showRecurringMark />
                    </section>

                    {/* Activity */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={12} className="text-violet-400/80" />
                            <div className="text-[10px] uppercase tracking-wider font-bold text-white/30">Activity</div>
                            <div className="text-[10px] text-white/25">{allActivity.length}</div>
                        </div>
                        {allActivity.length === 0 ? (
                            <div className="text-[12px] text-white/25 italic px-2 py-2">No activity logged yet.</div>
                        ) : (
                            <div className="rounded-lg border border-white/5 bg-white/[0.02] divide-y divide-white/5 overflow-hidden">
                                {allActivity.map(entry => (
                                    <button
                                        key={entry.id}
                                        onClick={() => { onNavigate(entry.itemPath, entry.itemId); onClose(); }}
                                        className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[13px] text-white/80 truncate">{entry.label}</div>
                                            <div className="text-[10px] text-white/35 truncate">{entry.itemLabel}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {entry.duration > 0 && (
                                                <div className="text-[10px] font-mono text-violet-400/70">
                                                    {entry.duration >= 3600
                                                        ? `${Math.floor(entry.duration / 3600)}h ${Math.floor((entry.duration % 3600) / 60)}m`
                                                        : entry.duration >= 60
                                                            ? `${Math.floor(entry.duration / 60)}m ${entry.duration % 60}s`
                                                            : `${entry.duration}s`}
                                                </div>
                                            )}
                                            <div className="text-[9px] text-white/25">
                                                {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Right column — narrower: totals + tag cloud + wallets */}
                <div className="flex-[2] overflow-y-auto px-5 py-5 space-y-6">

                    {/* Totals */}
                    <section>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-white/30 mb-2">Totals</div>
                        <div className="grid grid-cols-4 gap-2">
                            <StatTile icon={<Layers size={16} className="text-purple-400/80" />} label="Canvases" value={counts.canvas} accent="text-purple-300" />
                            <StatTile icon={<Type size={16} className="text-sky-400/80" />} label="Text" value={counts.text} accent="text-sky-300" />
                            <StatTile icon={<ImageIcon size={16} className="text-emerald-400/80" />} label="Image" value={counts.image} accent="text-emerald-300" />
                            <StatTile icon={<LinkIcon size={16} className="text-amber-400/80" />} label="Link" value={counts.link} accent="text-amber-300" />
                        </div>
                    </section>

                    {/* Tag cloud */}
                    <section>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-white/30">Tag Cloud</div>
                            <div className="text-[10px] text-white/25">{tagCounts.length} unique</div>
                        </div>
                        {tagCounts.length === 0 ? (
                            <div className="text-[12px] text-white/30 italic">No tags yet.</div>
                        ) : (
                            <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
                                {tagCounts.map(([tag, count]) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-baseline gap-1 text-sky-300 hover:text-sky-200 transition-colors"
                                        style={{ fontSize: `${tagFontSize(count)}px`, opacity: tagOpacity(count) }}
                                        title={`${count} block${count !== 1 ? 's' : ''}`}
                                    >
                                        <Hash size={Math.max(9, tagFontSize(count) * 0.55)} className="text-sky-400/60 shrink-0" />
                                        <span className="font-semibold">{tag}</span>
                                        <span className="text-white/35 font-mono text-[10px] ml-0.5">{count}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Wallet Balances */}
                    {walletSummaries.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2 mb-2">
                                <Wallet size={12} className="text-sky-400/80" />
                                <div className="text-[10px] uppercase tracking-wider font-bold text-white/30">Wallet Balances</div>
                                <div className="text-[10px] text-white/25">{walletSummaries.length}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {walletSummaries.map(({ wallet, totalIn, totalOut, net }) => (
                                    <div
                                        key={wallet.id}
                                        className={`rounded-xl border px-3 py-3 flex flex-col gap-1 ${wallet.id === UNASSIGNED_ID ? 'border-white/5 border-dashed bg-white/[0.02]' : 'border-white/8 bg-white/[0.03]'}`}
                                    >
                                        <div className="flex items-center justify-between gap-1 min-w-0">
                                            <span className={`text-[11px] font-semibold truncate ${wallet.id === UNASSIGNED_ID ? 'text-white/30 italic' : 'text-white/70'}`}>
                                                {wallet.name}
                                            </span>
                                            {wallet.accountType && (
                                                <span className="text-[9px] text-white/25 uppercase tracking-wider shrink-0">{wallet.accountType}</span>
                                            )}
                                        </div>
                                        <div className={`text-xl font-black font-mono tabular-nums ${net >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                                            {fmt(net)}
                                        </div>
                                        <div className="flex gap-2 text-[10px]">
                                            <span className="text-emerald-400/60">↑ {fmt(totalIn)}</span>
                                            <span className="text-red-400/60">↓ {fmt(totalOut)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );

    if (fullScreen) {
        return inner;
    }

    return (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[4vh]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            {inner}
        </div>
    );
};

type StripScheme = 'emerald' | 'amber';

const SCHEME_CLASSES: Record<StripScheme, string> = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40',
    amber:   'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40',
};

function HorizontalCardStrip({
    rows,
    onSelect,
    emptyText,
    scheme,
    showRecurringMark,
}: {
    rows: BlockRow[];
    onSelect: (row: BlockRow) => void;
    emptyText: string;
    scheme: StripScheme;
    showRecurringMark?: boolean;
}) {
    if (rows.length === 0) {
        return <div className="text-[12px] text-white/25 italic px-2 py-2">{emptyText}</div>;
    }
    const schemeCls = SCHEME_CLASSES[scheme];
    return (
        <div className="-mx-1 px-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 pb-2 min-w-max">
                {rows.map(row => {
                    const snippet = getSnippet(row.item);
                    return (
                        <button
                            key={row.item.id}
                            onClick={() => onSelect(row)}
                            className={`shrink-0 w-64 h-36 rounded-xl border transition-all text-left px-3 py-2.5 flex flex-col gap-1.5 group ${schemeCls}`}
                        >
                            <div className="flex items-center gap-1.5">
                                {showRecurringMark && <span className="text-emerald-400/90 text-[11px]">↻</span>}
                                {scheme === 'amber' && <Pin size={11} className="text-amber-300/90 fill-current" />}
                                {TYPE_ICONS[row.item.type]}
                                {row.item.time && (
                                    <span className="text-[10px] font-mono text-white/45">{row.item.time}</span>
                                )}
                                <span className="ml-auto text-[8px] uppercase font-bold tracking-wider text-white/25 group-hover:text-white/45">
                                    {row.item.type}
                                </span>
                            </div>
                            <div className="text-[13px] text-white/85 leading-snug flex-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                {snippet || <span className="italic text-white/30">Empty</span>}
                            </div>
                            {row.item.tags && row.item.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                    {row.item.tags.slice(0, 3).map(t => (
                                        <span key={t} className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-white/5 text-white/40 border-white/10">
                                            #{t}
                                        </span>
                                    ))}
                                    {row.item.tags.length > 3 && (
                                        <span className="text-[9px] text-white/25">+{row.item.tags.length - 3}</span>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-white/30">
                                <Home size={9} className="shrink-0" />
                                {row.pathLabels.slice(-2).map((label, i) => (
                                    <React.Fragment key={i}>
                                        <ChevronRight size={8} className="shrink-0" />
                                        <span className="truncate max-w-[90px]">{label}</span>
                                    </React.Fragment>
                                ))}
                                {row.pathLabels.length === 0 && <span>Root</span>}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function CardGrid5({
    rows,
    onSelect,
    emptyText,
    scheme,
    showRecurringMark,
}: {
    rows: BlockRow[];
    onSelect: (row: BlockRow) => void;
    emptyText: string;
    scheme: StripScheme;
    showRecurringMark?: boolean;
}) {
    if (rows.length === 0) {
        return <div className="text-[12px] text-white/25 italic px-2 py-2">{emptyText}</div>;
    }
    const schemeCls = SCHEME_CLASSES[scheme];
    return (
        <div className="grid grid-cols-5 gap-2">
            {rows.map(row => {
                const snippet = getSnippet(row.item);
                return (
                    <button
                        key={row.item.id}
                        onClick={() => onSelect(row)}
                        className={`rounded-xl border transition-all text-left px-3 py-2.5 flex flex-col gap-1.5 group ${schemeCls}`}
                    >
                        <div className="flex items-center gap-1.5">
                            {showRecurringMark && <span className="text-emerald-400/90 text-[11px]">↻</span>}
                            {TYPE_ICONS[row.item.type]}
                            {row.item.time && (
                                <span className="text-[10px] font-mono text-white/45">{row.item.time}</span>
                            )}
                        </div>
                        <div className="text-[12px] text-white/85 leading-snug flex-1 overflow-hidden line-clamp-3">
                            {snippet || <span className="italic text-white/30">Empty</span>}
                        </div>
                        {row.item.tags && row.item.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                                {row.item.tags.slice(0, 2).map(t => (
                                    <span key={t} className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-white/5 text-white/40 border-white/10">
                                        #{t}
                                    </span>
                                ))}
                                {row.item.tags.length > 2 && (
                                    <span className="text-[9px] text-white/25">+{row.item.tags.length - 2}</span>
                                )}
                            </div>
                        )}
                        <div className="flex items-center gap-1 text-[9px] text-white/25">
                            <Home size={8} className="shrink-0" />
                            {row.pathLabels.length === 0
                                ? <span>Root</span>
                                : <span className="truncate">{row.pathLabels[row.pathLabels.length - 1]}</span>
                            }
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
    return (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-white/40">
                {icon}
                <span>{label}</span>
            </div>
            <div className={`text-2xl font-black font-mono tabular-nums ${accent}`}>{value}</div>
        </div>
    );
}

function BlockList({
    rows,
    onSelect,
    emptyText,
    showRecurringMark,
}: {
    rows: BlockRow[];
    onSelect: (row: BlockRow) => void;
    emptyText: string;
    showRecurringMark?: boolean;
}) {
    if (rows.length === 0) {
        return <div className="text-[12px] text-white/25 italic px-2 py-2">{emptyText}</div>;
    }
    return (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] divide-y divide-white/5 overflow-hidden">
            {rows.map(row => (
                <button
                    key={row.item.id}
                    onClick={() => onSelect(row)}
                    className="w-full text-left px-3 py-2 flex items-start gap-3 hover:bg-white/5 transition-colors"
                >
                    <span className="mt-0.5 shrink-0">{TYPE_ICONS[row.item.type]}</span>
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-white/80 truncate flex items-center gap-1.5">
                            {showRecurringMark && <span className="text-emerald-400/80 text-[11px]">↻</span>}
                            {getSnippet(row.item) || <span className="italic text-white/30">Empty</span>}
                            {row.item.time && (
                                <span className="ml-1 text-[10px] font-mono text-white/35">{row.item.time}</span>
                            )}
                        </div>
                        {row.item.tags && row.item.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {row.item.tags.map(t => (
                                    <span key={t} className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-white/5 text-white/35 border-white/10">
                                        #{t}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/30">
                            <Home size={9} className="shrink-0" />
                            {row.pathLabels.map((label, i) => (
                                <React.Fragment key={i}>
                                    <ChevronRight size={8} className="shrink-0" />
                                    <span className="truncate max-w-[120px]">{label}</span>
                                </React.Fragment>
                            ))}
                            {row.pathLabels.length === 0 && <span>Root canvas</span>}
                        </div>
                    </div>
                    <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider text-white/20 mt-0.5">
                        {row.item.type}
                    </span>
                </button>
            ))}
        </div>
    );
}
