/**
 * The vault page's right-hand panel for FLP until a history source exists:
 * the numbers there are (next settlement, share price, vault PnL, unsettled
 * profit) and how the vault works in its current phase.
 */
import type { ReactNode } from 'react';
import type { PublicKey } from '@solana/web3.js';

import { cn } from '@/lib/utils';
import { DitherRidge } from '@/shared/ui/dither-ridge';
import { Eyebrow } from '@/shared/ui/panel';

import {
  formatDuration,
  formatPeriod,
  formatPrice,
  formatUnits,
  PRICE_DECIMALS,
} from '../model/format';
import { useFlpVault } from '../model/useFlpVault';
import { useNow } from '../model/useNow';
import { upnlRisk, vaultView } from '../model/view';

export function FlpPerformance({ vault }: { vault: PublicKey }) {
  const { envelope } = useFlpVault(vault);
  const now = useNow();
  if (!envelope) return <section className="skeleton-bone min-h-[22rem] border border-outline" />;
  const v = vaultView(envelope);
  const qd = v.quoteDecimals;
  const live = v.mode === 'live';
  const left = v.epoch.scheduledEnd - now;
  const pnl = v.tvl === null ? null : v.tvl - v.netIn;
  const risk = upnlRisk(envelope);
  const every = formatPeriod(v.epoch.duration);

  return (
    <section className="flex min-h-[22rem] flex-col border border-outline">
      <div className="flex min-h-11 items-center justify-between border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <h2 className="text-sm text-rock">Performance</h2>
        <span className="text-xs text-rock/60">Charts coming soon</span>
      </div>

      <dl className="grid grid-cols-2 divide-outline border-b border-outline sm:grid-cols-4 sm:divide-x max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*]:border-outline">
        <Stat
          label={live ? 'Next settlement' : 'Launch'}
          value={
            live ? (left > 0 ? `in ${formatDuration(left)}` : 'Settling') : 'Date set by Fermi'
          }
          small={!live}
        />
        <Stat
          label="Share price"
          value={`$${formatPrice(v.price, PRICE_DECIMALS)}`}
          // NAV_mid, with the entry (NAV_high) and exit (NAV_low) prices of the same evidence.
          title={
            v.priceValued
              ? `At the vault's last on-chain valuation (slot ${v.priceSlot}${v.priceStale ? ', stale' : ''}): mid $${formatPrice(v.price, PRICE_DECIMALS)}, instant entry $${formatPrice(v.priceHigh, PRICE_DECIMALS)}, instant exit $${formatPrice(v.priceLow, PRICE_DECIMALS)}.`
              : `The vault hasn't been valued on chain yet. Indicative, from its current NAV: $${formatPrice(v.price, PRICE_DECIMALS)}.`
          }
        />
        <Stat
          label="Vault PnL"
          value={pnl === null ? '—' : usd(pnl, qd)}
          tone={pnl === null ? undefined : pnl > 0n ? 'up' : pnl < 0n ? 'down' : undefined}
        />
        <Stat
          label="Unsettled profit"
          value={risk?.bps != null ? `${(risk.bps / 100).toFixed(2)}%` : '—'}
          hint={
            risk?.amount != null
              ? `$${formatUnits(risk.amount, qd, 2)}`
              : (risk?.reason ?? undefined)
          }
          title={risk ? `${risk.definition}. It is ${risk.disclosure}.` : undefined}
          note={risk?.notice ? NOTICE[risk.notice] : undefined}
        />
      </dl>

      <div className="relative flex flex-1 flex-col gap-4 overflow-hidden px-4 pt-6 pb-20 sm:px-6">
        <DitherRidge
          seed={vault.toBase58()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 text-lichen opacity-40"
        />
        <Eyebrow className="relative">How FLP works</Eyebrow>
        <ol className="relative grid gap-4 sm:grid-cols-3">
          {(live
            ? [
                [
                  'Request',
                  'Deposit or withdraw any time. Your request waits for the next settlement.',
                ],
                ['Settle', `Every ${every}, requests are priced at the vault’s value.`],
                ['Claim', 'Claim your FLP or USDC. FLP earns from market making on Fermi.'],
              ]
            : [
                ['Deposit', 'USDC waits in escrow. Withdraw it any time before launch.'],
                ['Launch', 'At launch every pre-deposit becomes FLP shares at the same price.'],
                [
                  'Earn',
                  `FLP earns from market making. After launch, requests settle every ${every}.`,
                ],
              ]
          ).map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] text-amber-200">0{i + 1}</span>
              <span className="text-sm text-rock">{title}</span>
              <span className="text-xs leading-relaxed text-rock/65">{body}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Standing-uPnL notices request settlement; they are not a breaker or a recovery trigger.
const NOTICE = {
  'operator-notice': 'Settlement requested',
  'page-operator': 'Settlement overdue',
} as const;

/** Signed dollars from native units: "+$2.34", "-$0.80", "$0.00". */
function usd(n: bigint, decimals = 6): string {
  const cents = (n < 0n ? -n : n) / 10n ** BigInt(decimals - 2);
  const text = `${(cents / 100n).toLocaleString('en-US')}.${String(cents % 100n).padStart(2, '0')}`;
  return `${n > 0n ? '+' : n < 0n ? '-' : ''}$${text}`;
}

function Stat({
  label,
  value,
  hint,
  tone,
  title,
  small,
  note,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'up' | 'down';
  title?: string;
  small?: boolean;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3" title={title}>
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd
        className={cn(
          'font-mono tabular-nums text-rock',
          small ? 'text-sm text-rock/75' : 'text-base',
          tone === 'up' && 'text-success',
          tone === 'down' && 'text-danger'
        )}
      >
        {value}
        {hint && <span className="ml-1.5 text-[11px] text-rock/60">{hint}</span>}
      </dd>
      {note && <dd className="text-[11px] text-amber-200">{note}</dd>}
    </div>
  );
}
