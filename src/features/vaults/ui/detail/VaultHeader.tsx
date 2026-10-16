/**
 * Top of the vault page: name, who runs it, the deposit and withdraw buttons,
 * and the four numbers people check first.
 */
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Eyebrow, FOCUS_RING } from '@/shared/ui/panel';
import { cn } from '@/lib/utils';

import { pct, shortAddress, tone, usd, usdCompact, usdSigned } from '../../model/format';
import type { Vault } from '../../model/types';
import { DepositDialog } from '../DepositDialog';
import { KindBadge, StatusBadge } from '../VaultBadges';
import { VaultMark } from '../VaultMark';

export function VaultHeader({ vault }: { vault: Vault }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/vaults"
        className={cn(
          'flex w-fit items-center gap-1 text-xs text-fg-tertiary transition-colors hover:text-fg-primary',
          FOCUS_RING
        )}
      >
        <ChevronLeft className="size-3.5" />
        All vaults
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <VaultMark vault={vault} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl leading-none text-fg-primary md:text-4xl">
                {vault.name}
              </h1>
              <KindBadge kind={vault.kind} />
              <StatusBadge status={vault.status} />
            </div>
            <span className="text-xs text-fg-tertiary">
              Managed by{' '}
              <span className="text-fg-primary">
                {vault.kind === 'protocol' ? 'Fermi' : shortAddress(vault.leader)}
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <DepositDialog vault={vault}>
            <Button className={cn('h-9 flex-1 px-6 md:flex-none', FOCUS_RING)}>Deposit</Button>
          </DepositDialog>
          <DepositDialog vault={vault} initialMode="withdraw">
            <Button variant="outline" className={cn('h-9 flex-1 px-6 md:flex-none', FOCUS_RING)}>
              Withdraw
            </Button>
          </DepositDialog>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border border-line bg-line-subtle md:grid-cols-4">
        <Cell label="APR" value={pct(vault.apr30d, 2)} className={tone(vault.apr30d)} />
        <Cell label="Total deposits" value={usdCompact(vault.tvl)} />
        <Cell label="Your deposit" value={vault.user ? usd(vault.user.equity) : '-'} />
        <Cell
          label="Your profit"
          value={vault.user ? usdSigned(vault.user.allTimePnl) : '-'}
          className={vault.user ? tone(vault.user.allTimePnl) : undefined}
        />
      </dl>
    </div>
  );
}

function Cell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface-canvas px-4 py-3">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd className={cn('font-mono text-lg font-semibold tabular-nums text-fg-primary', className)}>
        {value}
      </dd>
    </div>
  );
}
