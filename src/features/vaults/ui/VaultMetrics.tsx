/**
 * Phase-aware vault numbers. A vault in pre-deposit has no return yet (shares
 * mint 1:1 until graduation), so instead of an APR dash and a flat line it shows
 * what matters then: how full the deposit cap is.
 */
import { cn } from '@/lib/utils';

import type { Vault } from '../api/vaultsClient';
import { apr, capLabel, tone } from '../model/format';
import { Sparkline } from './Sparkline';

/** APR, or the reason there isn't one yet. */
export function AprValue({ vault: v, className }: { vault: Vault; className?: string }) {
  if (v.mode === 'pre-deposit') {
    return (
      <span
        className={cn('font-mono text-xs uppercase tracking-[0.12em] text-amber-200/80', className)}
        title="Pre-deposits wait in escrow and earn trading P&L from graduation."
      >
        Pre-deposit
      </span>
    );
  }
  if (v.apr === null) {
    return (
      <span
        className={cn('font-mono text-xs uppercase tracking-[0.12em] text-rock/60', className)}
        title="APR needs a day of history"
      >
        New
      </span>
    );
  }
  return <span className={cn('font-mono tabular-nums', tone(v.apr), className)}>{apr(v.apr)}</span>;
}

/** Deposit cap fill as a thin meter with its percentage. */
export function CapMeter({
  tvl,
  cap,
  width,
  bare = false,
  className,
}: {
  /** Null while the vault can't be valued: the meter shows no fill. */
  tvl: number | null;
  cap: number;
  width?: number;
  /** Just the bar, for when the percentage is shown elsewhere. */
  bare?: boolean;
  className?: string;
}) {
  const used = cap > 0 && tvl !== null ? Math.min(1, tvl / cap) : 0;
  const label = capLabel(tvl, cap);
  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      style={{ width }}
      title={`${label} of the deposit cap`}
    >
      {!bare && (
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60">
          <span>Cap</span>
          <span className="tabular-nums text-rock/80">{label}</span>
        </div>
      )}
      <div
        className="h-1 bg-rock/10"
        role="meter"
        aria-label="Deposit cap filled"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(used * 100)}
      >
        {/* A sliver stays visible however small the fill, so 0.4% doesn't read as empty. */}
        <div
          className="h-full bg-amber-200/80"
          style={{ width: used > 0 ? `max(2px, ${used * 100}%)` : 0 }}
        />
      </div>
    </div>
  );
}

/** The list's trend column: cap fill in pre-deposit, share-price trend after. */
export function TrendCell({
  vault: v,
  width,
  height,
  className,
}: {
  vault: Vault;
  width: number;
  height: number;
  className?: string;
}) {
  if (v.mode === 'pre-deposit') {
    return <CapMeter tvl={v.tvl} cap={v.tvl_cap} width={width} className={className} />;
  }
  const values = (v.sparkline ?? []).map(p => p[1]);
  const flat = values.length < 3 || Math.max(...values) - Math.min(...values) < 1e-9;
  if (flat) {
    return (
      <span
        className={cn(
          'block text-right font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60',
          className
        )}
        style={{ width }}
      >
        New
      </span>
    );
  }
  return <Sparkline className={className} width={width} height={height} values={values} />;
}
