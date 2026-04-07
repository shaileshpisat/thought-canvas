'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar, Clock, Tag, Flag } from 'lucide-react';
import { CanvasItem } from '@/types/canvas';

interface Props {
  items: CanvasItem[];
  onClose: () => void;
  onNavigateToItem: (item: CanvasItem, path: string[]) => void;
}

interface WeekItemData {
  item: CanvasItem;
  path: string[];
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDur(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

const PRIORITY_CFG: Record<string, { bar: string; text: string; badge: string }> = {
  'very-high': { bar: 'bg-rose-500',   text: 'text-rose-400',   badge: 'bg-rose-500/15 border-rose-500/25' },
  'high':      { bar: 'bg-orange-500', text: 'text-orange-400', badge: 'bg-orange-500/15 border-orange-500/25' },
  'medium':    { bar: 'bg-amber-500',  text: 'text-amber-400',  badge: 'bg-amber-500/15 border-amber-500/25' },
  'low':       { bar: 'bg-sky-500',    text: 'text-sky-400',    badge: 'bg-sky-500/15 border-sky-500/25' },
  'very-low':  { bar: 'bg-slate-500',  text: 'text-slate-400',  badge: 'bg-slate-500/15 border-slate-500/25' },
};
const DEFAULT_CFG = { bar: 'bg-violet-500', text: 'text-violet-300', badge: 'bg-violet-500/15 border-violet-500/25' };
const priorityColor = (p?: string) => (p && PRIORITY_CFG[p]) ? PRIORITY_CFG[p] : DEFAULT_CFG;

const pad = (n: number) => String(n).padStart(2, '0');
const getDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const WeekBoard: React.FC<Props> = ({ items, onClose, onNavigateToItem }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activePopup, setActivePopup] = useState<string | null>(null);

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

  // Collect all items with showOnWeekBoard=true and a date
  const weekItems = useMemo(() => {
    const result: WeekItemData[] = [];
    const traverse = (list: CanvasItem[], path: string[]) => {
      for (const item of list) {
        if (item.date && item.showOnWeekBoard) {
          result.push({ item, path });
        }
        if (item.children) traverse(item.children, [...path, item.id]);
      }
    };
    traverse(items, []);
    return result;
  }, [items]);

  // Group by date, sorted by time then label
  const byDate = useMemo(() => {
    const map: Record<string, WeekItemData[]> = {};
    for (const p of weekItems) {
      const d = p.item.date!;
      if (!map[d]) map[d] = [];
      map[d].push(p);
    }
    for (const d of Object.keys(map)) {
      map[d].sort((a, b) => {
        const ta = a.item.time ?? '';
        const tb = b.item.time ?? '';
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [weekItems]);

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };
  const goToday = () => setCurrentDate(new Date());

  const todayStr = getDateStr(new Date());
  const weekLabel = (() => {
    const s = weekDays[0];
    const e = weekDays[6];
    const same = s.getMonth() === e.getMonth();
    return same
      ? `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.getDate()}, ${e.getFullYear()}`
      : `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`;
  })();

  return (
    <div className="fixed inset-0 z-[500] bg-canvas-bg flex flex-col animate-in fade-in duration-300">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 glass shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/40 hover:text-white flex items-center gap-2 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-base font-semibold uppercase tracking-wider">Back to Board</span>
          </button>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-1">
            <Calendar size={16} className="text-sky-400" />
            <span className="text-base font-black uppercase tracking-widest text-white/60">Week Board</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToday} className="px-3 py-1 rounded-lg text-xs font-semibold text-white/40 hover:text-white hover:bg-white/5 transition-colors border border-white/10">
            Today
          </button>
          <span className="text-sm font-semibold text-white/50 min-w-[200px] text-center">{weekLabel}</span>
          <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
        {/* Day headers */}
        <div className="grid shrink-0 border-b border-white/5 bg-[#0b0f1a]/95 backdrop-blur-sm" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDays.map((day) => {
            const dateStr = getDateStr(day);
            const isToday = dateStr === todayStr;
            const count = (byDate[dateStr] || []).length;
            return (
              <div key={dateStr} className={`py-3 px-3 border-r border-white/5 last:border-r-0 flex flex-col items-center gap-1 ${isToday ? 'bg-sky-500/[0.05]' : ''}`}>
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-sky-400' : 'text-white/20'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={`text-xl font-black ${isToday ? 'text-sky-400' : 'text-white/40'}`}>
                  {day.getDate()}
                </span>
                {count > 0 && (
                  <span className="text-[9px] font-bold text-white/20">{count} block{count !== 1 ? 's' : ''}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scrollable columns */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid h-full" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekDays.map((day, idx) => {
              const dateStr = getDateStr(day);
              const isToday = dateStr === todayStr;
              const dayItems = byDate[dateStr] || [];
              const popupSide = idx >= 4 ? 'right-full mr-2' : 'left-full ml-2';

              return (
                <div
                  key={dateStr}
                  className={`border-r border-white/5 last:border-r-0 min-w-0 ${isToday ? 'bg-sky-500/[0.015]' : ''}`}
                >
                  <div className="flex flex-col gap-1.5 p-2">
                    {dayItems.map(({ item, path }) => {
                      const colors = priorityColor(item.priority);
                      const popupKey = `week-${item.id}`;
                      const isPinned = activePopup === popupKey;
                      const label = item.content.replace(/\s*#\S+/g, '').trim().split('\n')[0] || 'Untitled';
                      return (
                        <div key={item.id} className="relative group">
                          <button
                            onClick={() => setActivePopup(isPinned ? null : popupKey)}
                            className={`w-full rounded-lg border ${colors.badge} overflow-hidden flex flex-col px-2.5 py-1.5 text-left transition-all hover:brightness-125 active:scale-95 relative ${isPinned ? 'ring-1 ring-sky-400/50' : ''}`}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${colors.bar}`} />
                            <span className={`text-[11px] font-bold leading-tight truncate pl-1 ${colors.text}`}>
                              {item.recurring && <span className="text-emerald-400/80 mr-1 text-[10px]">↻</span>}
                              {label}
                            </span>
                            {item.time && (
                              <span className="text-[10px] text-white/30 font-mono pl-1 leading-tight mt-0.5">
                                {formatTime(item.time)}{item.duration ? ` · ${formatDur(item.duration)}` : ''}
                              </span>
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-1 pl-1">
                                {item.tags.slice(0, 2).map(t => (
                                  <span key={t} className="px-1 py-px bg-white/5 rounded text-[9px] text-white/30">{t}</span>
                                ))}
                                {item.tags.length > 2 && <span className="text-[9px] text-white/20">+{item.tags.length - 2}</span>}
                              </div>
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
                                <div className="text-[11px] text-sky-400/40 font-medium mb-3">in sub-canvas</div>
                              )}
                              <div className="flex flex-wrap items-center gap-2 mb-4">
                                <div className="flex items-center gap-1 text-[11px] font-mono text-white/50">
                                  <Calendar size={10} className="text-sky-400" />
                                  {item.date}
                                </div>
                                {item.time && (
                                  <div className="flex items-center gap-1 text-[11px] font-mono text-white/50">
                                    <Clock size={10} className="text-violet-400" />
                                    {formatTime(item.time)}{item.duration ? ` · ${formatDur(item.duration)}` : ''}
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
                              <button
                                onClick={() => { setActivePopup(null); onNavigateToItem(item, path); }}
                                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg ${colors.badge} border text-[11px] font-semibold ${colors.text} hover:brightness-125 transition-all`}
                              >
                                Show on Canvas
                              </button>
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
      {weekItems.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none mt-24">
          <Calendar size={48} className="text-white/5" />
          <p className="text-white/15 text-lg font-semibold">No blocks on Week Board yet</p>
          <p className="text-white/10 text-sm">Check "Show on Week Board" in a block's schedule settings</p>
        </div>
      )}
    </div>
  );
};
