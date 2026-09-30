/**
 * FLP gets a featured slot at the top of the listing, since it is the default
 * place to earn on Fermi.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/shared/ui/button';
import { Eyebrow, FOCUS_RING, Panel } from '@/shared/ui/panel';
import { cn } from '@/lib/utils';

import { pct, tone, usd, usdCompact } from '../../model/format';
import { sliceHistory, type Range } from '../../model/range';
import type { Vault } from '../../model/types';
import { DepositDialog } from '../DepositDialog';
import { SegmentedTabs } from '../RangeTabs';
import { VaultChart } from '../VaultChart';
import { KindBadge } from '../VaultBadges';

const SPOTLIGHT_RANGES = ['30D', '90D', 'ALL'] as const satisfies readonly Range[];

export function FlpSpotlight({ vault }: { vault: Vault }) {
  const [range, setRange] = useState<(typeof SPOTLIGHT_RANGES)[number]>('90D');
  const chartData = useMemo(
    () => sliceHistory(vault.history, range).map(p => ({ time: p.time, value: p.value })),
    [vault.history, range]
  );

  return (
    <Panel>
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <KindBadge kind={vault.kind} />
            <span className="text-xs text-fg-tertiary">Withdraw after {vault.lockupDays} days</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-3xl leading-tight text-fg-primary md:text-4xl">
              {vault.name}
            </h2>
            <p className="max-w-md text-sm text-fg-secondary">{vault.description}</p>
          </div>

          <dl className="grid grid-cols-3 gap-px border border-line bg-line-subtle">
            <Stat label="APR" value={pct(vault.apr30d, 1)} className={tone(vault.apr30d)} />
            <Stat label="Total deposits" value={usdCompact(vault.tvl)} />
            <Stat label="Your deposit" value={vault.user ? usd(vault.user.equity) : '-'} />
          </dl>

          <div className="flex gap-2">
            <DepositDialog vault={vault}>
              <Button className={cn('h-9 px-5', FOCUS_RING)}>Deposit</Button>
            </DepositDialog>
            <Button asChild variant="outline" className={cn('h-9 px-5', FOCUS_RING)}>
              <Link to={`/vaults/${vault.id}`}>View vault</Link>
            </Button>
          </div>
        </div>

        <div className="grid-pattern flex min-h-[220px] flex-col border-t border-line bg-surface-sunken lg:border-t-0 lg:border-l">
          <div className="flex items-center justify-between px-4 pt-4">
            <Eyebrow>Vault value</Eyebrow>
            <SegmentedTabs
              label="Chart range"
              value={range}
              options={SPOTLIGHT_RANGES}
              onChange={setRange}
            />
          </div>
          <div className="relative flex-1">
            <div className="absolute inset-0">
              <VaultChart data={chartData} mode="area" formatValue={usdCompact} minimal />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface-canvas px-3 py-2.5">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd
        className={cn('font-mono text-base font-semibold tabular-nums text-fg-primary', className)}
      >
        {value}
      </dd>
    </div>
  );
}
