/**
 * One vault: headline numbers, what it is and how it's configured, its
 * performance chart, then depositors and activity.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import {
  FlpHoldings,
  FlpHttpError,
  FLP_GRADUATION_ESTIMATE_MS,
  FlpLaunchStrip,
  FlpPerformance,
  FlpRequests,
  useFlpLiveUpdates,
  type FlpVaultConfig,
} from '@/features/flp-vault';
import { DitherRidge } from '@/shared/ui/dither-ridge';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { Vault, VaultNetwork, VaultReference, VaultUser } from '../../api/vaultsClient';
import {
  pct,
  bps,
  capLabel,
  countdown,
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
import { useVault, useVaultDaily, useVaultHistory, useWalletAddress } from '../../model/useVaults';
import { Address } from '../Address';
import { useWindowParam } from '../../model/params';
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
      {flp && <FlpLive config={flp} />}
      <Header vault={v} network={network} address={address} />
      {flp && <FlpLaunchStrip vault={flp.address} />}
      <Stats vault={v} />
      {flp && <FlpRequests vault={flp.address} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {v ? <OverviewPanel vault={v} /> : <Bone className="min-h-[22rem] w-full" />}
        {flp ? (
          <FlpChart config={flp} network={network} address={address} />
        ) : (
          <PerformancePanel network={network} address={address} />
        )}
      </div>
      {flp ? <FlpHoldings vault={flp.address} /> : v && <ActivityPanel vault={v} />}
    </div>
  );
}

/**
 * An FLP vault's chart: the gateway's synced history (epoch closes, NAV events,
 * 15-minute snapshots) once it has some, otherwise the live numbers and how
 * the vault works. The gateway is optional: if it's down, the page still works.
 */
function FlpChart({
  config,
  network,
  address,
}: {
  config: FlpVaultConfig;
  network: VaultNetwork;
  address: string;
}) {
  const { window } = useWindowParam();
  const history = useVaultHistory(network, address, window);
  // The chart (with its own skeleton) while history loads; the stats panel
  // only once the gateway has answered with too little history to draw.
  if (history.isPending || (history.data?.points.length ?? 0) >= 2)
    return <PerformancePanel network={network} address={address} />;
  return <FlpPerformance vault={config.address} />;
}

/** Chain subscriptions for an FLP vault page, mounted once. */
function FlpLive({ config }: { config: FlpVaultConfig }) {
  useFlpLiveUpdates(config.address);
  return null;
}

/** How old the vault data is, once it's old enough to matter (the FLP API can lag minutes). */
function Freshness({ vault: v }: { vault: Vault }) {
  const now = useNow();
  const age = Math.max(0, Math.round((now - v.synced_at_ms) / 1000));
  if (age < 30) return null;
  return (
    <span
      className={cn(
        'font-mono text-[11px] tabular-nums',
        age > 120 ? 'text-amber-200' : 'text-rock/60'
      )}
      title="The vault data API can serve a copy while it refreshes"
    >
      Updated {timeAgo(v.synced_at_ms, now)}
      {v.stale ? ' · refreshing' : ''}
    </span>
  );
}

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
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
              <Address address={address} network={network} className="text-xs text-rock/60" />
              {v && <Freshness vault={v} />}
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

/**
 * What the balance is made of: shares, a queued deposit, a pending
 * withdrawal and what's ready to claim (the "Your requests" card has each
 * request's timing and actions).
 */
function balanceParts(u: VaultUser): string[] {
  const parts: string[] = [];
  // `shares` includes the ones under withdrawal and the ones ready to claim.
  const of = [
    (u.claimable_shares ?? 0) > 0 && `${num(u.claimable_shares!)} to claim`,
    u.pending_withdraw_shares > 0 && `${num(u.pending_withdraw_shares)} withdrawing`,
  ].filter(Boolean);
  if (u.shares > 0) parts.push(`${num(u.shares)} FLP${of.length ? ` (${of.join(', ')})` : ''}`);
  if (u.pending_deposit > 0) parts.push(`${usd(u.pending_deposit)} queued`);
  // Gateway vaults give only the USDC-terms total.
  const quote = u.claimable_quote ?? (u.claimable_shares === undefined ? (u.claimable ?? 0) : 0);
  if (quote > 0) parts.push(`${usd(quote)} to claim`);
  return parts;
}

/**
 * The market maker's P&L from the private phase before the vault launched
 * (the data API's labelled reference series): a line under the first tile,
 * kept out of APR and returns, with its caveats on hover.
 */
