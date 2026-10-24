/**
 * One vault: headline numbers, what it is and how it's configured, its
 * performance chart, then depositors and activity.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { FlpDevnetStrip, FlpHoldings, FlpRequests } from '@/features/flp-vault';
import { DitherRidge } from '@/shared/ui/dither-ridge';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { Vault, VaultNetwork } from '../../api/vaultsClient';
import {
  pct,
  bps,
  capLabel,
  duration,
  formatDate,
  num,
  pctSigned,
  timeAgo,
  tone,
  usd,
  usdSigned,
} from '../../model/format';
import { isFlpVault } from '../../model/flpSource';
import { useVault, useWalletAddress } from '../../model/useVaults';
import { Address } from '../Address';
import { MODE_LABEL, useWindowParam } from '../../model/params';
import { ModeBadge, NetworkBadge } from '../VaultBadges';
import { VaultMark } from '../VaultMark';
import { Bone, DASH, Row, Tile } from '../primitives';
import { AprValue, CapMeter } from '../VaultMetrics';
import { ActivityPanel } from './ActivityPanel';
import { Lifecycle } from './Lifecycle';
import { PerformancePanel } from './PerformancePanel';
import { VaultActions } from './VaultActions';

export function VaultDetail({ network, address }: { network: VaultNetwork; address: string }) {
  const { window } = useWindowParam();
  const q = useVault(network, address, window);
  // FLP vaults read the FLP data API, which also gives their positions and
  // the wallet's open requests, but no history or activity feed yet.
  const flp = isFlpVault(network, address);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const v = q.data;

  return (
    <div className="flex flex-col gap-5">
      <Header vault={v} network={network} address={address} />
      {flp && <FlpDevnetStrip vault={flp.address} />}
      <Stats vault={v} />
      {flp && <FlpRequests vault={flp.address} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {v ? <OverviewPanel vault={v} /> : <Bone className="min-h-[22rem] w-full" />}
        <PerformancePanel network={network} address={address} mode={v?.mode} history={!flp} />
      </div>
      {flp ? <FlpHoldings vault={flp.address} /> : v && <ActivityPanel vault={v} />}
    </div>
  );
}

function Header({
  vault: v,
  network,
  address,
}: {
  vault?: Vault;
  network: VaultNetwork;
  address: string;
}) {
  return (
    <header className="relative flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
      <DitherRidge
        seed={address}
        density={0.35}
        className="pointer-events-none absolute right-0 bottom-0 hidden h-24 w-2/5 text-lichen opacity-30 [mask-image:linear-gradient(to_right,transparent,black_50%)] md:block"
      />
      <div className="relative flex min-w-0 flex-col gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-rock/60"
        >
          <Link to="/vaults" className="hover:text-rock">
            Vaults
          </Link>
          <span aria-hidden>/</span>
          <span>{v?.kind === 'community' ? 'Community' : 'Protocol'}</span>
          <span aria-hidden>/</span>
          <span className="truncate normal-case tracking-normal">
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
        </nav>
        <div className="flex min-w-0 items-center gap-4">
          {v && <VaultMark vault={v} size="lg" />}
          <div className="flex min-w-0 flex-col gap-2">
            {v ? (
              <h1 className="font-serif text-3xl font-light leading-tight text-balance tracking-[-0.02em] text-rock md:text-4xl">
                {v.name}
              </h1>
            ) : (
              <Bone className="h-9 w-80" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <NetworkBadge network={network} />
              {v && <ModeBadge mode={v.mode} />}
              <Address address={address} network={network} className="text-xs text-rock/55" />
            </div>
          </div>
        </div>
      </div>
      {v && (
        <div className="relative">
          <VaultActions vault={v} />
        </div>
      )}
    </header>
  );
}

function Stats({ vault: v }: { vault?: Vault }) {
  const wallet = useWalletAddress();
  const loading = !v;
  const user = v?.user ?? null;
  const windowTag = v ? (v.window === 'all' ? 'All' : v.window.toUpperCase()) : '';
  return (
    <div className="grid grid-cols-2 divide-outline border border-outline max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*]:border-outline sm:grid-cols-4 sm:divide-x">
      {v?.mode === 'pre-deposit' ? (
        <Tile
          label="Deposit cap"
          value={capLabel(v.tvl, v.tvl_cap)}
          hint={`${usd(v.tvl, 0)} of ${usd(v.tvl_cap, 0)}`}
          footer={<CapMeter tvl={v.tvl} cap={v.tvl_cap} bare />}
        />
      ) : (
        <Tile
          label={`APR · ${windowTag}`}
          loading={loading}
          value={v ? <AprValue vault={v} /> : ''}
          hint={v?.window_return != null ? `${pctSigned(v.window_return)} return` : null}
        />
      )}
      <Tile
        label="TVL"
        loading={loading}
        value={v ? usd(v.tvl) : ''}
        hint={v ? `${v.depositors} ${v.depositors === 1 ? 'depositor' : 'depositors'}` : null}
      />
      <Tile
        label="Your deposit"
        loading={loading && !!wallet}
        value={
          !wallet ? (
            <span className="text-base font-normal text-rock/60">Connect wallet</span>
          ) : user ? (
            usd(user.equity)
          ) : (
            DASH
          )
        }
        hint={user && user.shares > 0 ? `${num(user.shares)} shares` : null}
      />
      {v?.mode === 'pre-deposit' ? (
        // Nothing to earn yet; what you own of the vault is the useful number.
        <Tile
          label="Your share"
          loading={loading && !!wallet}
          value={!wallet || !user || v.tvl <= 0 ? DASH : pct(user.equity / v.tvl, 2)}
          hint={wallet && user ? 'of the vault' : null}
        />
      ) : (
        <Tile
          label="Your all-time PnL"
          loading={loading && !!wallet}
          value={!wallet || !user ? DASH : usdSigned(user.all_time_pnl)}
          valueClassName={user ? tone(user.all_time_pnl) : undefined}
        />
      )}
    </div>
  );
}

type OverviewTab = 'about' | 'parameters';

function OverviewPanel({ vault: v }: { vault: Vault }) {
  const [tab, setTab] = useState<OverviewTab>('about');

  return (
    <section className="flex flex-col border border-outline">
      <div className="flex items-center border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <TabStrip id="vault-overview" active={tab} className="-mb-1.5 flex" role="tablist">
          <TabStripItem value="about" onSelect={() => setTab('about')} className="h-9">
            Overview
          </TabStripItem>
          <TabStripItem value="parameters" onSelect={() => setTab('parameters')} className="h-9">
            Parameters
          </TabStripItem>
        </TabStrip>
      </div>
      {tab === 'about' ? (
        <>
          <p className="border-b border-outline px-4 py-3.5 text-sm leading-relaxed text-rock/75">
            {v.description}
          </p>
          <dl className="divide-y divide-outline">
            <Row label="Leader">
              {v.kind === 'protocol' ? (
                <Address address={v.leader} network={v.network} label="Fermi" />
              ) : (
                <Address address={v.leader} network={v.network} />
              )}
            </Row>
            <Row label="Status">
              {MODE_LABEL[v.mode]}
              {v.breaker_tripped && <span className="ml-2 text-danger">breaker tripped</span>}
            </Row>
            {v.mode === 'live' && v.epoch_started_at_ms && (
              <Row label="Next settlement">
                <Settlement endsAtMs={v.epoch_started_at_ms + v.epoch_duration_s * 1000} />
              </Row>
            )}
            <Row label="Depositors">{v.depositors}</Row>
            <Row label="All-time vault PnL">
              <span className={tone(v.all_time_pnl)}>{usdSigned(v.all_time_pnl)}</span>
            </Row>
            <Row label="Created">
              {formatDate(v.created_at_ms / 1000)} · {v.age_days}d
            </Row>
            <Row label="Fees">
              {v.fees.management_bps + v.fees.performance_bps === 0
                ? 'None'
                : `${bps(v.fees.management_bps)} mgmt · ${bps(v.fees.performance_bps)} perf`}
            </Row>
          </dl>
          <Lifecycle vault={v} />
          {v.mode !== 'pre-deposit' && (
            <div className="border-t border-outline px-4 py-3">
              <CapMeter tvl={v.tvl} cap={v.tvl_cap} />
            </div>
          )}
        </>
      ) : (
        <dl className="divide-y divide-outline">
          <Row label="Network">
            <NetworkBadge network={v.network} />
          </Row>
          <Row label="Epoch">
            #{v.epoch} · every {duration(v.epoch_duration_s)}
          </Row>
          <Row label="Min deposit">{usd(v.min_deposit)}</Row>
          <Row label="Deposit / withdraw fee">
            {bps(v.fees.deposit_bps)} / {bps(v.fees.withdraw_bps)}
          </Row>
          <Row label="Share price">{v.share_price.toFixed(6)}</Row>
          <Row label="High-water mark">{v.high_water_mark.toFixed(6)}</Row>
          <Row label="Share supply">{num(v.share_supply)}</Row>
          <Row label="Vault">
            <Address address={v.address} network={v.network} />
          </Row>
          <Row label="Program">
            <Address address={v.program_id} network={v.network} />
          </Row>
          <Row label="Share mint">
            <Address address={v.share_mint} network={v.network} />
          </Row>
          <Row label="Trading account">
            <Address address={v.fermi_account} network={v.network} />
          </Row>
          <Row label="Synced">
            <span className={cn(v.stale && 'text-amber-200')}>
              {timeAgo(v.synced_at_ms)}
              {v.stale && ' (stale)'}
            </span>
          </Row>
        </dl>
      )}
    </section>
  );
}

/** Countdown to the epoch close, when queued deposits and withdrawals are priced. */
function Settlement({ endsAtMs }: { endsAtMs: number }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.round((endsAtMs - now) / 1000);
  if (left <= 0) return <span className="text-rock/60">Settling now</span>;
  return (
    <span className="tabular-nums">
      in{' '}
      {left >= 60 ? `${Math.floor(left / 60)}m ${String(left % 60).padStart(2, '0')}s` : `${left}s`}
    </span>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const missing = status === 404 || status === 400;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 border border-outline px-4 py-16 text-center"
    >
      <p className="text-sm text-rock/75">
        {missing ? 'Vault not found' : 'Couldn’t load this vault'}
      </p>
      <p className="text-xs text-rock/60">
        {missing
          ? 'Check the link, or pick a vault from the list.'
          : 'Check your connection and try again.'}
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/vaults">All vaults</Link>
        </Button>
        {!missing && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
