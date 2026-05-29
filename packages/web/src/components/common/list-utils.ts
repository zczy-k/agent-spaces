export type GroupMode = 'none' | 'time' | 'status';

export const TIME_GROUP_ORDER = ['today', 'yesterday', 'thisWeek', 'earlier'] as const;

export const TIME_LABEL_KEYS: Record<string, string> = {
  today: 'timeToday',
  yesterday: 'timeYesterday',
  thisWeek: 'timeThisWeek',
  earlier: 'timeEarlier',
};

export function getTimeGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  if (date >= today) return 'today';
  if (date >= yesterday) return 'yesterday';
  if (date >= weekAgo) return 'thisWeek';
  return 'earlier';
}
