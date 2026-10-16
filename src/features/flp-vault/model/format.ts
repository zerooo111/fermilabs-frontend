/**
 * Native-unit helpers. u64 balances stay bigint end to end; they're never
 * routed through JS `number`.
 */
import { FLP_IDL } from '../sdk';

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
  const base = 10n ** BigInt(decimals);
  const whole = (value / base).toLocaleString('en-US');
  const frac = (value % base).toString().padStart(decimals, '0').slice(0, maxFraction);
  const trimmed = frac.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** Exact decimal string for an input field (no grouping). */
export function toInputString(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const frac = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${value / base}.${frac}` : `${value / base}`;
}

export const MODE_LABEL = {
  'pre-deposit': 'Pre-deposit',
  live: 'Live',
  unwind: 'Unwinding',
  closed: 'Closed',
} as const;

const FLP_ERRORS = new Map(
  ((FLP_IDL.errors ?? []) as Array<{ code: number; name: string; msg?: string }>).map(e => [
    e.code,
    e,
  ])
);

/** Name the FLP program error inside a failed send/simulation, when there is one. */
export function describeFlpError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const hex = message.match(/custom program error: 0x([0-9a-f]+)/i);
  const json = message.match(/"Custom":\s*(\d+)/);
  const code = hex ? parseInt(hex[1], 16) : json ? Number(json[1]) : null;
  const known = code !== null ? FLP_ERRORS.get(code) : undefined;
  if (known) return known.msg ? `${known.name}: ${known.msg}` : known.name;
  if (/user rejected|rejected the request/i.test(message)) return 'Request rejected in wallet';
  return message.split('\n')[0];
}
