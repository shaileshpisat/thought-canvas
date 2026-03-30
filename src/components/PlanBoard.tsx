'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, ClipboardList, Clock, Tag, Flag, X } from 'lucide-react';
import { CanvasItem, CanvasHistoryEntry } from '@/types/canvas';

interface Props {
  items: CanvasItem[];
  recurringDays: number;
  onClose: () => void;
  onNavigateToItem: (item: CanvasItem, path: string[]) => void;
}

interface PlanItemData {
  item: CanvasItem;
  path: string[];
}

export const PlanBoard: React.FC<Props> = ({ items, recurringDays, onClose, onNavigateToItem }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [historyModal, setHistoryModal] = useState<{ item: CanvasItem; path: string[]; entries: CanvasHistoryEntry[] } | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const getDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }, [currentDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Only collect items with date + time + duration
  const planItems = useMemo(() => {
    const result: PlanItemData[] = [];

    const traverse = (itemList: CanvasItem[], path: string[]) => {
      for (const item of itemList) {
        if (item.date && item.time && item.duration != null) {
          result.push({ item, path });
        }
        if (item.children) traverse(item.children, [...path, item.id]);
      }
    };

    traverse(items, []);
    return result;
  }, [items]);

  // Items by date — recurring items expanded to cover origin through 365 days from today,
  // so any navigable week within the year shows recurring blocks correctly.
  const byDate = useMemo(() => {
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const occurrences = (item: CanvasItem): string[] => {
      if (!item.recurring || !item.date) return [item.date!];

      const origin = new Date(item.date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Window ends `recurringDays` days after the origin date
      const windowEnd = new Date(origin);
      windowEnd.setDate(windowEnd.getDate() + recurringDays);

      // Never show occurrences before the origin date
      const effectiveStart = origin > today ? origin : today;
      const dates: string[] = [];

      const push = (d: Date) => {
        if (d >= effectiveStart && d <= windowEnd) dates.push(fmt(d));
      };

      if (item.recurring === 'daily') {
        const cur = new Date(effectiveStart);
        while (cur <= windowEnd) { dates.push(fmt(cur)); cur.setDate(cur.getDate() + 1); }

      } else if (item.recurring === 'weekly') {
        // First occurrence on or after effectiveStart that shares origin's weekday
        const cur = new Date(effectiveStart);
        const skip = (origin.getDay() - cur.getDay() + 7) % 7;
        cur.setDate(cur.getDate() + skip);
        while (cur <= windowEnd) { push(new Date(cur)); cur.setDate(cur.getDate() + 7); }

      } else if (item.recurring === 'weekdays') {
        const cur = new Date(effectiveStart);
        while (cur <= windowEnd) {
          const d = cur.getDay();
          if (d !== 0 && d !== 6) dates.push(fmt(cur));
          cur.setDate(cur.getDate() + 1);
        }

      } else if (item.recurring === 'biweekly') {
        // Walk forward from origin in 14-day steps until we reach effectiveStart
        const cur = new Date(origin);
        while (cur < effectiveStart) cur.setDate(cur.getDate() + 14);
        while (cur <= windowEnd) { push(new Date(cur)); cur.setDate(cur.getDate() + 14); }

      } else if (item.recurring === 'monthly') {
        const day = origin.getDate();
        const cur = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), day);
        if (cur < effectiveStart) cur.setMonth(cur.getMonth() + 1);
        while (cur <= windowEnd) {
          push(new Date(cur));
          cur.setMonth(cur.getMonth() + 1);
          cur.setDate(day);
        }
      }

      return dates.length > 0 ? dates : [item.date!];
    };

    const map: Record<string, PlanItemData[]> = {};
    for (const p of planItems) {
      for (const d of occurrences(p.item)) {
        if (!map[d]) map[d] = [];
        map[d].push(p);
      }
    }
    return map;
  }, [planItems, recurringDays]);

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const priorityColor = (p?: string) => {
    if (p === 'very-high') return { bar: 'bg-rose-500', text: 'text-rose-400', badge: 'bg-rose-500/15 border-rose-500/25' };
    if (p === 'high') return { bar: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/15 border-orange-500/25' };
    if (p === 'medium') return { bar: 'bg-amber-500', text: 'text-amber-400', badge: 'bg-amber-500/15 border-amber-500/25' };
    if (p === 'low') return { bar: 'bg-sky-500', text: 'text-sky-400', badge: 'bg-sky-500/15 border-sky-500/25' };
    if (p === 'very-low') return { bar: 'bg-slate-500', text: 'text-slate-400', badge: 'bg-slate-500/15 border-slate-500/25' };
    return { bar: 'bg-violet-500', text: 'text-violet-300', badge: 'bg-violet-500/15 border-violet-500/25' };
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  const totalMinutesForWeek = useMemo(() => {
    return weekDays.reduce((sum, d) => {
      const ds = getDateStr(d);
      return sum + (byDate[ds] || []).reduce((s, { item }) => s + (item.duration ?? 0), 0);
    }, 0);
  }, [weekDays, byDate]);

  const canvasTitles = useMemo(() => {
    const map = new Map<string, string>();
    const traverse = (list: CanvasItem[]) => {
      for (const item of list) {
        if (item.type === 'canvas') map.set(item.id, item.content);
        if (item.children) traverse(item.children);
      }
    };
    traverse(items);
    return map;
  }, [items]);

  return (
    <div className="fixed inset-0 z-[500] bg-canvas-bg flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 glass shrink-0">
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
              <ClipboardList size={20} className="text-violet-400" />
              Plan Board
            </h1>
            <span className="text-white/30 text-sm font-medium">
              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-3 text-white/40 text-sm">
            <Clock size={14} className="text-violet-400/70" />
            <span className="font-mono font-semibold tabular-nums tracking-wider">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-violet-300/60 font-semibold">{formatDuration(totalMinutesForWeek)}</span>
            <span className="text-white/20 text-xs">this week</span>
          </div>
        </div>

        <div className="flex items-center gap-2 glass rounded-xl p-1">
          <button
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
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
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Backdrop to close popup */}
      {activePopup && (
        <div className="fixed inset-0 z-[999]" onClick={() => setActivePopup(null)} />
      )}

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
        {/* Sticky day-header row */}
        <div
          className="sticky top-0 z-20 grid shrink-0 bg-[#0b0f1a]/95 backdrop-blur-sm border-b border-white/5 shadow-lg"
          style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}
        >
          <div className="border-r border-white/5" />
          {weekDays.map((day) => {
            const dateStr = getDateStr(day);
            const isToday = dateStr === getDateStr(new Date());
            const dayItems = byDate[dateStr] || [];
            const dayTotal = dayItems.reduce((s, { item }) => s + (item.duration ?? 0), 0);
            return (
              <div key={dateStr} className={`py-3 px-2 border-r border-white/5 last:border-r-0 flex flex-col items-center gap-1 ${isToday ? 'bg-violet-500/[0.05]' : ''}`}>
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-violet-400' : 'text-white/20'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={`text-2xl font-display font-bold w-9 h-9 flex items-center justify-center rounded-full leading-none ${isToday ? 'bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.35)]' : 'text-white/60'}`}>
                  {day.getDate()}
                </span>
                {dayTotal > 0 && (
                  <span className="text-[10px] font-bold text-violet-300/50 tabular-nums">{formatDuration(dayTotal)}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Pre-block row: 00:00–09:59, height 72px */}
          <div className="grid border-b border-white/[0.04]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Gutter */}
            <div className="sticky left-0 z-10 border-r border-white/5 bg-[#0b0f1a] flex flex-col justify-between py-1 pr-2.5" style={{ height: '72px' }}>
              <span className="text-[10px] font-mono text-white/10 whitespace-nowrap text-right">00:00</span>
              <span className="text-[10px] font-mono text-white/10 whitespace-nowrap text-right">09:59</span>
            </div>
            {weekDays.map((day, idx) => {
              const dateStr = getDateStr(day);
              const isToday = dateStr === getDateStr(new Date());
              const dayItems = (byDate[dateStr] || []).filter(({ item }) => {
                const h = parseInt(item.time!.split(':')[0], 10);
                return h < 10;
              });
              const popupSide = idx >= 4 ? 'right-full mr-2' : 'left-full ml-2';
              return (
                <div
                  key={dateStr}
                  className={`border-r border-white/5 last:border-r-0 ${isToday ? 'bg-violet-500/[0.015]' : ''}`}
                  style={{ height: '72px' }}
                >
                  <div className="flex flex-col gap-1 p-1 h-full overflow-visible">
                    {dayItems.map(({ item, path }) => {
                      const dur = item.duration ?? 30;
                      const colors = priorityColor(item.priority);
                      const popupKey = `plan-${item.id}`;
                      const isPinned = activePopup === popupKey;
                      const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                      return (
                        <div key={item.id} className="relative group shrink-0">
                          <button
                            onClick={() => setActivePopup(isPinned ? null : popupKey)}
                            className={`w-full rounded border ${colors.badge} overflow-hidden flex flex-col px-2 py-0.5 text-left transition-all hover:brightness-125 active:scale-95 relative ${isPinned ? 'ring-1 ring-violet-400/50' : ''}`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${colors.bar}`} />
                            <span className={`text-[11px] font-bold leading-tight truncate pl-1 flex items-center gap-1 ${colors.text}`}>
                              {item.recurring && <span className="text-emerald-400/80 shrink-0 text-[10px]">↻</span>}
                              {label}
                            </span>
                            <span className="text-[10px] text-white/30 font-mono pl-1 leading-tight tabular-nums">
                              {item.time} · {formatDuration(dur)}
                            </span>
                          </button>
                          {/* Popup */}
                          <div
                            onClick={e => e.stopPropagation()}
                            className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}
                          >
                            <div className="bg-[#0b101c] p-5 rounded-[20px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                              <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} ${colors.bar} opacity-60`} />
                              <h4 className={`text-base font-black mb-1 leading-snug ${colors.text}`}>{label}</h4>
                              {path.length > 0 && (
                                <div className="text-[11px] text-sky-400/40 font-medium mb-3">
                                  in {canvasTitles.get(path[path.length - 1]) || 'Sub-canvas'}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mb-4">
                                <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-white/50">
                                  <Clock size={11} className="text-violet-400" />
                                  {item.time} — {(() => {
                                    const endMin = timeToMinutes(item.time!) + (item.duration ?? 0);
                                    return `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
                                  })()}
                                </div>
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-[11px] font-bold text-violet-300/70">
                                  {formatDuration(item.duration ?? 0)}
                                </div>
                                {item.recurring && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-[11px] font-bold text-emerald-400/70 uppercase tracking-wider">
                                      ↻ {item.recurring}
                                    </div>
                                    <div className="text-[10px] text-white/25 font-medium pl-0.5">
                                      started {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                  </div>
                                )}
                                {item.priority && (
                                  <div className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
                                    <Flag size={9} />{item.priority.replace('-', ' ')}
                                  </div>
                                )}
                              </div>
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {item.tags.map(t => (
                                    <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 flex items-center gap-1">
                                      <Tag size={7} />{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1 flex gap-2">
                                <button
                                  onClick={() => { setActivePopup(null); onNavigateToItem(item, path); }}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${colors.badge} border text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap ${colors.text} hover:brightness-125 transition-all`}
                                >
                                  Show on Canvas
                                </button>
                                {item.history && item.history.length > 0 && (
                                  <button
                                    onClick={() => { setActivePopup(null); setHistoryModal({ item, path, entries: item.history! }); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-white/40 hover:text-white/70 transition-all"
                                  >
                                    History
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hourly rows: hours 10–20, 56px each */}
          {Array.from({ length: 11 }, (_, i) => i + 10).map(hour => (
            <div key={hour} className="grid border-b border-white/[0.04]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
              {/* Gutter */}
              <div className="sticky left-0 z-10 border-r border-white/5 bg-[#0b0f1a] flex items-start justify-end pr-2.5 pt-1.5" style={{ height: '56px' }}>
                <span className="text-[11px] font-mono text-white/15 whitespace-nowrap">{pad(hour)}:00</span>
              </div>
              {weekDays.map((day, idx) => {
                const dateStr = getDateStr(day);
                const isToday = dateStr === getDateStr(new Date());
                const dayItems = (byDate[dateStr] || []).filter(({ item }) => {
                  const h = parseInt(item.time!.split(':')[0], 10);
                  return h === hour;
                });

                // Now marker: show only within hours 10–20 for today
                const nowHour = now.getHours();
                const nowMin = now.getMinutes();
                const showNow = isToday && nowHour === hour;
                const nowTopPct = (nowMin / 60) * 100;

                const popupSide = idx >= 4 ? 'right-full mr-2' : 'left-full ml-2';

                return (
                  <div
                    key={dateStr}
                    className={`border-r border-white/5 last:border-r-0 relative ${isToday ? 'bg-violet-500/[0.015]' : ''}`}
                    style={{ height: '56px' }}
                  >
                    {/* Now marker */}
                    {showNow && (
                      <div
                        className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                        style={{ top: `${nowTopPct}%` }}
                      >
                        <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)] -ml-1 shrink-0" />
                        <div className="flex-1 h-px bg-violet-400/50" />
                      </div>
                    )}

                    <div className="flex flex-col gap-1 p-1 h-full overflow-visible">
                      {dayItems.map(({ item, path }) => {
                        const dur = item.duration ?? 30;
                        const colors = priorityColor(item.priority);
                        const popupKey = `plan-${item.id}`;
                        const isPinned = activePopup === popupKey;
                        const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                        return (
                          <div key={item.id} className="relative group shrink-0">
                            <button
                              onClick={() => setActivePopup(isPinned ? null : popupKey)}
                              className={`w-full rounded border ${colors.badge} overflow-hidden flex flex-col px-2 py-0.5 text-left transition-all hover:brightness-125 active:scale-95 relative ${isPinned ? 'ring-1 ring-violet-400/50' : ''}`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${colors.bar}`} />
                              <span className={`text-[11px] font-bold leading-tight truncate pl-1 flex items-center gap-1 ${colors.text}`}>
                                {item.recurring && <span className="text-emerald-400/80 shrink-0 text-[10px]">↻</span>}
                                {label}
                              </span>
                              <span className="text-[10px] text-white/30 font-mono pl-1 leading-tight tabular-nums">
                                {item.time} · {formatDuration(dur)}
                              </span>
                            </button>
                            {/* Popup */}
                            <div
                              onClick={e => e.stopPropagation()}
                              className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}
                            >
                              <div className="bg-[#0b101c] p-5 rounded-[20px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                                <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} ${colors.bar} opacity-60`} />
                                <h4 className={`text-base font-black mb-1 leading-snug ${colors.text}`}>{label}</h4>
                                {path.length > 0 && (
                                  <div className="text-[11px] text-sky-400/40 font-medium mb-3">
                                    in {canvasTitles.get(path[path.length - 1]) || 'Sub-canvas'}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                  <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-white/50">
                                    <Clock size={11} className="text-violet-400" />
                                    {item.time} — {(() => {
                                      const endMin = timeToMinutes(item.time!) + (item.duration ?? 0);
                                      return `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-[11px] font-bold text-violet-300/70">
                                    {formatDuration(item.duration ?? 0)}
                                  </div>
                                  {item.recurring && (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-[11px] font-bold text-emerald-400/70 uppercase tracking-wider">
                                        ↻ {item.recurring}
                                      </div>
                                      <div className="text-[10px] text-white/25 font-medium pl-0.5">
                                        started {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </div>
                                    </div>
                                  )}
                                  {item.priority && (
                                    <div className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
                                      <Flag size={9} />{item.priority.replace('-', ' ')}
                                    </div>
                                  )}
                                </div>
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {item.tags.map(t => (
                                      <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 flex items-center gap-1">
                                        <Tag size={7} />{t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-1 flex gap-2">
                                  <button
                                    onClick={() => { setActivePopup(null); onNavigateToItem(item, path); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${colors.badge} border text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap ${colors.text} hover:brightness-125 transition-all`}
                                  >
                                    Show on Canvas
                                  </button>
                                  {item.history && item.history.length > 0 && (
                                    <button
                                      onClick={() => { setActivePopup(null); setHistoryModal({ item, path, entries: item.history! }); }}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-white/40 hover:text-white/70 transition-all"
                                    >
                                      History
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Post-block row: 21:00–23:59, height 72px */}
          <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Gutter */}
            <div className="sticky left-0 z-10 border-r border-white/5 bg-[#0b0f1a] flex flex-col justify-between py-1 pr-2.5" style={{ height: '72px' }}>
              <span className="text-[10px] font-mono text-white/10 whitespace-nowrap text-right">21:00</span>
              <span className="text-[10px] font-mono text-white/10 whitespace-nowrap text-right">23:59</span>
            </div>
            {weekDays.map((day, idx) => {
              const dateStr = getDateStr(day);
              const isToday = dateStr === getDateStr(new Date());
              const dayItems = (byDate[dateStr] || []).filter(({ item }) => {
                const h = parseInt(item.time!.split(':')[0], 10);
                return h > 20;
              });
              const popupSide = idx >= 4 ? 'right-full mr-2' : 'left-full ml-2';
              return (
                <div
                  key={dateStr}
                  className={`border-r border-white/5 last:border-r-0 ${isToday ? 'bg-violet-500/[0.015]' : ''}`}
                  style={{ height: '72px' }}
                >
                  <div className="flex flex-col gap-1 p-1 h-full overflow-visible">
                    {dayItems.map(({ item, path }) => {
                      const dur = item.duration ?? 30;
                      const colors = priorityColor(item.priority);
                      const popupKey = `plan-${item.id}`;
                      const isPinned = activePopup === popupKey;
                      const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                      return (
                        <div key={item.id} className="relative group shrink-0">
                          <button
                            onClick={() => setActivePopup(isPinned ? null : popupKey)}
                            className={`w-full rounded border ${colors.badge} overflow-hidden flex flex-col px-2 py-0.5 text-left transition-all hover:brightness-125 active:scale-95 relative ${isPinned ? 'ring-1 ring-violet-400/50' : ''}`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${colors.bar}`} />
                            <span className={`text-[11px] font-bold leading-tight truncate pl-1 flex items-center gap-1 ${colors.text}`}>
                              {item.recurring && <span className="text-emerald-400/80 shrink-0 text-[10px]">↻</span>}
                              {label}
                            </span>
                            <span className="text-[10px] text-white/30 font-mono pl-1 leading-tight tabular-nums">
                              {item.time} · {formatDuration(dur)}
                            </span>
                          </button>
                          {/* Popup */}
                          <div
                            onClick={e => e.stopPropagation()}
                            className={`absolute top-0 transition-all duration-200 z-[1000] w-72 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${popupSide}`}
                          >
                            <div className="bg-[#0b101c] p-5 rounded-[20px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                              <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} ${colors.bar} opacity-60`} />
                              <h4 className={`text-base font-black mb-1 leading-snug ${colors.text}`}>{label}</h4>
                              {path.length > 0 && (
                                <div className="text-[11px] text-sky-400/40 font-medium mb-3">
                                  in {canvasTitles.get(path[path.length - 1]) || 'Sub-canvas'}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mb-4">
                                <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-white/50">
                                  <Clock size={11} className="text-violet-400" />
                                  {item.time} — {(() => {
                                    const endMin = timeToMinutes(item.time!) + (item.duration ?? 0);
                                    return `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
                                  })()}
                                </div>
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-[11px] font-bold text-violet-300/70">
                                  {formatDuration(item.duration ?? 0)}
                                </div>
                                {item.recurring && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-[11px] font-bold text-emerald-400/70 uppercase tracking-wider">
                                      ↻ {item.recurring}
                                    </div>
                                    <div className="text-[10px] text-white/25 font-medium pl-0.5">
                                      started {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                  </div>
                                )}
                                {item.priority && (
                                  <div className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
                                    <Flag size={9} />{item.priority.replace('-', ' ')}
                                  </div>
                                )}
                              </div>
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {item.tags.map(t => (
                                    <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-white/40 flex items-center gap-1">
                                      <Tag size={7} />{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1 flex gap-2">
                                <button
                                  onClick={() => { setActivePopup(null); onNavigateToItem(item, path); }}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${colors.badge} border text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap ${colors.text} hover:brightness-125 transition-all`}
                                >
                                  Show on Canvas
                                </button>
                                {item.history && item.history.length > 0 && (
                                  <button
                                    onClick={() => { setActivePopup(null); setHistoryModal({ item, path, entries: item.history! }); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-white/40 hover:text-white/70 transition-all"
                                  >
                                    History
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {planItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none mt-24">
          <ClipboardList size={48} className="text-white/5" />
          <p className="text-white/15 text-lg font-semibold">No planned blocks yet</p>
          <p className="text-white/10 text-sm">Add a date, time, and duration to a block to see it here</p>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-8"
          onClick={() => setHistoryModal(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-80 max-h-[80vh] flex flex-col bg-[#0b101c] border border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className={`absolute top-0 left-0 w-1 h-full ${priorityColor(historyModal.item.priority).bar} opacity-60`} />
            <div className="p-5 border-b border-white/5 flex items-start justify-between gap-3">
              <h4 className={`text-base font-black flex items-center gap-2 leading-tight min-w-0 ${priorityColor(historyModal.item.priority).text}`}>
                <Clock size={13} className="shrink-0" />
                <span className="min-w-0 truncate">
                  {(() => { const t = historyModal.item.content?.split('\n')[0] || 'Untitled'; return t.length > 28 ? t.slice(0, 28) + '...' : t; })()}
                  <span className="text-white/30 font-bold text-sm ml-1.5">— {historyModal.entries.length} {historyModal.entries.length === 1 ? 'entry' : 'entries'}</span>
                </span>
              </h4>
              <button onClick={() => setHistoryModal(null)} className="p-1 hover:bg-white/5 rounded-lg transition-colors text-white/20 hover:text-white shrink-0">
                <X size={13} />
              </button>
            </div>
            {historyModal.path.length > 0 && (
              <div className="px-5 pt-3 text-[11px] text-sky-400/40 font-medium">
                in {canvasTitles.get(historyModal.path[historyModal.path.length - 1]) || 'Sub-canvas'}
              </div>
            )}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
              {(() => {
                const sorted = [...historyModal.entries].sort((a, b) => b.timestamp - a.timestamp);
                // Group by "YYYY-MM" → label
                const groups = new Map<string, { label: string; entries: CanvasHistoryEntry[] }>();
                for (const entry of sorted) {
                  const d = new Date(entry.timestamp);
                  const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
                  if (!groups.has(key)) {
                    groups.set(key, {
                      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                      entries: [],
                    });
                  }
                  groups.get(key)!.entries.push(entry);
                }
                return Array.from(groups.entries()).map(([key, { label, entries: groupEntries }]) => {
                  const isCollapsed = collapsedMonths.has(key);
                  return (
                    <div key={key}>
                      <button
                        onClick={() => setCollapsedMonths(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        })}
                        className="w-full flex items-center justify-between gap-2 py-1 mb-2 border-b border-white/5 group"
                      >
                        <span className="text-[11px] font-black uppercase tracking-widest text-violet-400/70 group-hover:text-violet-300/90 transition-colors">
                          {label}
                        </span>
                        <span className="flex items-center gap-2 text-[10px] text-white/20 group-hover:text-white/40 transition-colors">
                          <span className="font-mono">{groupEntries.length}</span>
                          <span>{isCollapsed ? '▸' : '▾'}</span>
                        </span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-2.5 pl-1">
                          {groupEntries.map(entry => (
                            <div key={entry.id} className="flex gap-3">
                              <span className="text-[11px] font-mono text-violet-400/70 shrink-0 font-black tabular-nums pt-px">
                                {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-sm text-white/60 leading-relaxed italic">{entry.action}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div className="p-4 border-t border-white/5 flex gap-2">
              <button
                onClick={() => { setHistoryModal(null); onNavigateToItem(historyModal.item, historyModal.path); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${priorityColor(historyModal.item.priority).badge} border text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap ${priorityColor(historyModal.item.priority).text} hover:brightness-125 transition-all`}
              >
                Show on Canvas
              </button>
              <button
                onClick={() => setHistoryModal(null)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap text-white/30 hover:text-white/60 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
