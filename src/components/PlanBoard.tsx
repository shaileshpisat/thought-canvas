'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, ClipboardList, Clock, Tag, Flag } from 'lucide-react';
import { CanvasItem } from '@/types/canvas';

interface Props {
  items: CanvasItem[];
  onClose: () => void;
  onNavigateToItem: (item: CanvasItem, path: string[]) => void;
}

interface PlanItemData {
  item: CanvasItem;
  path: string[];
}

export const PlanBoard: React.FC<Props> = ({ items, onClose, onNavigateToItem }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [activePopup, setActivePopup] = useState<string | null>(null);

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

  // Items by date
  const byDate = useMemo(() => {
    const map: Record<string, PlanItemData[]> = {};
    for (const p of planItems) {
      if (!map[p.item.date!]) map[p.item.date!] = [];
      map[p.item.date!].push(p);
    }
    return map;
  }, [planItems]);

  // Hours to show: 0–23 but we show all 24 hours
  const HOUR_HEIGHT = 60; // px per hour
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

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
          <div className="relative grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Time gutter */}
            <div className="sticky left-0 z-10 border-r border-white/5 bg-[#0b0f1a]">
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="border-b border-white/[0.04] flex items-start justify-end pr-2.5 pt-1.5"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="text-[11px] font-mono text-white/15 whitespace-nowrap">{pad(hour)}:00</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, idx) => {
              const dateStr = getDateStr(day);
              const isToday = dateStr === getDateStr(new Date());
              const dayItems = byDate[dateStr] || [];
              const totalHeight = HOURS.length * HOUR_HEIGHT;

              // Current time marker
              const nowMinutes = now.getHours() * 60 + now.getMinutes();
              const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

              // Detect overlapping blocks to offset them
              // Sort by start time, assign column offsets
              const sorted = [...dayItems].sort((a, b) => timeToMinutes(a.item.time!) - timeToMinutes(b.item.time!));
              // Simple overlap detection: assign track 0 or 1
              const tracks: PlanItemData[][] = [];
              const itemTrack: Map<string, number> = new Map();
              for (const pd of sorted) {
                const startMin = timeToMinutes(pd.item.time!);
                const endMin = startMin + (pd.item.duration ?? 30);
                let placed = false;
                for (let t = 0; t < tracks.length; t++) {
                  const last = tracks[t][tracks[t].length - 1];
                  const lastEnd = timeToMinutes(last.item.time!) + (last.item.duration ?? 30);
                  if (startMin >= lastEnd) {
                    tracks[t].push(pd);
                    itemTrack.set(pd.item.id, t);
                    placed = true;
                    break;
                  }
                }
                if (!placed) {
                  tracks.push([pd]);
                  itemTrack.set(pd.item.id, tracks.length - 1);
                }
              }
              const numTracks = Math.max(1, tracks.length);

              return (
                <div
                  key={dateStr}
                  className={`border-r border-white/5 last:border-r-0 relative ${isToday ? 'bg-violet-500/[0.015]' : ''}`}
                  style={{ height: `${totalHeight}px` }}
                >
                  {/* Hour dividers */}
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-b border-white/[0.04]"
                      style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {/* Half-hour ticks */}
                  {HOURS.map(hour => (
                    <div
                      key={`h-${hour}`}
                      className="absolute left-0 right-0 border-b border-white/[0.015]"
                      style={{ top: `${hour * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                    />
                  ))}

                  {/* Now marker */}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                      style={{ top: `${nowTop}px` }}
                    >
                      <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)] -ml-1 shrink-0" />
                      <div className="flex-1 h-px bg-violet-400/50" />
                    </div>
                  )}

                  {/* Plan blocks */}
                  {dayItems.map(({ item, path }) => {
                    const startMin = timeToMinutes(item.time!);
                    const dur = item.duration ?? 30;
                    const top = (startMin / 60) * HOUR_HEIGHT;
                    const height = Math.max((dur / 60) * HOUR_HEIGHT, 22);
                    const track = itemTrack.get(item.id) ?? 0;
                    const trackWidth = 100 / numTracks;
                    const left = track * trackWidth;

                    const colors = priorityColor(item.priority);
                    const popupKey = `plan-${item.id}`;
                    const isPinned = activePopup === popupKey;
                    const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                    const popupSide = idx >= 4 ? 'right-full mr-2' : 'left-full ml-2';

                    return (
                      <div
                        key={item.id}
                        className="absolute group"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${left}%`,
                          width: `${trackWidth}%`,
                          paddingLeft: '3px',
                          paddingRight: '3px',
                          zIndex: isPinned ? 50 : 20,
                        }}
                      >
                        <button
                          onClick={() => setActivePopup(isPinned ? null : popupKey)}
                          className={`w-full h-full rounded-lg border ${colors.badge} overflow-hidden flex flex-col px-2 py-1 text-left transition-all hover:brightness-125 active:scale-95 ${isPinned ? 'ring-1 ring-violet-400/50' : ''}`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colors.bar}`} />
                          <span className={`text-[11px] font-bold leading-tight truncate pl-1 ${colors.text}`}>
                            {label}
                          </span>
                          {height > 30 && (
                            <span className="text-[10px] text-white/30 font-mono pl-1 leading-tight tabular-nums">
                              {item.time} · {formatDuration(dur)}
                            </span>
                          )}
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
                            <button
                              onClick={() => { setActivePopup(null); onNavigateToItem(item, path); }}
                              className={`mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${colors.badge} border text-[11px] font-semibold normal-case tracking-normal whitespace-nowrap ${colors.text} hover:brightness-125 transition-all`}
                            >
                              Show on Canvas
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
    </div>
  );
};
