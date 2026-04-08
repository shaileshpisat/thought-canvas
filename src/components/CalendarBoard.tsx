'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar as CalendarIcon, Clock, Tag, Flag, Layers, X, ListChecks } from 'lucide-react';
import { CanvasItem, CanvasHistoryEntry, CanvasAction, FinancialEntry } from '@/types/canvas';

interface Props {
  items: CanvasItem[];
  onClose: () => void;
  onNavigateToItem: (item: CanvasItem, path: string[]) => void;
}

interface CalendarItemData {
  item: CanvasItem;
  path: string[];
}

interface CalendarData {
  blocksWithDate: Record<string, CalendarItemData[]>; // day -> item+path
  blocksWithHistory: Record<string, Map<string, { item: CalendarItemData; entries: CanvasHistoryEntry[] }>>; // day -> itemID -> {item, entries}
  actionsOnDay: Record<string, Map<string, { item: CalendarItemData; actions: CanvasAction[] }>>; // day -> itemID -> {item, actions}
  tagsOnDay: Record<string, Map<string, Set<string>>>; // day -> tag -> set of unique item IDs
  canvasTitles: Map<string, string>; // id -> name for canvases
  canvasesOnDay: Record<string, Set<string>>; // day -> set of active canvas IDs
}

const PRIORITY_CFG: Record<string, { bar: string; text: string; badge: string }> = {
  'very-high': { bar: 'bg-rose-500',   text: 'text-rose-400',   badge: 'bg-rose-500/15 border-rose-500/25' },
  'high':      { bar: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/15 border-orange-500/25' },
  'medium':    { bar: 'bg-amber-500',  text: 'text-amber-400',  badge: 'bg-amber-500/15 border-amber-500/25' },
  'low':       { bar: 'bg-sky-500',    text: 'text-sky-400',    badge: 'bg-sky-500/15 border-sky-500/25' },
  'very-low':  { bar: 'bg-slate-500',  text: 'text-slate-400',  badge: 'bg-slate-500/15 border-slate-500/25' },
};
const DEFAULT_PRIORITY_CFG = { bar: 'bg-violet-500', text: 'text-violet-300', badge: 'bg-violet-500/15 border-violet-500/25' };
const priorityColor = (p?: string) => (p && PRIORITY_CFG[p]) ? PRIORITY_CFG[p] : DEFAULT_PRIORITY_CFG;

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function financialNet(financials: FinancialEntry[]): number {
    return financials.reduce((sum, f) => {
        const positive = f.type === 'income' || f.type === 'inflow' || f.type === 'redemption';
        return sum + (positive ? f.amount : -f.amount);
    }, 0);
}

function formatRupees(amount: number): string {
    return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(amount));
}

