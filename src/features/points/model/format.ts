import bs58 from 'bs58';
import type { EpochStatus, PointsCategory, PointsEpoch } from '../api/pointsClient';

export const CATEGORY_LABELS: Record<PointsCategory, string> = {
  flp_vault: 'FLP vault',
  resting_depth: 'Resting depth',
  volume: 'Volume',
  open_interest: 'Open interest',
  referral: 'Referrals',
  bonus: 'Bonus',
};

/** Display order: the five program categories, then reserve grants. */
export const CATEGORY_ORDER: PointsCategory[] = [
  'flp_vault',
  'resting_depth',
  'volume',
  'open_interest',
  'referral',
  'bonus',
];

export const STATUS_LABELS: Record<EpochStatus, string> = {
  upcoming: 'Upcoming',
  live: 'Estimate',
  computing: 'Computing',
  provisional: 'Provisional',
  final: 'Final',
};

/** A wallet's points dashboard: the checker page with `?wallet=`. */
export function walletPointsPath(wallet: string): string {
  return `/points?wallet=${encodeURIComponent(wallet)}`;
}

/** A Solana address: base58 that decodes to 32 bytes. */
export function isValidAddress(s: string): boolean {
  if (s.length < 32 || s.length > 44) return false;
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

export function shortAddress(s: string): string {
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

const POINTS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const POINTS_SIGNED = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const COUNT = new Intl.NumberFormat('en-US');

/** Points to 2 decimals with thousands separators. */
export const points = (n: number) => POINTS.format(n);
/** Points with an explicit sign, for activity rows. */
export const pointsSigned = (n: number) => POINTS_SIGNED.format(n);
export const count = (n: number) => COUNT.format(n);

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DATE_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `15 Oct – 1 Nov 2026`, in UTC like the epoch boundaries. */
export function epochRange(e: Pick<PointsEpoch, 'starts_at_ms' | 'ends_at_ms'>): string {
  return `${DATE.format(e.starts_at_ms)} – ${DATE_YEAR.format(e.ends_at_ms)}`;
}

export const dateUtc = (ms: number) => DATE_YEAR.format(ms);

export function epochLabel(e: Pick<PointsEpoch, 'epoch' | 'name'>): string {
  return e.name ?? (e.epoch === 0 ? 'Pre-deposit' : `Epoch ${e.epoch}`);
}

/** `3d 4h`, `5h 12m`, `8m`. */
export function countdown(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** `details` values as short display strings; nested objects are skipped. */
export function detailPairs(details: Record<string, unknown>): [string, string][] {
  return Object.entries(details)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .map(([k, v]) => [
      k.replace(/_/g, ' '),
      typeof v === 'number'
        ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v)
        : String(v),
    ]);
}
