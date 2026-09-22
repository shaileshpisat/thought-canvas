export type DateStatus = 'today' | 'future' | 'past-week' | 'past-old';

export function getRelativeLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (diffDays >= 2 && diffDays <= 6) return dayNames[date.getDay()];
  if (diffDays >= 7 && diffDays <= 13) return 'Next Week';
  if (diffDays <= -2 && diffDays >= -6) return dayNames[date.getDay()];
  if (diffDays <= -7 && diffDays >= -13) return 'Last Week';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDateStatus(dateStr: string): DateStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  const day = today.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(today.getDate() - daysToMonday);

  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);

  if (date.getTime() === today.getTime()) return 'today';
  if (date > today) return 'future';
  if (date >= weekStart) return 'past-week';
  return 'past-old';
}

export type DateBucket = 'today' | 'yesterday' | 'tomorrow' | 'last-week' | 'next-week' | 'past' | 'upcoming';

export function getDateBucket(dateStr: string): DateBucket {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === -1) return 'yesterday';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= -2 && diffDays >= -13) return 'last-week';
  if (diffDays >= 2 && diffDays <= 13) return 'next-week';
  if (diffDays < -13) return 'past';
  return 'upcoming';
}

export function flattenItems(items: import('@/types/canvas').CanvasItem[]): import('@/types/canvas').CanvasItem[] {
  const result: import('@/types/canvas').CanvasItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children) result.push(...flattenItems(item.children));
  }
  return result;
}

export function todayDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Returns true if the given item's recurrence rule produces an occurrence on
// `targetDateStr` (YYYY-MM-DD). Handles daily / weekly / monthly / yearly rules
// and legacy string-valued recurring fields. End conditions are honored.
export function recursOnDate(
  item: import('@/types/canvas').CanvasItem,
  targetDateStr: string,
): boolean {
  if (!item.recurring || !item.date) return false;

  let rule = item.recurring as import('@/types/canvas').RecurringRule | string;
  if (!rule || (typeof rule === 'object' && !rule.freq)) return false;
  if (typeof rule === 'string') {
    const legacyMap: Record<string, import('@/types/canvas').RecurringRule> = {
      daily:    { freq: 'daily',   interval: 1, endType: 'never' },
      weekdays: { freq: 'daily',   interval: 1, endType: 'never' },
      weekly:   { freq: 'weekly',  interval: 1, endType: 'never' },
      biweekly: { freq: 'weekly',  interval: 2, endType: 'never' },
      monthly:  { freq: 'monthly', interval: 1, endType: 'never' },
    };
    rule = legacyMap[rule as string] ?? { freq: 'weekly', interval: 1, endType: 'never' };
  }
  const r = rule as import('@/types/canvas').RecurringRule;

  const origin = new Date(item.date + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  origin.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  if (target < origin) return false;
  if (r.endType === 'date' && r.endDate) {
    const ed = new Date(r.endDate + 'T00:00:00');
    ed.setHours(0, 0, 0, 0);
    if (target > ed) return false;
  }

  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Enumerate occurrences from origin up to target; stop early on endCount.
  const dates: string[] = [];
  const push = (d: Date): boolean => {
    if (d < origin) return true;
    if (d > target) return false;
    if (r.endType === 'count' && r.endCount && dates.length >= r.endCount) return false;
    dates.push(fmt(d));
    return true;
  };

  const interval = r.interval || 1;
  if (r.freq === 'daily') {
    const cur = new Date(origin);
    while (cur <= target) {
      if (r.endType === 'count' && r.endCount && dates.length >= r.endCount) break;
      dates.push(fmt(cur));
      cur.setDate(cur.getDate() + interval);
    }
  } else if (r.freq === 'weekly') {
    const targetDays = (r.days && r.days.length > 0) ? r.days : [origin.getDay()];
    const originWeekStart = new Date(origin);
    originWeekStart.setDate(origin.getDate() - origin.getDay());
    const cur = new Date(originWeekStart);
    outer: while (cur <= target) {
      for (const dayIdx of [...targetDays].sort((a, b) => a - b)) {
        const d = new Date(cur);
        d.setDate(cur.getDate() + dayIdx);
        if (!push(d)) break outer;
      }
      if (r.endType === 'count' && r.endCount && dates.length >= r.endCount) break;
      cur.setDate(cur.getDate() + interval * 7);
    }
  } else if (r.freq === 'monthly') {
    const useNthWeekday = r.days && r.days.length > 0;
    if (!useNthWeekday) {
      const dayNum = origin.getDate();
      const cur = new Date(origin.getFullYear(), origin.getMonth(), dayNum);
      while (cur <= target) {
        if (!push(new Date(cur))) break;
        cur.setMonth(cur.getMonth() + interval);
        cur.setDate(dayNum);
      }
    } else {
      const targetWeekday = origin.getDay();
      const nth = Math.ceil(origin.getDate() / 7);
      let year = origin.getFullYear();
      let month = origin.getMonth();
      while (true) {
        const first = new Date(year, month, 1);
        const firstDow = first.getDay();
        const dayOfMonth = ((targetWeekday - firstDow + 7) % 7) + 1 + (nth - 1) * 7;
        const candidate = new Date(year, month, dayOfMonth);
        if (candidate.getMonth() === month) {
          if (!push(candidate)) break;
        }
        if (r.endType === 'count' && r.endCount && dates.length >= r.endCount) break;
        month += interval;
        if (month > 11) { year += Math.floor(month / 12); month = month % 12; }
        if (new Date(year, month, 1) > target) break;
      }
    }
  } else if (r.freq === 'yearly') {
    const cur = new Date(origin);
    while (cur <= target) {
      if (!push(new Date(cur))) break;
      cur.setFullYear(cur.getFullYear() + interval);
    }
  }

  return dates.includes(targetDateStr);
}
