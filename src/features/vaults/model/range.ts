import type { VaultPoint } from './types';

export const RANGES = ['7D', '30D', '90D', 'ALL'] as const;
export type Range = (typeof RANGES)[number];

const DAYS: Record<Range, number> = { '7D': 7, '30D': 30, '90D': 90, ALL: Infinity };

/** The last N days of history, plus the point just before so returns have a base. */
export function sliceHistory(history: VaultPoint[], range: Range): VaultPoint[] {
  const days = DAYS[range];
  if (!Number.isFinite(days) || history.length <= days + 1) return history;
  return history.slice(history.length - days - 1);
}
