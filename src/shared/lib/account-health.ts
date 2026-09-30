/**
 * Account health as a percentage: maintenance health over equity. 100% is an
 * account with no positions, 0% is the point where it can be liquidated.
 * Returns null when there is no equity to measure against.
 */
export function accountHealthPct(maintHealth: number, equity: number): number | null {
  if (!(equity > 0)) return null;
  return Math.max(0, Math.min(100, (maintHealth / equity) * 100));
}

export function healthTone(pct: number) {
  if (pct < 10) return { bar: 'bg-danger', text: 'text-danger' };
  if (pct < 30) return { bar: 'bg-amber-400', text: 'text-amber-400' };
  return { bar: 'bg-success', text: 'text-success' };
}
