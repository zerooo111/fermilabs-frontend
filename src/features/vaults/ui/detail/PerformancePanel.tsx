/**
 * The vault chart: total value (including deposits and withdrawals) or profit
 * (trading result only) over a chosen window.
 */
import { useMemo, useState } from 'react';

import { Panel } from '@/shared/ui/panel';

import { usdCompact } from '../../model/format';
import { RANGES, sliceHistory, type Range } from '../../model/range';
import type { Vault } from '../../model/types';
import { SegmentedTabs } from '../RangeTabs';
import { VaultChart } from '../VaultChart';

type Metric = 'value' | 'pnl';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'pnl', label: 'Profit' },
];

export function PerformancePanel({ vault }: { vault: Vault }) {
  const [metric, setMetric] = useState<Metric>('value');
  const [range, setRange] = useState<Range>('90D');

  // Profit restarts at zero for the window, so the chart shows what the
  // vault made in this period rather than its lifetime total.
  const data = useMemo(() => {
    const slice = sliceHistory(vault.history, range);
    const base = slice[0].pnl;
    return slice.map(p => ({ time: p.time, value: metric === 'pnl' ? p.pnl - base : p.value }));
  }, [vault.history, range, metric]);

  return (
    <Panel>
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle bg-surface-raised px-3 py-2">
        <SegmentedTabs label="Chart" value={metric} options={METRICS} onChange={setMetric} />
        <SegmentedTabs label="Time range" value={range} options={RANGES} onChange={setRange} />
      </div>
      <div className="grid-pattern bg-surface-sunken px-1 pt-2">
        <VaultChart
          data={data}
          mode={metric === 'pnl' ? 'baseline' : 'area'}
          formatValue={usdCompact}
          height={260}
        />
      </div>
    </Panel>
  );
}
