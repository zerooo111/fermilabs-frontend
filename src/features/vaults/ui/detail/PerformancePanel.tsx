/**
 * Vault performance over the selected window: cumulative return, per-period
 * returns, share price, TVL and PnL. History is the gateway's snapshots
 * (every 15 min) plus points recovered from chain (epoch closes, NAV events).
 * A vault with daily rows (the FLP data API's, deposits and withdrawals taken
 * out) shows them as "Daily P&L" in place of the per-period returns.
 */
import { useMemo, useState } from 'react';

import { DitherRidge } from '@/shared/ui/dither-ridge';
import { Segmented } from '@/shared/ui/segmented';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { VaultDay, VaultHistoryPoint, VaultMode, VaultNetwork } from '../../api/vaultsClient';
import { pctSigned, usdCompact, usdSigned } from '../../model/format';
import { useVaultDaily, useVaultHistory } from '../../model/useVaults';
import { VaultChart, type VaultChartMode } from '../VaultChart';
import { useWindowParam, WINDOWS } from '../../model/params';
import { Bone } from '../primitives';

type Metric = 'return' | 'periods' | 'daily' | 'price' | 'tvl' | 'pnl';

const METRICS: {
  value: Metric;
  label: string;
  mode: VaultChartMode;
  format: (n: number) => string;
  series: (points: VaultHistoryPoint[]) => { time: number; value: number }[];
}[] = [
  {
    value: 'return',
    label: 'Return',
    mode: 'baseline',
    format: n => pctSigned(n / 100, 2),
    series: ps =>
      ps.flatMap(p => (p.return === null ? [] : [{ time: p.t / 1000, value: p.return * 100 }])),
  },
  {
    value: 'periods',
    label: 'Per period',
    mode: 'histogram',
    format: n => pctSigned(n / 100, 3),
    series: ps =>
      ps.slice(1).map((p, i) => ({
        time: p.t / 1000,
        value: ps[i].share_price > 0 ? (p.share_price / ps[i].share_price - 1) * 100 : 0,
      })),
  },
  {
    value: 'daily',
    label: 'Daily P&L',
    mode: 'histogram',
    format: usdSigned,
    // Filled from the daily rows (dailySeries), not the snapshots.
    series: () => [],
  },
  {
    value: 'price',
    label: 'Share price',
    mode: 'area',
    format: n => n.toFixed(4),
    series: ps => ps.map(p => ({ time: p.t / 1000, value: p.share_price })),
  },
  {
    value: 'tvl',
    label: 'TVL',
    mode: 'area',
    format: usdCompact,
    series: ps => ps.map(p => ({ time: p.t / 1000, value: p.tvl })),
  },
  {
    value: 'pnl',
    label: 'PnL',
    mode: 'baseline',
    format: usdSigned,
    series: ps => ps.flatMap(p => (p.pnl === null ? [] : [{ time: p.t / 1000, value: p.pnl }])),
  },
];

/** One bar per UTC day, at the day's midnight. */
function dailySeries(days: VaultDay[]) {
  return days.map(d => ({ time: Date.parse(`${d.day}T00:00:00Z`) / 1000, value: d.pnl }));
}

export function PerformancePanel({
  network,
  address,
  mode,
}: {
  network: VaultNetwork;
  address: string;
  mode?: VaultMode;
}) {
  const { window, setWindow } = useWindowParam();
  // Before launch the share price is pinned at 1, so every return series is
  // flat zero: chart deposits (TVL) only.
  const preLaunch = mode === 'pre-deposit';
  const history = useVaultHistory(network, address, window);
  const daily = useVaultDaily(network, address, window);
  const days = daily.data?.days;
  const hasDaily = !!days?.length;
  // Daily P&L replaces the per-period returns where the vault has daily rows.
  const shown = METRICS.filter(x => (hasDaily ? x.value !== 'periods' : x.value !== 'daily'));
  const metrics = preLaunch ? shown.filter(x => x.value === 'tvl' || x.value === 'daily') : shown;
  const [picked, setMetric] = useState<Metric>('return');
  const metric = metrics.some(x => x.value === picked) ? picked : metrics[0].value;
  const m = METRICS.find(x => x.value === metric)!;
  const pending = metric === 'daily' ? daily.isPending : history.isPending;

  const data = useMemo(() => {
    const series =
      metric === 'daily' ? dailySeries(days ?? []) : m.series(history.data?.points ?? []);
    // Lightweight Charts needs strictly increasing times.
    return series.filter((p, i) => i === 0 || p.time > series[i - 1].time);
  }, [history.data, days, m, metric]);
  // One day is already a bar; a line needs two points.
  const enough = metric === 'daily' ? data.length >= 1 : data.length >= 2;

  return (
    <section className="flex min-h-[22rem] flex-col border border-outline">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <TabStrip
          id="vault-metric"
          active={metric}
          className="-mb-1.5 flex overflow-x-auto"
          role="tablist"
        >
          {metrics.map(x => (
            <TabStripItem
              key={x.value}
              value={x.value}
              onSelect={v => setMetric(v as Metric)}
              className="h-9"
            >
              {x.label}
            </TabStripItem>
          ))}
        </TabStrip>
        {preLaunch && (
          <span className="mr-auto font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60">
            Returns chart from launch
          </span>
        )}
        <Segmented
          aria-label="Chart window"
          mono
          value={window}
          onChange={setWindow}
          options={WINDOWS}
        />
      </div>
      <div className="grid-pattern relative flex-1 p-2">
        {pending ? (
          <Bone className="h-full min-h-72 w-full" />
        ) : !enough ? (
          <div className="relative flex h-full min-h-72 flex-col items-center justify-center gap-1.5 overflow-hidden text-center">
            <DitherRidge
              seed={address}
              className="absolute inset-x-0 bottom-0 h-1/4 max-h-24 text-lichen opacity-60"
            />
            <p className="relative text-sm text-rock/75">Not enough history yet</p>
            <p className="relative max-w-xs text-xs text-rock/60">
              {metric === 'pnl'
                ? 'PnL is charted from the gateway’s own snapshots, which started recently.'
                : metric === 'daily'
                  ? 'Daily P&L is recorded once a day; the first day is still in progress.'
                  : 'The chart fills in as the vault is synced. Try a longer window.'}
            </p>
          </div>
        ) : (
          <div className="h-full min-h-72">
            <VaultChart key={metric} data={data} mode={m.mode} formatValue={m.format} />
          </div>
        )}
      </div>
    </section>
  );
}
