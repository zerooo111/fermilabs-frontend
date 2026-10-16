/**
 * FLP gets a featured slot at the top of the listing, since it is the default
 * place to earn on Fermi. Unlike the rest of the listing it reads the live
 * vault on chain; deposits and withdrawals happen on /flp.
 */
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

import { FLP_CLUSTER, MODE_LABEL, formatUnits, useFlpVault } from '@/features/flp-vault';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Eyebrow, FOCUS_RING, Panel } from '@/shared/ui/panel';
import { cn } from '@/lib/utils';

export function FlpSpotlight() {
  const { vault, user, owner } = useFlpVault();
  const v = vault.data;
  const dash = vault.isError ? 'Unavailable' : '…';

  const myShares =
    !owner || !v ? '-' : user.data ? formatUnits(user.data.shareBalance, v.shareDecimals, 2) : '…';

  return (
    <Panel>
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <Badge variant="amber" className="font-mono text-[10px] uppercase tracking-[0.1em]">
              <ShieldCheck />
              Official
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-tertiary">
              {FLP_CLUSTER}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-3xl leading-tight text-fg-primary md:text-4xl">
              Fermi Liquidity Provider
            </h2>
            <p className="max-w-md text-sm text-fg-secondary">
              Deposit USDC to provide liquidity to Fermi perps and earn from market making.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-px border border-line bg-line-subtle">
            <Stat label="Status" value={v ? MODE_LABEL[v.mode] : dash} />
            <Stat
              label="Total deposits"
              value={v ? formatUnits(v.escrowBalance, v.quoteDecimals, 0) : dash}
            />
            <Stat label="Your FLP" value={myShares} />
          </dl>

          <div className="flex gap-2">
            <Button asChild className={cn('h-9 px-5', FOCUS_RING)}>
              <Link to="/flp">{v?.mode === 'pre-deposit' ? 'Pre-deposit' : 'Open vault'}</Link>
            </Button>
          </div>
        </div>

        <div className="grid-pattern flex min-h-[220px] flex-col justify-end gap-3 border-t border-line bg-surface-sunken p-5 lg:border-t-0 lg:border-l">
          <Eyebrow>Vault limits</Eyebrow>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-sm tabular-nums">
            <Row label="Deposit cap" value={v ? formatUnits(v.tvlCap, v.quoteDecimals, 0) : dash} />
            <Row
              label="Min deposit"
              value={v ? formatUnits(v.minDeposit, v.quoteDecimals) : dash}
            />
            <Row label="Deposits" value={v ? (v.depositsOpen ? 'Open' : 'Paused') : dash} />
            <Row label="Withdrawals" value={v ? (v.withdrawalsOpen ? 'Open' : 'Paused') : dash} />
          </dl>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface-canvas px-3 py-2.5">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd className="font-mono text-base font-semibold tabular-nums text-fg-primary">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-subtle pb-1.5">
      <dt className="text-xs text-fg-tertiary">{label}</dt>
      <dd className="text-fg-primary">{value}</dd>
    </div>
  );
}
