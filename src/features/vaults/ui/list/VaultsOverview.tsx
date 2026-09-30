/**
 * The vaults listing: totals, the FLP spotlight, then every vault in a table.
 */
import { Eyebrow } from '@/shared/ui/panel';
import { cn } from '@/lib/utils';

import { tone, usd, usdCompact, usdSigned } from '../../model/format';
import { useVaults } from '../../model/useVaults';
import { FlpSpotlight } from './FlpSpotlight';
import { VaultsTable } from './VaultsTable';

export function VaultsOverview() {
  const { vaults } = useVaults();
  const flp = vaults.find(v => v.kind === 'protocol');

  const totalTvl = vaults.reduce((a, v) => a + v.tvl, 0);
  const mine = vaults.filter(v => v.user);
  const myEquity = mine.reduce((a, v) => a + (v.user?.equity ?? 0), 0);
  const myPnl = mine.reduce((a, v) => a + (v.user?.allTimePnl ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-none text-fg-primary md:text-4xl">Vaults</h1>
          <p className="text-sm text-fg-secondary">
            Deposit USDC into a vault and earn from its trading.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-px border border-line bg-line-subtle">
          <HeaderStat label="Total deposits" value={usdCompact(totalTvl)} />
          <HeaderStat label="Your deposits" value={usd(myEquity)} />
          <HeaderStat label="Your profit" value={usdSigned(myPnl)} valueClassName={tone(myPnl)} />
        </dl>
      </header>

      {flp && <FlpSpotlight vault={flp} />}

      <VaultsTable vaults={vaults} />
    </div>
  );
}

function HeaderStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface-canvas px-4 py-2.5 md:min-w-[9rem]">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd
        className={cn(
          'font-mono text-base font-semibold tabular-nums text-fg-primary',
          valueClassName
        )}
      >
        {value}
      </dd>
    </div>
  );
}
