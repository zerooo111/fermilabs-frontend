/**
 * Vault performance over the selected window: cumulative return, per-period
 * returns, share price, TVL and PnL. History is the gateway's snapshots
 * (every 15 min) plus points recovered from chain (epoch closes, NAV events).
 */
import { useMemo, useState } from 'react';

import { Segmented } from '@/shared/ui/segmented';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { VaultHistoryPoint, VaultNetwork } from '../../api/vaultsClient';
import { pctSigned, usdCompact, usdSigned } from '../../model/format';
import { useVaultHistory } from '../../model/useVaults';
import { VaultChart, type VaultChartMode } from '../VaultChart';
import { useWindowParam, WINDOWS } from '../../model/params';
import { Bone } from '../primitives';

type Metric = 'return' | 'periods' | 'price' | 'tvl' | 'pnl';

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

export function PerformancePanel({ network, address }: { network: VaultNetwork; address: string }) {
  const { window, setWindow } = useWindowParam();
  const [metric, setMetric] = useState<Metric>('return');
  const history = useVaultHistory(network, address, window);
  const m = METRICS.find(x => x.value === metric)!;

  const data = useMemo(() => {
    const points = history.data?.points ?? [];
    // Lightweight Charts needs strictly increasing times.
    const series = m.series(points);
    return series.filter((p, i) => i === 0 || p.time > series[i - 1].time);
  }, [history.data, m]);

  return (
    <section className="flex min-h-[22rem] flex-col border border-outline">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <TabStrip
          id="vault-metric"
          active={metric}
          className="-mb-1.5 flex overflow-x-auto"
          role="tablist"
        >
          {METRICS.map(x => (
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
        <Segmented
          aria-label="Chart window"
          mono
          value={window}
          onChange={setWindow}
          options={WINDOWS}
        />
      </div>
      <div className="grid-pattern relative flex-1 p-2">
        {history.isPending ? (
          <Bone className="h-full min-h-72 w-full" />
        ) : data.length < 2 ? (
          <div className="flex h-full min-h-72 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-sm text-rock/70">Not enough history yet</p>
            <p className="max-w-xs text-xs text-rock/45">
              {metric === 'pnl'
                ? 'PnL is charted from the gateway’s own snapshots, which started recently.'
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
