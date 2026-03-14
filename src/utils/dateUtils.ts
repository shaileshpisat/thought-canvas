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
