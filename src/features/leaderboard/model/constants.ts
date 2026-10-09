import type { LeaderboardSort, LeaderboardWindow } from '../api/leaderboardClient';

export const PAGE_SIZE = 50;

/** `short` is used on narrow screens so all six options fit without scrolling. */
export const WINDOWS: ReadonlyArray<{
  value: LeaderboardWindow;
  label: string;
  short: string;
  title: string;
}> = [
  { value: '24h', label: '24H', short: '24H', title: 'Last 24 hours' },
  { value: '7d', label: '7D', short: '7D', title: 'Last 7 days' },
  { value: '30d', label: '30D', short: '30D', title: 'Last 30 days' },
  {
    value: 'week',
    label: 'This week',
    short: 'Week',
    title: 'This calendar week (from Monday 00:00 UTC)',
  },
  { value: 'month', label: 'This month', short: 'Month', title: 'This calendar month (UTC)' },
  { value: 'all', label: 'All time', short: 'All', title: 'All time' },
];

export const SORTS: ReadonlyArray<{ value: LeaderboardSort; label: string }> = [
  { value: 'volume', label: 'Volume' },
  { value: 'trades', label: 'Trades' },
];

export const DEFAULT_WINDOW: LeaderboardWindow = '7d';
export const DEFAULT_SORT: LeaderboardSort = 'volume';

/** Short tag for tile labels, e.g. "Volume · 7D". */
export const WINDOW_TAG: Record<LeaderboardWindow, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
  week: 'This week',
  month: 'This month',
  all: 'All time',
};

/** Phrase that completes "No trades …". */
export const WINDOW_PHRASE: Record<LeaderboardWindow, string> = {
  '24h': 'in the last 24 hours',
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  week: 'this week',
  month: 'this month',
  all: 'yet',
};
