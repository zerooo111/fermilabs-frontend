/**
 * Display helpers for vault numbers (plain `number`s from the adapters; exact
 * amounts for transactions live in flp-vault's bigint `format.ts`). A null
 * value is unknown and renders as an em dash, never as zero.
 */

const UNKNOWN = '—';

export function usd(n: number | null, digits = 2): string {
  if (n === null) return UNKNOWN;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** $18.42M, $846.2K, $912.40. */
export function usdCompact(n: number | null): string {
  if (n === null) return UNKNOWN;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n < 0 ? '-' : ''}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${n < 0 ? '-' : ''}$${(abs / 1e3).toFixed(1)}K`;
  return usd(n);
}

/** Signed USD, "+$1,204.10" or "-$88.00". */
export function usdSigned(n: number | null): string {
  if (n === null) return UNKNOWN;
  return `${n >= 0 ? '+' : '-'}${usd(Math.abs(n))}`;
}

/** Fraction to percent, 0.1234 becomes "12.34%". */
export function pct(n: number, digits = 2): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** Signed percent, "+12.34%" or "-3.10%". */
export function pctSigned(n: number, digits = 2): string {
  return `${n >= 0 ? '+' : ''}${pct(n, digits)}`;
}

export function num(n: number, digits = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Picks sensible decimals for a price, so BTC and BONK both read well. */
export function price(n: number): string {
  if (n >= 1000) return num(n, 1);
  if (n >= 1) return num(n, 3);
  return num(n, 5);
}

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Text color class for a signed number. */
export function tone(n: number | null): string {
  if (n === null) return 'text-fg-secondary';
  if (n > 0) return 'text-positive-fg';
  if (n < 0) return 'text-negative-fg';
  return 'text-fg-secondary';
}

/** Basis points as a percent, 250 becomes "2.5%". */
export function bps(n: number): string {
  return `${Number((n / 100).toFixed(2))}%`;
}

/** "12.3%" for an APR, or a dash while there's under a day of history. */
export function apr(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : pct(n, 2);
}

export function explorerAddressUrl(address: string, network: 'devnet' | 'mainnet'): string {
  return `https://explorer.solana.com/address/${address}${network === 'devnet' ? '?cluster=devnet' : ''}`;
}

export function explorerTxUrl(signature: string, network: 'devnet' | 'mainnet'): string {
  return `https://explorer.solana.com/tx/${signature}${network === 'devnet' ? '?cluster=devnet' : ''}`;
}

/** "4m 05s", "3h 12m", "2d 4h": a countdown readable at any epoch length. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  if (s < 86_400)
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
}

/** "just now", "4m ago", "3h ago", "2d ago". */
export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

/** Epoch length in words: "60s", "8h", "1d". */
export function duration(seconds: number): string {
  if (seconds < 120) return `${seconds}s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

/** Percent of the deposit cap filled, "<1%" for a sliver. */
export function capLabel(tvl: number | null, cap: number): string {
  if (tvl === null) return UNKNOWN;
  const used = cap > 0 ? Math.min(1, tvl / cap) : 0;
  return used > 0 && used < 0.01 ? '<1%' : `${Math.round(used * 100)}%`;
}