function PrivatePhase({ r }: { r: VaultReference }) {
  const full = r.days.filter(d => !d.partial);
  if (!full.length) return null;
  const s = r.summary;
  const pnl = s?.pnl !== undefined ? Number(s.pnl) : full.reduce((a, d) => a + d.pnl, 0);
  const pctOfStart =
    s?.pnlPctOfStart !== undefined ? Number(s.pnlPctOfStart) / 100 : pnl / full[0].equity_start;
  const range = dayRange(full[0].day, full[full.length - 1].day);
  const combined = s?.makerHedgeAndTakerCombinedPnl;
  const title = [
    `Historic P&L from the private phase, ${range}: Fermi’s market-maker account and its hedge, taker excluded, before this vault existed. Not this vault’s returns.`,
    combined !== undefined
      ? `With the taker included, about ${usdSigned(Number(combined))}${s?.relayFeesDeducted === false ? ', before relay fees' : ''}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <p className="truncate font-mono text-[11px] text-rock/60" title={title}>
      Private phase{' '}
      <span className={tone(pnl)}>
        {`${pnl < 0 ? '-' : '+'}$${Math.round(Math.abs(pnl)).toLocaleString('en-US')} (${pctSigned(pctOfStart, 1)})`}
      </span>{' '}
      · {range}
    </p>
  );
}

/** "1–19 Oct" (UTC days). */
function dayRange(from: string, to: string): string {
  const d = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${d(from, { day: 'numeric' })}–${d(to, { day: 'numeric', month: 'short' })}`
    : `${d(from, { day: 'numeric', month: 'short' })} – ${d(to, { day: 'numeric', month: 'short' })}`;
}

function Stats({ vault: v }: { vault?: Vault }) {
  const wallet = useWalletAddress();
  const loading = !v;
  const user = v?.user ?? null;
  // Connected, but this wallet's read hasn't landed yet: never show someone else's.
  const userLoading = !!wallet && (!v || v.user === undefined);
  const windowTag = v ? (v.window === 'all' ? 'All' : v.window.toUpperCase()) : '';
  const daily = useVaultDaily(v?.network ?? 'devnet', v?.address ?? '', 'all', v?.source === 'flp');
  const reference = daily.data?.reference;
  const privatePhase = reference ? <PrivatePhase r={reference} /> : null;
  return (
    <div className="grid grid-cols-2 divide-outline border border-outline max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*]:border-outline sm:grid-cols-4 sm:divide-x">
      {v?.mode === 'pre-deposit' ? (
        <Tile
          label="Deposit cap"
          value={capLabel(v.tvl, v.tvl_cap)}
          hint={`${usd(v.tvl, 0)} of ${usd(v.tvl_cap, 0)}`}
          footer={<CapMeter tvl={v.tvl} cap={v.tvl_cap} bare />}
        />
      ) : v?.apr === null && v.source === 'flp' ? (
        // No history for an APR yet: the return since launch is the real number.
        <Tile
          label="Since launch"
          value={pctSigned(v.all_time_return)}
          valueClassName={tone(v.all_time_return)}
          hint="APR after a week of history"
          footer={privatePhase}
        />
      ) : (
        <Tile
          label={`APR · ${windowTag}`}
          loading={loading}
          value={v ? <AprValue vault={v} /> : ''}
          hint={v?.window_return != null ? `${pctSigned(v.window_return)} return` : null}
          footer={privatePhase}
        />
      )}
      <Tile
        label="TVL"
        loading={loading}
        value={v ? usd(v.tvl) : ''}
        hint={v ? `${v.depositors} ${v.depositors === 1 ? 'depositor' : 'depositors'}` : null}
      />
      <Tile
        label="Your balance"
        loading={userLoading}
        value={!wallet || !user ? DASH : usd(user.equity)}
        hint={!wallet ? 'Connect wallet' : user ? balanceParts(user).join(' · ') || null : null}
      />
      {v?.mode === 'pre-deposit' ? (
        // Nothing to earn yet; what you own of the vault is the useful number.
        <Tile
          label="Your share"
          loading={userLoading}
          value={!wallet || !user || !v.tvl ? DASH : pct(user.equity / v.tvl, 2)}
          hint={wallet && user ? 'of the vault' : null}
        />
      ) : (
        <Tile
          label="Your earnings"
          loading={userLoading}
          value={!wallet || !user ? DASH : usdSigned(user.all_time_pnl)}
          valueClassName={user ? tone(user.all_time_pnl) : undefined}
          hint={user && user.all_time_pnl === null ? 'Not priced right now' : null}
        />
      )}
    </div>
  );
}

type OverviewTab = 'about' | 'parameters';

function OverviewPanel({ vault: v }: { vault: Vault }) {
  const flp = isFlpVault(v.network, v.address);
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
          <p className="px-4 py-3.5 text-sm leading-relaxed text-rock/75">{v.description}</p>
          <Lifecycle
            vault={v}
            graduationEstimateMs={flp ? FLP_GRADUATION_ESTIMATE_MS : undefined}
            whitelistTrading={!!flp}
          />
          <dl className="divide-y divide-outline border-t border-outline">
            <Row label="Leader">
              {v.kind === 'protocol' ? (
                <Address address={v.leader} network={v.network} label="Fermi" />
              ) : (
                <Address address={v.leader} network={v.network} />
              )}
            </Row>
            {v.breaker_tripped && (
              <Row label="Status">
                <span className="text-danger">Paused by the circuit breaker</span>
              </Row>
            )}
            {v.mode === 'live' && (v.next_settlement_ms ?? v.epoch_started_at_ms) && (
              <Row label="Next settlement">
                <Settlement
                  endsAtMs={
                    v.next_settlement_ms ?? v.epoch_started_at_ms! + v.epoch_duration_s * 1000
                  }
                />
              </Row>
            )}
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
  const now = useNow();
  const left = Math.round((endsAtMs - now) / 1000);
  if (left <= 0) return <span className="text-rock/60">Settling, usually under a minute</span>;
  return <span className="tabular-nums">in {countdown(left)}</span>;
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const missing = status === 404 || status === 400;
  // The FLP data service doesn't read this deployment (a reader on another
  // profile or vault): a retry won't help.
  const unread = error instanceof FlpHttpError && error.status === 422;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 border border-outline px-4 py-16 text-center"
    >
      <p className="text-sm text-rock/75">
        {missing
          ? 'Vault not found'
          : unread
            ? 'This vault’s data isn’t available yet'
            : 'Couldn’t load this vault'}
      </p>
      <p className="text-xs text-rock/60">
        {missing
          ? 'Check the link, or pick a vault from the list.'
          : unread
            ? 'Fermi is upgrading the vault data service. Check back soon.'
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
