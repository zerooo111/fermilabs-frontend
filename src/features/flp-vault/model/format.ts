/**
 * Native-unit helpers. u64 balances stay bigint end to end; they're never
 * routed through JS `number`.
 */
import { FLP_IDL } from '../sdk';
import type { Fixed } from './api';

/** Parse a decimal string into native units, or null if it isn't a valid amount. */
export function parseUnits(input: string, decimals: number): bigint | null {
  const s = input.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) return null;
  return BigInt((whole || '0') + frac.padEnd(decimals, '0'));
}

/** Format native units with grouping, trimming trailing fractional zeros. */
export function formatUnits(value: bigint, decimals: number, maxFraction = decimals): string {
  if (value < 0n) return `-${formatUnits(-value, decimals, maxFraction)}`;
  const base = 10n ** BigInt(decimals);
  const whole = (value / base).toLocaleString('en-US');
  const frac = (value % base).toString().padStart(decimals, '0').slice(0, maxFraction);
  const trimmed = frac.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** Like `formatUnits`, with an explicit + on positive values. */
export function formatSigned(value: bigint, decimals: number, maxFraction = decimals): string {
  return value > 0n
    ? `+${formatUnits(value, decimals, maxFraction)}`
    : formatUnits(value, decimals, maxFraction);
}

/** A price with at least `minFraction` places (1.0000), up to `decimals`. */
export function formatPrice(value: bigint, decimals: number, minFraction = 4): string {
  const s = formatUnits(value, decimals);
  const [whole, frac = ''] = s.split('.');
  return `${whole}.${frac.padEnd(minFraction, '0')}`;
}

/** Exact decimal string for an input field (no grouping). */
export function toInputString(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const frac = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${value / base}.${frac}` : `${value / base}`;
}

/** Fixed-point API value to native units, rounded toward -infinity. */
export function fixedToNative(v: Fixed): bigint {
  return BigInt(v.raw) >> BigInt(v.fractionalBits);
}

/** Fixed-point value scaled by 10^decimals, for ratios like prices (rounded down). */
export function fixedScaled(v: Fixed, decimals: number): bigint {
  return (BigInt(v.raw) * 10n ** BigInt(decimals)) >> BigInt(v.fractionalBits);
}

// The program prices shares with virtual offsets of 1,000,000 (design.md 6.3).
const VIRTUAL = 1_000_000n;

/** Quote per share, scaled by 10^`decimals`: (nav + 1e6) / (supply + 1e6). */
export function sharePrice(nav: bigint, supply: bigint, decimals = 6): bigint {
  return ((nav + VIRTUAL) * 10n ** BigInt(decimals)) / (supply + VIRTUAL);
}

export const MODE_LABEL = {
  'pre-deposit': 'Pre-deposit',
  live: 'Live',
  unwind: 'Unwinding',
  closed: 'Closed',
} as const;

/** "4m 05s", "1h 02m", "3d 4h": a countdown that stays readable at any scale. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  if (s < 86_400)
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
}

export function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const FLP_ERRORS = new Map(
  ((FLP_IDL.errors ?? []) as Array<{ code: number; name: string; msg?: string }>).map(e => [
    e.code,
    e,
  ])
);

// Wording for the failures a user can act on (frontend-guide.md A.8).
const USER_MESSAGES: Record<number, string> = {
  3012: 'This wallet has no depositor record on the vault. Get approved first.',
  6003: 'Deposits are paused.',
  6004: 'Withdrawals are paused.',
  6005: 'The vault circuit breaker is tripped.',
  6006: 'Amount is below the minimum. A refund can be at most your pre-deposit.',
  6007: 'Deposit would exceed the vault cap.',
  6008: 'Claim or cancel your earlier request first.',
  6010: 'Past the cutoff for this epoch. Wait for it to close.',
  6011: 'The epoch has not closed yet.',
  6023: 'The vault does not have the liquidity for this withdrawal right now.',
  6033: 'This wallet is not approved for direct deposits.',
  6034: 'The share price moved. Try again for a new quote.',
  6042: 'Vault trades are still being processed. Try again in a few seconds.',
  6043: 'Wrong event queues for the vault positions. Refresh and try again.',
  6047: 'An older withdrawal batch is funded first. Use the queued withdrawal or wait.',
};

/** Name the FLP program error inside a failed send/simulation, when there is one. */
export function describeFlpError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const hex = message.match(/custom program error: 0x([0-9a-f]+)/i);
  const json = message.match(/"Custom":\s*(\d+)/);
  const anchor = message.match(/Error Number: (\d+)/);
  const code = hex
    ? parseInt(hex[1], 16)
    : json
      ? Number(json[1])
      : anchor
        ? Number(anchor[1])
        : null;
  if (code !== null && USER_MESSAGES[code]) return USER_MESSAGES[code];
  const known = code !== null ? FLP_ERRORS.get(code) : undefined;
  if (known) return known.msg ? `${known.name}: ${known.msg}` : known.name;
  if (/user rejected|rejected the request/i.test(message)) return 'Request rejected in wallet';
  return message.split('\n')[0];
}
