/**
 * The vaults listing: headline totals, search + network + window controls,
 * then protocol and community vaults in separate tables. Everything is read
 * from the gateway, which syncs the vaults from chain; devnet and mainnet
 * stay apart in every total.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import axios from 'axios';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DitherRidge } from '@/shared/ui/dither-ridge';
import { Segmented } from '@/shared/ui/segmented';

import type { Vault, VaultNetwork } from '../../api/vaultsClient';
import { timeAgo, tone, usd, usdCompact, usdSigned } from '../../model/format';
import { useVaults, useWalletAddress } from '../../model/useVaults';
import { NetworkBadge } from '../VaultBadges';
import { useWindowParam, WINDOWS } from '../../model/params';
import { DASH, Eyebrow, Tile } from '../primitives';
import { VaultsTable } from './VaultsTable';

type NetworkFilter = 'all' | VaultNetwork;

export function VaultsOverview() {
  const { window, setWindow } = useWindowParam();
  const wallet = useWalletAddress();
  const list = useVaults(window);
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState<NetworkFilter>('all');

  const all = useMemo(() => list.data?.vaults ?? [], [list.data]);
  const counts = useMemo(
    () => ({
      all: all.length,
      mainnet: all.filter(v => v.network === 'mainnet').length,
      devnet: all.filter(v => v.network === 'devnet').length,
    }),
    [all]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      v =>
        (network === 'all' || v.network === network) &&
        (!q ||
          v.name.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q) ||
          v.leader.toLowerCase().includes(q))
    );
  }, [all, network, query]);

  const protocol = filtered.filter(v => v.kind === 'protocol');
  const community = filtered.filter(v => v.kind === 'community');
  const loading = list.isPending;

  return (
    <div className="flex flex-col gap-5">
      <header className="relative flex min-h-28 flex-col justify-end gap-2 px-1">
        {/* Brand texture: a faint dithered depth ridge behind the title, fading out
            toward the text so it never sits under anything people read. */}
        <DitherRidge
          seed="vaults"
          density={0.35}
          className="pointer-events-none absolute right-0 bottom-0 hidden h-28 w-1/2 text-lichen opacity-35 [mask-image:linear-gradient(to_right,transparent,black_45%)] md:block"
        />
        <Eyebrow className="relative">Earn</Eyebrow>
        <h1 className="relative font-serif text-4xl font-light leading-none tracking-[-0.02em] text-rock md:text-5xl">
          Vaults
        </h1>
        <p className="relative max-w-xl text-sm text-rock/70">
          Deposit USDC into a vault and earn a share of its trading. Fermi runs the protocol vault;
          anyone can run a community vault.
        </p>
      </header>

      <Totals vaults={all} totals={list.data?.totals} loading={loading} wallet={wallet} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-rock/55" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, vault or leader address"
            aria-label="Search vaults"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<NetworkFilter>
            aria-label="Network"
            mono
            value={network}
            onChange={setNetwork}
            className="w-max"
            options={(['all', 'mainnet', 'devnet'] as const).map(n => ({
              value: n,
              label: (
                <span className="flex items-center gap-1.5">
                  {n === 'all' ? 'All' : n === 'mainnet' ? 'Mainnet' : 'Devnet'}
                  <span className="text-rock/55 tabular-nums">{counts[n]}</span>
                </span>
              ),
            }))}
          />
          <Segmented
            aria-label="Return window"
            mono
            value={window}
            onChange={setWindow}
            className="w-max"
            options={WINDOWS}
          />
        </div>
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <VaultsTable
            title="Protocol vaults"
            vaults={protocol}
            window={window}
            loading={loading}
            empty={
              query || network !== 'all'
                ? { title: 'No protocol vaults match', body: 'Try another search or network.' }
                : {
                    title: 'No protocol vaults yet',
                    body: 'FLP will appear here once it’s deployed.',
                  }
            }
          />
          <VaultsTable
            title="Community vaults"
            vaults={community}
            window={window}
            loading={loading}
            empty={
              query || network !== 'all'
                ? { title: 'No community vaults match', body: 'Try another search or network.' }
                : {
                    title: 'No community vaults yet',
                    body: 'Vaults run by traders will be listed here, with their track record.',
                  }
            }
          />
          {list.data && (
            <p className="px-1 font-mono text-[11px] text-rock/55">
              Synced from chain · updated {timeAgo(list.data.updated_at_ms)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Totals({
  vaults,
  totals,
  loading,
  wallet,
}: {
  vaults: Vault[];
  totals?: { network: VaultNetwork; tvl: number; vaults: number }[];
  loading: boolean;
  wallet?: string;
}) {
  const mine = vaults.filter(v => v.user);
  const equity = mine.reduce((a, v) => a + (v.user?.equity ?? 0), 0);
  const pnl = mine.reduce((a, v) => a + (v.user?.all_time_pnl ?? 0), 0);
  // One TVL tile per network present, mainnet first; never a cross-network sum.
  const tvl = [...(totals ?? [])].sort((a, b) => a.network.localeCompare(b.network)).reverse();

  return (
    <div
      className={cn(
        'grid grid-cols-2 divide-outline border border-outline max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*]:border-outline sm:divide-x',
        tvl.length > 1 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
      )}
    >
      {loading ? (
        <Tile label="Total value locked" value="" loading />
      ) : tvl.length === 0 ? (
        <Tile label="Total value locked" value={DASH} />
      ) : (
        tvl.map(t => (
          <Tile
            key={t.network}
            label={
              <>
                TVL <NetworkBadge network={t.network} />
              </>
            }
            value={<span title={usd(t.tvl)}>{usdCompact(t.tvl)}</span>}
            hint={`${t.vaults} ${t.vaults === 1 ? 'vault' : 'vaults'}`}
          />
        ))
      )}
      <Tile
        label="Your deposits"
        loading={loading && !!wallet}
        value={
          !wallet ? (
            <span className="text-base font-normal text-rock/60">Connect wallet</span>
          ) : (
            usd(equity)
          )
        }
        hint={wallet && mine.length ? `in ${mine.length}` : null}
      />
      <Tile
        label="Your all-time PnL"
        loading={loading && !!wallet}
        value={!wallet ? DASH : usdSigned(pnl)}
        valueClassName={wallet ? tone(pnl) : undefined}
      />
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 border border-outline px-4 py-14 text-center"
    >
      <p className="text-sm text-rock/75">
        {status === 404 ? 'Vaults aren’t live on this gateway yet' : 'Couldn’t load vaults'}
      </p>
      <p className="text-xs text-rock/60">Check your connection and try again.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
