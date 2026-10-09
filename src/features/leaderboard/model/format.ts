/**
 * Display helpers for the leaderboard. Money arrives as USDC decimal strings;
 * parsing to a float here is display-only (never fed back into math).
 */
const toNumber = (v: string | number | undefined): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Full precision USD, e.g. `$12,345.67`. */
export function usd(v: string | number | undefined): string {
  return toNumber(v).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Compact USD for tight cells, e.g. `$1.24M`. Falls back to full under $10k. */
export function usdCompact(v: string | number | undefined): string {
  const n = toNumber(v);
  if (Math.abs(n) < 10_000) return usd(n);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  });
}

export function count(n: number | undefined): string {
  return (n ?? 0).toLocaleString('en-US');
}

/** Maker share of total volume, 0–1. */
export function makerShare(maker: string, taker: string): number {
  const m = toNumber(maker);
  const total = m + toNumber(taker);
  return total > 0 ? m / total : 0;
}

export function shortOwner(owner: string): string {
  return owner.length > 12 ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : owner;
}

export function relativeTime(ms: number | undefined): string | null {
  if (!ms) return null;
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Window start as "Since Mon 6 Oct, 00:00 UTC"; null for open-ended windows. */
export function windowSince(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
  return `Since ${day.replace(',', '')}, ${time} UTC`;
}
