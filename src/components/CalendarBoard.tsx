'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar as CalendarIcon, Clock, Tag, Flag, Layers, ExternalLink } from 'lucide-react';
import { CanvasItem, CanvasHistoryEntry } from '@/types/canvas';

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
  tagsOnDay: Record<string, Map<string, Set<string>>>; // day -> tag -> set of unique item IDs
  canvasTitles: Map<string, string>; // id -> name for canvases
  canvasesOnDay: Record<string, Set<string>>; // day -> set of active canvas IDs
}

export const CalendarBoard: React.FC<Props> = ({ items, onClose, onNavigateToItem }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [pinnedPopup, setPinnedPopup] = useState<string | null>(null);

  const calendarData = useMemo(() => {
    const data: CalendarData = { blocksWithDate: {}, blocksWithHistory: {}, tagsOnDay: {}, canvasTitles: new Map(), canvasesOnDay: {} };

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
            <span className="text-sm font-semibold uppercase tracking-wider">Back to Board</span>

          </button>
          
          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <CalendarIcon size={20} className="text-sky-400" />
              Week Board
            </h1>

            <span className="text-white/30 text-sm font-medium">
              {formatDateLabel(weekDays[0])} — {formatDateLabel(weekDays[6])}
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
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
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

      {/* Grid */}
      <div className="flex-1 p-8">
        <div className="h-full min-h-[600px] border border-white/10 rounded-[40px] overflow-hidden glass flex shadow-2xl">
          {weekDays.map((day, idx) => {
            const dateStr = getDateStr(day);
            const isToday = dateStr === getDateStr(new Date());
            const itemsOnDay = calendarData.blocksWithDate[dateStr] || [];
            const historyBlocksOnDay = calendarData.blocksWithHistory[dateStr];

            return (
              <div
                key={dateStr}
                className={`flex-1 flex flex-col border-r border-white/5 last:border-r-0 transition-all relative ${
                  isToday ? 'bg-sky-500/[0.03]' : ''
                }`}
              >
                {/* Day Header */}
                <div className="p-6 border-b border-white/5 relative">
                  {isToday && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-sky-400" />
                  )}
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-sky-400' : 'text-white/20'}`}>
                    {day.toLocaleDateString('en-US', { weekday: 'long' })}
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-3xl font-display font-bold ${isToday ? 'text-sky-300' : 'text-white/80'}`}>
                      {day.getDate()}
                    </span>
                    <span className="text-xs text-white/20 font-medium">{day.toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                </div>

                {/* Day Content - No overflow to ensure tooltips pop out */}
                <div className="flex-1 p-6 flex flex-col gap-5">
                  {/* Green Dots */}
                  {itemsOnDay.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-2.5">
                      {itemsOnDay.map(({ item, path }) => {
                        const isPinned = pinnedPopup === `green-${item.id}`;
                        return (
                        <div key={item.id} className="relative group flex items-center gap-1">
                          <button
                            onClick={() => setPinnedPopup(isPinned ? null : `green-${item.id}`)}
                            className={`w-3.5 h-3.5 rounded-full transition-all hover:scale-125 active:scale-95 shrink-0 ${isPinned ? 'bg-green-300 shadow-[0_0_16px_rgba(34,197,94,0.6)] scale-110' : 'bg-green-500/80 hover:bg-green-400 shadow-[0_0_12px_rgba(34,197,94,0.3)]'}`}
                          />
                          {item.priority && (
                            <Flag
                              size={10}
                              className={`shrink-0 ${
                                item.priority === 'very-high' ? 'text-rose-400' :
                                item.priority === 'high' ? 'text-orange-400' :
                                item.priority === 'medium' ? 'text-amber-400' :
                                'text-sky-400'
                              }`}
                            />
                          )}

                          <div onClick={e => e.stopPropagation()} className={`absolute top-1/2 ml-5 -translate-y-1/2 transition-all duration-200 z-[1000] w-64 ${isPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${idx >= 4 ? 'right-full mr-5 ml-0' : 'left-full'}`}>
                            <div className="bg-[#0b101c] p-4 rounded-[20px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                              <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-green-500/40`} />

                              <p className="text-[11px] text-white/90 font-medium leading-relaxed mb-2.5 truncate">
                                {(() => {
                                  const firstLine = item.content?.split('\n')[0] || 'Untitled Block';
                                  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine;
                                })()}
                              </p>
                              {path.length > 0 && (
                                <div className="text-[9px] text-sky-400/40 font-medium mb-3 flex items-center gap-1">
                                  in {calendarData.canvasTitles.get(path[path.length - 1]) || 'Sub-canvas'}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                                {item.priority && (
                                  <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${
                                    item.priority === 'very-high' ? 'text-rose-400' :
                                    item.priority === 'high' ? 'text-orange-400' :
                                    item.priority === 'medium' ? 'text-amber-400' :
                                    'text-sky-400'
                                  }`}>
                                    <Flag size={10} />
                                    {item.priority.replace('-', ' ')}
                                  </div>
                                )}
                              </div>

                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                  {item.tags.map(t => (
                                    <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-bold text-white/40 flex items-center gap-1">
                                      <Tag size={8} />
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => { setPinnedPopup(null); onNavigateToItem(item, path); }}
                                className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-[9px] font-bold uppercase tracking-widest text-green-400/70 hover:text-green-300 transition-all"
                              >
                                <ExternalLink size={9} />
                                Show on Canvas
                              </button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}


                  {itemsOnDay.length > 0 && historyBlocksOnDay && historyBlocksOnDay.size > 0 && (
                    <div className="h-px bg-white/[0.03] mx-2" />
                  )}

                  {/* Yellow Dots */}
                  {historyBlocksOnDay && historyBlocksOnDay.size > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-2.5">
                      {Array.from(historyBlocksOnDay.values()).map(({ item, entries }) => {
                        const tagsInHistory = new Set<string>();
                        entries.forEach(e => {
                          if (e.type === 'tag') {
                            const match = e.action.match(/(?:Added|Removed) tag: (.+)/);
                            if (match) tagsInHistory.add(match[1]);
                          }
                        });

                        const isYellowPinned = pinnedPopup === `yellow-${item.item.id}`;
                        return (
                        <div key={item.item.id} className="relative group flex items-center gap-1">
                          <button
                            onClick={() => setPinnedPopup(isYellowPinned ? null : `yellow-${item.item.id}`)}
                            className={`w-3.5 h-3.5 rounded-full transition-all hover:scale-125 active:scale-95 shrink-0 ${isYellowPinned ? 'bg-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.6)] scale-110' : 'bg-amber-500/80 hover:bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'}`}
                          />
                          {item.item.priority && (
                            <Flag
                              size={10}
                              className={`shrink-0 ${
                                item.item.priority === 'very-high' ? 'text-rose-400' :
                                item.item.priority === 'high' ? 'text-orange-400' :
                                item.item.priority === 'medium' ? 'text-amber-400' :
                                'text-sky-400'
                              }`}
                            />
                          )}

                          <div onClick={e => e.stopPropagation()} className={`absolute top-1/2 ml-5 -translate-y-1/2 transition-all duration-200 z-[1000] w-72 ${isYellowPinned ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'} ${idx >= 4 ? 'right-full mr-5 ml-0' : 'left-full'}`}>

                            <div className="bg-[#0b101c] p-5 rounded-[24px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden relative text-left">
                              <div className={`absolute top-0 h-full w-1 ${idx >= 4 ? 'right-0' : 'left-0'} bg-amber-500/40`} />

                              <h4 className="text-xs font-black uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
                                <Clock size={11} />
                                {entries.length} {entries.length === 1 ? 'Activity' : 'Activities'} for "{(() => {
                                  const text = item.item.content?.split('\n')[0] || 'Untitled';
                                  return text.length > 25 ? text.slice(0, 25) + '...' : text;
                                })()}"
                              </h4>
                              {item.path.length > 0 && (
                                <div className="text-[9px] text-sky-400/40 font-medium mb-3.5 flex items-center gap-1">
                                  in {calendarData.canvasTitles.get(item.path[item.path.length - 1]) || 'Sub-canvas'}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-3 mb-5 opacity-80">
                                {item.item.date && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-wider">
                                    <CalendarIcon size={11} />
                                    {item.item.date}
                                  </div>
                                )}
                                {item.item.priority && (
                                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                    item.item.priority === 'very-high' ? 'text-rose-400' :
                                    item.item.priority === 'high' ? 'text-orange-400' :
                                    item.item.priority === 'medium' ? 'text-amber-400' :
                                    'text-sky-400'
                                  }`}>
                                    <Flag size={11} />
                                    {item.item.priority.replace('-', ' ')}
                                  </div>
                                )}
                                {item.item.tags && item.item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.item.tags.slice(0, 4).map(t => {
                                      const isChanged = tagsInHistory.has(t);
                                      return (
                                        <span key={t} className={`text-[9px] font-bold flex items-center gap-0.5 ${isChanged ? 'text-amber-400 bg-amber-400/10 px-1 rounded' : 'text-white/20'}`}>
                                          #{t}
                                        </span>
                                      );
                                    })}
                                    {item.item.tags.length > 4 && <span className="text-[9px] text-white/10">+{item.item.tags.length - 4}</span>}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                {entries.sort((a,b)=>b.timestamp-a.timestamp).slice(0, 8).map(entry => (
                                  <div key={entry.id} className="flex gap-3.5">
                                    <span className="text-[10px] font-mono text-amber-400 shrink-0 font-black">
                                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-[11px] text-white/70 leading-relaxed italic">
                                      {entry.action}
                                    </span>
                                  </div>
                                ))}
                                {entries.length > 8 && (
                                  <div className="text-[10px] text-white/20 italic pt-1.5 border-t border-white/5">
                                    + {entries.length - 8} more entries
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => { setPinnedPopup(null); onNavigateToItem(item.item, item.path); }}
                                className="mt-4 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-[9px] font-bold uppercase tracking-widest text-amber-400/70 hover:text-amber-300 transition-all"
                              >
                                <ExternalLink size={9} />
                                Show on Canvas
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                  {/* Summary Section (Canvases & Tags) */}
                  {((calendarData.canvasesOnDay[dateStr] && calendarData.canvasesOnDay[dateStr].size > 0) || (calendarData.tagsOnDay[dateStr] && calendarData.tagsOnDay[dateStr].size > 0)) && (
                    <div className="mt-auto pt-6 border-t border-white/5 space-y-6">
                      {/* Active Canvases */}
                      {calendarData.canvasesOnDay[dateStr] && calendarData.canvasesOnDay[dateStr].size > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10 italic">
                               Involved Canvases ({calendarData.canvasesOnDay[dateStr].size})
                             </span>
                             <div className="h-px flex-1 bg-white/5" />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(calendarData.canvasesOnDay[dateStr]).map(id => (
                              <span key={id} className="px-2 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-[9px] font-bold text-sky-200/50 flex items-center gap-1.5 hover:text-sky-200 hover:bg-sky-500/20 hover:border-sky-500/40 transition-all cursor-default group">
                                <Layers size={10} className="text-sky-500/30 group-hover:text-sky-500/70" />
                                {calendarData.canvasTitles.get(id) || 'Sub-canvas'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Tags */}
                      {calendarData.tagsOnDay[dateStr] && calendarData.tagsOnDay[dateStr].size > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10 italic">
                               Modified Tags ({calendarData.blocksWithHistory[dateStr]?.size || 0})
                             </span>
                             <div className="h-px flex-1 bg-white/5" />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(calendarData.tagsOnDay[dateStr].entries()).map(([tag, blockIds]) => (
                              <span 
                                key={tag} 
                                className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[9px] font-bold text-amber-200/50 flex items-center gap-1.5 hover:text-amber-200 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-default group"
                              >
                                <Tag size={10} className="text-amber-500/30 group-hover:text-amber-500/70" />
                                {tag}
                                <span className="text-[8px] font-mono opacity-30 group-hover:opacity-60">{blockIds.size}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {itemsOnDay.length === 0 && (!historyBlocksOnDay || historyBlocksOnDay.size === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-[0.03]">
                      <CalendarIcon size={32} strokeWidth={1} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">Quiet</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
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