export const CalendarBoard: React.FC<Props> = ({ items, onClose, onNavigateToItem }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [pinnedPopup, setPinnedPopup] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [fullHistoryModal, setFullHistoryModal] = useState<{ item: CalendarItemData; entries: CanvasHistoryEntry[]; dateStr: string } | null>(null);

  const calendarData = useMemo(() => {
    const data: CalendarData = { blocksWithDate: {}, blocksWithHistory: {}, actionsOnDay: {}, tagsOnDay: {}, canvasTitles: new Map(), canvasesOnDay: {} };

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const traverse = (itemList: CanvasItem[], path: string[]) => {
      for (const item of itemList) {
        if (item.type === 'canvas') {
          data.canvasTitles.set(item.id, item.content);
        }

        const itemWithData: CalendarItemData = { item, path };
        
        if (item.date) {
          if (!data.blocksWithDate[item.date]) data.blocksWithDate[item.date] = [];
          data.blocksWithDate[item.date].push(itemWithData);
        }

        if (item.history) {
          for (const entry of item.history) {
            const entryDate = formatDate(new Date(entry.timestamp));
            if (!data.blocksWithHistory[entryDate]) data.blocksWithHistory[entryDate] = new Map();
            if (!data.tagsOnDay[entryDate]) data.tagsOnDay[entryDate] = new Map();
            if (!data.canvasesOnDay[entryDate]) data.canvasesOnDay[entryDate] = new Set();
            
            if (!data.blocksWithHistory[entryDate].has(item.id)) {
              data.blocksWithHistory[entryDate].set(item.id, { item: itemWithData, entries: [] });
            }
            data.blocksWithHistory[entryDate].get(item.id)!.entries.push(entry);

            // Track active canvas
            if (path.length > 0) {
              data.canvasesOnDay[entryDate].add(path[path.length - 1]);
            }
            if (item.type === 'canvas') {
              data.canvasesOnDay[entryDate].add(item.id);
            }

            // Extract tags from history action
            if (entry.type === 'tag') {
              const tagMatch = entry.action.match(/(?:Added|Removed) tag: (.+)/);
              if (tagMatch) {
                const tagName = tagMatch[1];
                if (!data.tagsOnDay[entryDate].has(tagName)) {
                  data.tagsOnDay[entryDate].set(tagName, new Set());
                }
                data.tagsOnDay[entryDate].get(tagName)!.add(item.id);
              }
            }
          }
        }

        if (item.actions) {
          for (const action of item.actions) {
            const actionDate = formatDate(new Date(action.timestamp));
            if (!data.actionsOnDay[actionDate]) data.actionsOnDay[actionDate] = new Map();
            if (!data.actionsOnDay[actionDate].has(item.id)) {
              data.actionsOnDay[actionDate].set(item.id, { item: itemWithData, actions: [] });
            }
            data.actionsOnDay[actionDate].get(item.id)!.actions.push(action);
          }
        }

        if (item.children) traverse(item.children, [...path, item.id]);
      }
    };

    traverse(items, []);
    return data;
  }, [items]);

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const formatDateLabel = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const getDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDuration = (secs: number) => {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  return (
    <div className="fixed inset-0 z-[500] bg-canvas-bg flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 glass">
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white flex items-center gap-2 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-base font-semibold uppercase tracking-wider">Back to Board</span>

          </button>
          
          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarIcon size={20} className="text-sky-400" />
              Week Board
            </h1>

            <span className="text-white/30 text-base font-medium">
              {formatDateLabel(weekDays[0])} — {formatDateLabel(weekDays[6])}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-white/60">
            <Clock size={16} className="text-sky-400/70" />
            <span className="text-lg font-mono font-semibold tabular-nums tracking-wider">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 glass rounded-xl p-1">
          <button
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() - 7);
              setCurrentDate(d);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() + 7);
              setCurrentDate(d);
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Backdrop to close pinned popup */}
      {pinnedPopup && (
        <div className="fixed inset-0 z-[999]" onClick={() => setPinnedPopup(null)} />
      )}

      {/* Calendar Grid */}
      {(() => {
        // Fixed slot layout: [pre: 00-09], [hourly: 10-20], [post: 21-23]
        const HOURLY_START = 10;
        const HOURLY_END = 20; // inclusive
        const hourlySlots = Array.from({ length: HOURLY_END - HOURLY_START + 1 }, (_, i) => HOURLY_START + i);
        // Map an entry's hour to a slot key: 'pre' | number (10-20) | 'post'
        const slotKey = (h: number): 'pre' | number | 'post' => h < HOURLY_START ? 'pre' : h > HOURLY_END ? 'post' : h;

        return (
          <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
            {/* Sticky header: time gutter + day name/badge columns */}
            <div
              className="sticky top-0 z-20 grid shrink-0 bg-[#0b0f1a]/95 backdrop-blur-sm border-b border-white/5 shadow-lg"
              style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
            >
              {/* Gutter spacer */}
              <div className="border-r border-white/5" />
              {weekDays.map((day) => {
                const dateStr = getDateStr(day);
                const isToday = dateStr === getDateStr(new Date());
                return (
                  <div key={dateStr} className={`py-3 px-2 border-r border-white/5 last:border-r-0 flex flex-col items-center gap-1 ${isToday ? 'bg-sky-500/[0.05]' : ''}`}>
                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-sky-400' : 'text-white/20'}`}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className={`text-2xl font-display font-bold w-9 h-9 flex items-center justify-center rounded-full leading-none transition-all ${isToday ? 'bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)]' : 'text-white/60'}`}>
                      {day.getDate()}
                    </span>
                    {(() => {
                      const dayFinancials = (calendarData.blocksWithDate[dateStr] ?? []).flatMap(d => d.item.financials ?? []);
                      if (dayFinancials.length === 0) return null;
                      const net = financialNet(dayFinancials);
                      return (
                        <span className={`text-[9px] font-bold tabular-nums tracking-tight ${net >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                          Funds: {net >= 0 ? '' : '-'}{formatRupees(net)}
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>

                {/* Time gutter column */}
                <div className="sticky left-0 z-10 border-r border-white/5 bg-[#0b0f1a]">
                  {/* All-day row spacer */}
                  <div className="border-b border-white/5" style={{ height: '52px' }} />
                  {/* Pre block: 00:00–09:59 */}
                  <div className="border-b border-white/[0.06] flex flex-col items-end justify-between pr-2.5 py-2" style={{ height: '56px' }}>
                    <span className="text-sm font-mono text-white/15 whitespace-nowrap">00:00</span>
                    <span className="text-[11px] font-mono text-white/10 whitespace-nowrap">09:59</span>
                  </div>
                  {/* Hourly blocks: 10:00–20:59 */}
                  {hourlySlots.map(hour => (
                    <div key={hour} className="border-b border-white/[0.04] flex items-start justify-end pr-2.5 pt-2" style={{ height: '48px' }}>
                      <span className="text-sm font-mono text-white/15 whitespace-nowrap">{String(hour).padStart(2, '0')}:00</span>
                    </div>
                  ))}
                  {/* Post block: 21:00–23:59 */}
                  <div className="border-b border-white/[0.06] flex flex-col items-end justify-between pr-2.5 py-2" style={{ height: '56px' }}>
                    <span className="text-sm font-mono text-white/15 whitespace-nowrap">21:00</span>
                    <span className="text-[11px] font-mono text-white/10 whitespace-nowrap">23:59</span>
                  </div>
                </div>

                {/* Day columns */}
                {weekDays.map((day, idx) => {
                  const dateStr = getDateStr(day);
                  const isToday = dateStr === getDateStr(new Date());
                  const itemsOnDay = calendarData.blocksWithDate[dateStr] || [];
                  const historyBlocksOnDay = calendarData.blocksWithHistory[dateStr];

                  // Build slot → blocks map: one dot per block per slot it has activity in
                  type SlotKey = 'pre' | number | 'post';
                  const slotMap = new Map<SlotKey, Array<{ item: CalendarItemData; slotEntries: CanvasHistoryEntry[]; allEntries: CanvasHistoryEntry[]; tagsInHistory: Set<string> }>>();
                  if (historyBlocksOnDay) {
                    historyBlocksOnDay.forEach(({ item, entries }) => {
                      const tagsInHistory = new Set<string>();
                      entries.forEach(e => {
                        if (e.type === 'tag') {
                          const match = e.action.match(/(?:Added|Removed) tag: (.+)/);
                          if (match) tagsInHistory.add(match[1]);
                        }
                      });
                      // Group entries by slot
                      const bySlot = new Map<SlotKey, CanvasHistoryEntry[]>();
                      entries.forEach(e => {
                        const sk = slotKey(new Date(e.timestamp).getHours());
                        if (!bySlot.has(sk)) bySlot.set(sk, []);
                        bySlot.get(sk)!.push(e);
                      });
                      bySlot.forEach((slotEntries, sk) => {
                        if (!slotMap.has(sk)) slotMap.set(sk, []);
                        slotMap.get(sk)!.push({ item, slotEntries, allEntries: entries, tagsInHistory });
                      });
                    });
                  }

                  // Build slot → manual actions map: one square capsule per block per slot
                  const actionSlotMap = new Map<SlotKey, Array<{ item: CalendarItemData; slotActions: CanvasAction[] }>>();
                  const actionBlocksOnDay = calendarData.actionsOnDay[dateStr];
                  if (actionBlocksOnDay) {
                    actionBlocksOnDay.forEach(({ item, actions }) => {
                      const bySlot = new Map<SlotKey, CanvasAction[]>();
                      actions.forEach(a => {
                        const sk = slotKey(new Date(a.timestamp).getHours());
                        if (!bySlot.has(sk)) bySlot.set(sk, []);
                        bySlot.get(sk)!.push(a);
                      });
                      bySlot.forEach((slotActions, sk) => {
                        if (!actionSlotMap.has(sk)) actionSlotMap.set(sk, []);
                        actionSlotMap.get(sk)!.push({ item, slotActions });
                      });
                    });
                  }

                  const popupSide = idx >= 4 ? 'right-full mr-2' : 'left-full ml-2';

                  const renderActionCapsules = (sk: SlotKey) => {
                    const actionBlocks = actionSlotMap.get(sk) || [];
                    return actionBlocks.map(({ item, slotActions }) => {
                      const capsuleKey = `log-${item.item.id}-${String(sk)}`;
                      const isPinned = pinnedPopup === capsuleKey;
                      const blockTitle = item.item.content?.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                      // Strip markdown: headings, bold, italic, inline code, links
                      const plainTitle = blockTitle.replace(/^#{1,6}\s+/, '').replace(/[*_`~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
                      const capsuleLabel = plainTitle.slice(0, 15);
                      const totalDuration = slotActions.reduce((sum, a) => sum + a.duration, 0);
                      return (
                        <div key={capsuleKey} className="relative group flex items-center">
                          <button
                            onClick={() => setPinnedPopup(isPinned ? null : capsuleKey)}
                            className={`px-1.5 py-0.5 rounded-sm text-[9px] font-semibold tracking-tight whitespace-nowrap transition-all active:scale-95 shrink-0 ${isPinned ? 'bg-sky-400/30 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.4)] ring-1 ring-sky-400/50' : 'bg-sky-500/15 text-sky-400/70 hover:bg-sky-500/25 hover:text-sky-300 ring-1 ring-sky-500/20'}`}
                            title={`${plainTitle} — ${slotActions.length} log${slotActions.length > 1 ? 's' : ''}`}
                          >
                            {capsuleLabel}
                          </button>
                          <div onClick={e => e.stopPropagation()} className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}>
                            <div className="bg-[#0b101c] p-4 rounded-[20px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                              <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-sky-500/40`} />
                              <h4 className="text-sm font-black text-sky-300 mb-1 flex items-center gap-2 leading-tight">
                                <ListChecks size={12} className="text-sky-400 shrink-0" />
                                <span className="truncate">{plainTitle.length > 32 ? plainTitle.slice(0, 32) + '…' : plainTitle}</span>
                              </h4>
                              {item.path.length > 0 && (
                                <div className="text-[10px] text-sky-400/40 font-medium mb-3">in {calendarData.canvasTitles.get(item.path[item.path.length - 1]) || 'Sub-canvas'}</div>
                              )}
                              <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-white/30">
                                <span>{slotActions.length} {slotActions.length === 1 ? 'entry' : 'entries'}</span>
                                {totalDuration > 0 && <><span className="text-white/10">·</span><span>{fmtDuration(totalDuration)}</span></>}
                              </div>
                              <div className="space-y-2">
                                {[...slotActions].sort((a, b) => a.timestamp - b.timestamp).map(a => (
                                  <div key={a.id} className="flex gap-2 items-baseline">
                                    <span className="text-[10px] font-mono text-sky-400/70 shrink-0">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="text-[11px] text-white/65 leading-snug flex-1">{a.label}</span>
                                    {a.duration > 0 && <span className="text-[9px] font-mono text-white/20 shrink-0">{fmtDuration(a.duration)}</span>}
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => { setPinnedPopup(null); onNavigateToItem(item.item, item.path); }}
                                className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 hover:border-sky-500/40 text-[11px] font-semibold text-sky-400/70 hover:text-sky-300 transition-all"
                              >
                                Show on Canvas
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  };

                  return (
                    <div key={dateStr} className={`border-r border-white/5 last:border-r-0 ${isToday ? 'bg-sky-500/[0.02]' : ''}`}>

                      {/* All-day row: scheduled cards + green dots + canvases + tags */}
                      <div className="border-b border-white/[0.06] px-2 py-1.5 flex flex-wrap gap-1 items-start bg-white/[0.01]" style={{ minHeight: '52px' }}>
                        {[...itemsOnDay].sort((a, b) => {
                            if (a.item.time && b.item.time) return a.item.time.localeCompare(b.item.time);
                            if (a.item.time) return -1;
                            if (b.item.time) return 1;
                            return 0;
                          }).map(({ item, path }) => {
                          const isPinned = pinnedPopup === `green-${item.id}`;
                          if (item.showOnWeekBoard) {
                            const colors = priorityColor(item.priority);
                            const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                            return (
                              <div key={item.id} className="relative group">
                                <button
                                  onClick={() => setPinnedPopup(isPinned ? null : `green-${item.id}`)}
                                  className={`rounded-lg border ${colors.badge} overflow-hidden flex flex-col px-2 py-1 text-left transition-all hover:brightness-125 active:scale-95 relative ${isPinned ? 'ring-1 ring-sky-400/50' : ''}`}
                                >
                                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${colors.bar}`} />
                                  <span className={`text-[10px] font-bold leading-tight truncate pl-1 max-w-[100px] ${colors.text}`}>
                                    {item.recurring && <span className="text-emerald-400/80 mr-1 text-[9px]">↻</span>}
                                    {label}
                                  </span>
                                  {item.time && (
                                    <span className="text-[9px] text-white/30 font-mono pl-1 leading-tight mt-0.5">
                                      {formatTime(item.time)}
                                    </span>
                                  )}
                                </button>
                                <div onClick={e => e.stopPropagation()} className={`absolute top-0 transition-all duration-200 z-[1000] w-64 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}>
                                  <div className="bg-[#0b101c] p-4 rounded-[20px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                                    <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} ${colors.bar} opacity-60`} />
                                    <p className={`text-sm font-black mb-1 leading-snug truncate ${colors.text}`}>{label}</p>
                                    {path.length > 0 && <div className="text-[11px] text-sky-400/40 font-medium mb-2">in sub-canvas</div>}
                                    {item.time && <div className="flex items-center gap-1 text-[11px] font-mono text-white/50 mb-2"><Clock size={10} className="text-violet-400" />{formatTime(item.time)}</div>}
                                    {item.priority && <div className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider mb-2 ${colors.text}`}><Flag size={9} />{item.priority.replace('-', ' ')}</div>}
                                    {item.tags && item.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {item.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 flex items-center gap-1"><Tag size={7} />{t}</span>)}
                                      </div>
                                    )}
                                    <button onClick={() => { setPinnedPopup(null); onNavigateToItem(item, path); }} className={`mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${colors.badge} border text-[11px] font-semibold ${colors.text} hover:brightness-125 transition-all`}>
                                      Show on Canvas
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={item.id} className="relative group flex items-center gap-0.5">
                              <button
                                onClick={() => setPinnedPopup(isPinned ? null : `green-${item.id}`)}
                                className={`w-3 h-3 rounded-full transition-all hover:scale-125 active:scale-95 shrink-0 ${isPinned ? 'bg-green-300 shadow-[0_0_12px_rgba(34,197,94,0.6)] scale-110' : 'bg-green-500/80 hover:bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.3)]'}`}
                              />
                              {item.priority && <Flag size={9} className={`shrink-0 ${item.priority === 'very-high' ? 'text-rose-400' : item.priority === 'high' ? 'text-orange-400' : item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`} />}
                              <div onClick={e => e.stopPropagation()} className={`absolute top-0 transition-all duration-200 z-[1000] w-64 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}>
                                <div className="bg-[#0b101c] p-4 rounded-[20px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                                  <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-green-500/40`} />
                                  <p className="text-sm text-white/90 font-medium leading-relaxed mb-2.5 truncate">
                                    {(() => { const l = item.content?.split('\n')[0] || 'Untitled'; return l.length > 80 ? l.slice(0, 80) + '...' : l; })()}
                                  </p>
                                  {path.length > 0 && <div className="text-[11px] text-sky-400/40 font-medium mb-3">in {calendarData.canvasTitles.get(path[path.length - 1]) || 'Sub-canvas'}</div>}
                                  {item.priority && (
                                    <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider pt-2 border-t border-white/5 ${item.priority === 'very-high' ? 'text-rose-400' : item.priority === 'high' ? 'text-orange-400' : item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`}>
                                      <Flag size={9} />{item.priority.replace('-', ' ')}
                                    </div>
                                  )}
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {item.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 flex items-center gap-1"><Tag size={7} />{t}</span>)}
                                    </div>
                                  )}
                                  <button onClick={() => { setPinnedPopup(null); onNavigateToItem(item, path); }} className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-green-400/70 hover:text-green-300 transition-all">
                                    Show on Canvas
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Canvases inline */}
                        {calendarData.canvasesOnDay[dateStr] && Array.from(calendarData.canvasesOnDay[dateStr]).map(id => (
                          <span key={id} className="px-1.5 py-0.5 bg-sky-500/10 border border-sky-500/15 rounded text-[10px] font-bold text-sky-300/30 flex items-center gap-1 cursor-default hover:text-sky-300/60 transition-colors">
                            <Layers size={7} />{calendarData.canvasTitles.get(id) || 'Sub-canvas'}
                          </span>
                        ))}

                        {/* Tags inline */}
                        {calendarData.tagsOnDay[dateStr] && Array.from(calendarData.tagsOnDay[dateStr].entries()).map(([tag, blockIds]) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/15 rounded text-[10px] font-bold text-amber-300/30 flex items-center gap-1 cursor-default hover:text-amber-300/60 transition-colors">
                            <Tag size={7} />#{tag}<span className="opacity-50 font-mono">{blockIds.size}</span>
                          </span>
                        ))}
                      </div>

                      {/* Pre block: 00:00–09:59 */}
                      {(() => {
                        const blocks = slotMap.get('pre') || [];
                        return (
                          <div className="border-b border-white/[0.06] relative px-1.5 py-1 flex flex-wrap gap-1 items-start bg-white/[0.005] hover:bg-white/[0.01] transition-colors" style={{ height: '56px' }}>
                            {renderActionCapsules('pre')}
                            {blocks.map(({ item, slotEntries, allEntries, tagsInHistory }) => {
                              const dotKey = `yellow-${item.item.id}-pre`;
                              const isYellowPinned = pinnedPopup === dotKey;
                              return (
                                <div key={dotKey} className="relative group flex items-center gap-0.5">
                                  <button onClick={() => setPinnedPopup(isYellowPinned ? null : dotKey)} className={`w-3 h-3 rounded-full transition-all hover:scale-125 active:scale-95 shrink-0 ${isYellowPinned ? 'bg-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-110' : 'bg-amber-500/80 hover:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'}`} />
                                  {item.item.priority && <Flag size={9} className={`shrink-0 ${item.item.priority === 'very-high' ? 'text-rose-400' : item.item.priority === 'high' ? 'text-orange-400' : item.item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`} />}
                                  <div onClick={e => e.stopPropagation()} className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isYellowPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}>
                                    <div className="bg-[#0b101c] p-5 rounded-[24px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                                      <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-amber-500/40`} />
                                      <h4 className="text-base font-black text-amber-300 mb-2 flex items-center gap-2 leading-tight"><Clock size={13} className="text-amber-400 shrink-0" /><span>{(() => { const text = item.item.content?.split('\n')[0] || 'Untitled'; return text.length > 30 ? text.slice(0, 30) + '...' : text; })()}<span className="text-white/30 font-bold text-sm ml-1.5">— {slotEntries.length} {slotEntries.length === 1 ? 'action' : 'actions'}</span></span></h4>
                                      {item.path.length > 0 && <div className="text-[11px] text-sky-400/40 font-medium mb-3.5">in {calendarData.canvasTitles.get(item.path[item.path.length - 1]) || 'Sub-canvas'}</div>}
                                      <div className="flex flex-wrap items-center gap-3 mb-4 opacity-80">{item.item.date && <div className="flex items-center gap-1.5 text-sm font-bold text-white/30 uppercase tracking-wider"><CalendarIcon size={11} />{item.item.date}</div>}{item.item.priority && <div className={`flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider ${item.item.priority === 'very-high' ? 'text-rose-400' : item.item.priority === 'high' ? 'text-orange-400' : item.item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`}><Flag size={11} />{item.item.priority.replace('-', ' ')}</div>}{item.item.tags && item.item.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{item.item.tags.slice(0, 4).map(t => <span key={t} className={`text-[11px] font-bold ${tagsInHistory.has(t) ? 'text-amber-400 bg-amber-400/10 px-1 rounded' : 'text-white/20'}`}>#{t}</span>)}{item.item.tags.length > 4 && <span className="text-[11px] text-white/10">+{item.item.tags.length - 4}</span>}</div>}</div>
                                      <div className="space-y-2.5">{[...slotEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8).map(entry => (<div key={entry.id} className="flex gap-3.5"><span className="text-sm font-mono text-amber-400 shrink-0 font-black">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="text-sm text-white/70 leading-relaxed italic">{entry.action}</span></div>))}{slotEntries.length > 8 && <div className="text-sm text-white/20 italic pt-1.5 border-t border-white/5">+ {slotEntries.length - 8} more entries</div>}</div>
                                      <div className="mt-4 flex gap-2"><button onClick={() => { setPinnedPopup(null); onNavigateToItem(item.item, item.path); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-400/70 hover:text-amber-300 transition-all">Show on Canvas</button><button onClick={() => { setPinnedPopup(null); setFullHistoryModal({ item, entries: allEntries, dateStr }); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-300/80 hover:text-amber-200 transition-all">Show Full History</button></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Hourly rows: 10:00–20:59 */}
                      {hourlySlots.map(hour => {
                        const blocks = slotMap.get(hour) || [];
                        const isCurrentHour = isToday && new Date().getHours() === hour;
                        return (
                          <div
                            key={hour}
                            className={`border-b border-white/[0.04] relative px-1.5 py-1 flex flex-wrap gap-1 items-start transition-colors ${isCurrentHour ? 'bg-sky-500/[0.04]' : 'hover:bg-white/[0.01]'}`}
                            style={{ height: '48px' }}
                          >
                            {isCurrentHour && <div className="absolute left-0 top-0 w-full h-px bg-sky-400/40" />}
                            {renderActionCapsules(hour)}
                            {blocks.map(({ item, slotEntries, allEntries, tagsInHistory }) => {
                              const dotKey = `yellow-${item.item.id}-${hour}`;
                              const isYellowPinned = pinnedPopup === dotKey;
                              return (
                                <div key={dotKey} className="relative group flex items-center gap-0.5">
                                  <button
                                    onClick={() => setPinnedPopup(isYellowPinned ? null : dotKey)}
                                    className={`w-3 h-3 rounded-full transition-all hover:scale-125 active:scale-95 shrink-0 ${isYellowPinned ? 'bg-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-110' : 'bg-amber-500/80 hover:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'}`}
                                  />
                                  {item.item.priority && <Flag size={9} className={`shrink-0 ${item.item.priority === 'very-high' ? 'text-rose-400' : item.item.priority === 'high' ? 'text-orange-400' : item.item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`} />}

                                  <div onClick={e => e.stopPropagation()} className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isYellowPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}>
                                    <div className="bg-[#0b101c] p-5 rounded-[24px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                                      <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-amber-500/40`} />
                                      <h4 className="text-base font-black text-amber-300 mb-2 flex items-center gap-2 leading-tight">
                                        <Clock size={13} className="text-amber-400 shrink-0" />
                                        <span>
                                          {(() => { const text = item.item.content?.split('\n')[0] || 'Untitled'; return text.length > 30 ? text.slice(0, 30) + '...' : text; })()}
                                          <span className="text-white/30 font-bold text-sm ml-1.5">— {slotEntries.length} {slotEntries.length === 1 ? 'action' : 'actions'}</span>
                                        </span>
                                      </h4>
                                      {item.path.length > 0 && <div className="text-[11px] text-sky-400/40 font-medium mb-3.5">in {calendarData.canvasTitles.get(item.path[item.path.length - 1]) || 'Sub-canvas'}</div>}
                                      <div className="flex flex-wrap items-center gap-3 mb-4 opacity-80">
                                        {item.item.date && <div className="flex items-center gap-1.5 text-sm font-bold text-white/30 uppercase tracking-wider"><CalendarIcon size={11} />{item.item.date}</div>}
                                        {item.item.priority && <div className={`flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider ${item.item.priority === 'very-high' ? 'text-rose-400' : item.item.priority === 'high' ? 'text-orange-400' : item.item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`}><Flag size={11} />{item.item.priority.replace('-', ' ')}</div>}
                                        {item.item.tags && item.item.tags.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {item.item.tags.slice(0, 4).map(t => <span key={t} className={`text-[11px] font-bold ${tagsInHistory.has(t) ? 'text-amber-400 bg-amber-400/10 px-1 rounded' : 'text-white/20'}`}>#{t}</span>)}
                                            {item.item.tags.length > 4 && <span className="text-[11px] text-white/10">+{item.item.tags.length - 4}</span>}
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-2.5">
                                        {[...slotEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8).map(entry => (
                                          <div key={entry.id} className="flex gap-3.5">
                                            <span className="text-sm font-mono text-amber-400 shrink-0 font-black">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="text-sm text-white/70 leading-relaxed italic">{entry.action}</span>
                                          </div>
                                        ))}
                                        {slotEntries.length > 8 && <div className="text-sm text-white/20 italic pt-1.5 border-t border-white/5">+ {slotEntries.length - 8} more entries</div>}
                                      </div>
                                      <div className="mt-4 flex gap-2">
                                        <button onClick={() => { setPinnedPopup(null); onNavigateToItem(item.item, item.path); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-400/70 hover:text-amber-300 transition-all">
                                          Show on Canvas
                                        </button>
                                        <button onClick={() => { setPinnedPopup(null); setFullHistoryModal({ item, entries: allEntries, dateStr }); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-300/80 hover:text-amber-200 transition-all">
                                          Show Full History
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Post block: 21:00–23:59 */}
                      {(() => {
                        const blocks = slotMap.get('post') || [];
                        return (
                          <div className="border-b border-white/[0.06] relative px-1.5 py-1 flex flex-wrap gap-1 items-start bg-white/[0.005] hover:bg-white/[0.01] transition-colors" style={{ height: '56px' }}>
                            {renderActionCapsules('post')}
                            {blocks.map(({ item, slotEntries, allEntries, tagsInHistory }) => {
                              const dotKey = `yellow-${item.item.id}-post`;
                              const isYellowPinned = pinnedPopup === dotKey;
                              return (
                                <div key={dotKey} className="relative group flex items-center gap-0.5">
                                  <button onClick={() => setPinnedPopup(isYellowPinned ? null : dotKey)} className={`w-3 h-3 rounded-full transition-all hover:scale-125 active:scale-95 shrink-0 ${isYellowPinned ? 'bg-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-110' : 'bg-amber-500/80 hover:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'}`} />
                                  {item.item.priority && <Flag size={9} className={`shrink-0 ${item.item.priority === 'very-high' ? 'text-rose-400' : item.item.priority === 'high' ? 'text-orange-400' : item.item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`} />}
                                  <div onClick={e => e.stopPropagation()} className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isYellowPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}>
                                    <div className="bg-[#0b101c] p-5 rounded-[24px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                                      <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-amber-500/40`} />
                                      <h4 className="text-base font-black text-amber-300 mb-2 flex items-center gap-2 leading-tight"><Clock size={13} className="text-amber-400 shrink-0" /><span>{(() => { const text = item.item.content?.split('\n')[0] || 'Untitled'; return text.length > 30 ? text.slice(0, 30) + '...' : text; })()}<span className="text-white/30 font-bold text-sm ml-1.5">— {slotEntries.length} {slotEntries.length === 1 ? 'action' : 'actions'}</span></span></h4>
                                      {item.path.length > 0 && <div className="text-[11px] text-sky-400/40 font-medium mb-3.5">in {calendarData.canvasTitles.get(item.path[item.path.length - 1]) || 'Sub-canvas'}</div>}
                                      <div className="flex flex-wrap items-center gap-3 mb-4 opacity-80">{item.item.date && <div className="flex items-center gap-1.5 text-sm font-bold text-white/30 uppercase tracking-wider"><CalendarIcon size={11} />{item.item.date}</div>}{item.item.priority && <div className={`flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider ${item.item.priority === 'very-high' ? 'text-rose-400' : item.item.priority === 'high' ? 'text-orange-400' : item.item.priority === 'medium' ? 'text-amber-400' : 'text-sky-400'}`}><Flag size={11} />{item.item.priority.replace('-', ' ')}</div>}{item.item.tags && item.item.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{item.item.tags.slice(0, 4).map(t => <span key={t} className={`text-[11px] font-bold ${tagsInHistory.has(t) ? 'text-amber-400 bg-amber-400/10 px-1 rounded' : 'text-white/20'}`}>#{t}</span>)}{item.item.tags.length > 4 && <span className="text-[11px] text-white/10">+{item.item.tags.length - 4}</span>}</div>}</div>
                                      <div className="space-y-2.5">{[...slotEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8).map(entry => (<div key={entry.id} className="flex gap-3.5"><span className="text-sm font-mono text-amber-400 shrink-0 font-black">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="text-sm text-white/70 leading-relaxed italic">{entry.action}</span></div>))}{slotEntries.length > 8 && <div className="text-sm text-white/20 italic pt-1.5 border-t border-white/5">+ {slotEntries.length - 8} more entries</div>}</div>
                                      <div className="mt-4 flex gap-2"><button onClick={() => { setPinnedPopup(null); onNavigateToItem(item.item, item.path); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-400/70 hover:text-amber-300 transition-all">Show on Canvas</button><button onClick={() => { setPinnedPopup(null); setFullHistoryModal({ item, entries: allEntries, dateStr }); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-300/80 hover:text-amber-200 transition-all">Show Full History</button></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Full History Popup */}
      {fullHistoryModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-8"
          onClick={() => setFullHistoryModal(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-80 max-h-[80vh] flex flex-col bg-[#0b101c] border border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/40" />

            <div className="p-5 border-b border-white/5 flex items-start justify-between gap-3">
              <h4 className="text-base font-black text-amber-300 flex items-center gap-2 leading-tight min-w-0">
                <Clock size={13} className="text-amber-400 shrink-0" />
                <span className="min-w-0">
                  {(() => { const text = fullHistoryModal.item.item.content?.split('\n')[0] || 'Untitled'; return text.length > 28 ? text.slice(0, 28) + '...' : text; })()}
                  <span className="text-white/30 font-bold text-sm ml-1.5">— {fullHistoryModal.entries.length} {fullHistoryModal.entries.length === 1 ? 'action' : 'actions'}</span>
                </span>
              </h4>
              <button onClick={() => setFullHistoryModal(null)} className="p-1 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white shrink-0">
                <X size={13} />
              </button>
            </div>

            {fullHistoryModal.item.path.length > 0 && (
              <div className="px-5 pt-3 text-[11px] text-sky-400/40 font-medium flex items-center gap-1">
                in {calendarData.canvasTitles.get(fullHistoryModal.item.path[fullHistoryModal.item.path.length - 1]) || 'Sub-canvas'}
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2.5">
              {[...fullHistoryModal.entries].sort((a, b) => b.timestamp - a.timestamp).map(entry => (
                <div key={entry.id} className="flex gap-3.5">
                  <span className="text-sm font-mono text-amber-400 shrink-0 font-black">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm text-white/70 leading-relaxed italic">{entry.action}</span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/5 flex gap-2">
              <button
                onClick={() => { setFullHistoryModal(null); onNavigateToItem(fullHistoryModal.item.item, fullHistoryModal.item.path); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-amber-400/70 hover:text-amber-300 transition-all"
              >
                Show on Canvas
              </button>
              <button
                onClick={() => setFullHistoryModal(null)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-white/30 hover:text-white/60 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};
