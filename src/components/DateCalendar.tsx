'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CanvasItem } from '@/types/canvas';
import { getDateStatus, flattenItems, recursOnDate } from '@/utils/dateUtils';

interface Props {
  items: CanvasItem[];
  onClose: () => void;
}

export const DateCalendar: React.FC<Props> = ({ items, onClose }) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const allItems = flattenItems(items);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;

  const pad = (n: number) => String(n).padStart(2, '0');
  const getDateStr = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

  const datesWithItems = new Map<string, number>(); // date -> count
  for (const item of allItems) {
    if (!item.date) continue;
    if (item.recurring) {
      // Show dot on each day of the viewed month where this item recurs
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dayStr = getDateStr(d);
        if (recursOnDate(item, dayStr)) {
          datesWithItems.set(dayStr, (datesWithItems.get(dayStr) ?? 0) + 1);
        }
      }
    } else {
      datesWithItems.set(item.date, (datesWithItems.get(item.date) ?? 0) + 1);
    }
  }

  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Stats
  const itemsWithDate = allItems.filter((i) => i.date);
  const todayCount = itemsWithDate.filter((i) => getDateStatus(i.date!) === 'today').length;
  const overdueCount = itemsWithDate.filter((i) => {
    const s = getDateStatus(i.date!);
    return s === 'past-old' || s === 'past-week';
  }).length;
  const upcomingCount = itemsWithDate.filter((i) => getDateStatus(i.date!) === 'future').length;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-end pt-20 pr-8" onClick={onClose}>
      <div
        className="glass rounded-2xl shadow-2xl p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Stats strip */}
        <div className="flex gap-2 mb-4">
          {todayCount > 0 && (
            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-400">{todayCount}</div>
              <div className="text-[9px] text-green-400/70 uppercase tracking-wider font-bold">Today</div>
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-400">{overdueCount}</div>
              <div className="text-[9px] text-red-400/70 uppercase tracking-wider font-bold">Overdue</div>
            </div>
          )}
          {upcomingCount > 0 && (
            <div className="flex-1 bg-sky-500/10 border border-sky-500/20 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-sky-400">{upcomingCount}</div>
              <div className="text-[9px] text-sky-400/70 uppercase tracking-wider font-bold">Upcoming</div>
            </div>
          )}
          {itemsWithDate.length === 0 && (
            <div className="flex-1 text-center text-white/30 text-xs py-2">No dated blocks yet</div>
          )}
        </div>

        {/* Month header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-white/80">{monthName}</span>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 mb-1">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
            <div key={d} className="text-center text-[9px] font-bold text-white/25 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="h-8" />;
            const dateStr = getDateStr(day);
            const count = datesWithItems.get(dateStr) ?? 0;
            const isToday = dateStr === todayStr;
            const status = count > 0 ? getDateStatus(dateStr) : null;

            return (
              <div key={day} className="flex flex-col items-center justify-center h-8">
                <span
                  className={`
                    text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium transition-colors
                    ${isToday ? 'bg-sky-500/30 text-sky-300 ring-1 ring-sky-500/40' : 'text-white/50 hover:text-white/80'}
                  `}
                >
                  {day}
                </span>
                {count > 0 && (
                  <div
                    className={`
                      w-1 h-1 rounded-full mt-0.5
                      ${status === 'today' ? 'bg-green-400' :
                        status === 'past-old' || status === 'past-week' ? 'bg-red-400' :
                        'bg-sky-400'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/35">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Today
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
            Overdue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
            Upcoming
          </span>
        </div>
      </div>
    </div>
  );
};
