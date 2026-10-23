/**
 * FLP vault: phase, totals, share price and epoch timing; the deposit /
 * withdraw form and the wallet's open requests; the vault's positions,
 * orders and health; and its accounting, parameters and addresses. Reads
 * come from the FLP data API, transactions go straight to the FLP cluster.
 */
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { ConnectWallet } from '@/features/wallet-connect';
import { Button } from '@/shared/ui/button';

import type { FlpEnvelope } from '../model/api';
import { FLP_CLUSTER, type FlpVaultConfig } from '../model/config';
import {
  describeFlpError,
  formatDuration,
  formatPrice,
  formatUnits,
  MODE_LABEL,
} from '../model/format';
import { useFlpVault } from '../model/useFlpVault';
import { sharesValue, vaultView } from '../model/view';
import { ActionForm } from './ActionForm';
import { DevnetTools, PositionPanel, VaultDetails } from './Panels';
import { Portfolio } from './Portfolio';
import { Requests } from './Requests';
import { Bone, Dash, NotAvailable, Panel, Tile } from './primitives';
import { useNow } from '../model/useNow';

export function FlpVault({ config }: { config: FlpVaultConfig }) {
  const vault = config.address;
  const { data, envelope, user, userLoading, wallet, owner } = useFlpVault(vault);

  if (data.isError && !envelope) {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-3 px-4 py-6">
          <p className="text-sm text-danger">Couldn&apos;t read the vault on {FLP_CLUSTER}.</p>
          <p className="font-mono text-[11px] text-rock/45">{describeFlpError(data.error)}</p>
          <Button variant="outline" size="sm" onClick={() => data.refetch()}>
            Retry
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Tiles
        envelope={envelope}
        shares={user ? BigInt(user.investedSharesIncludingOwedAndUnfunded) : null}
        owner={owner}
        userLoading={userLoading}
      />
      {envelope && <Freshness envelope={envelope} />}
      {envelope && <StatusNotice envelope={envelope} />}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="space-y-5">
          <Panel>
            {!envelope ? (
              <div className="space-y-3 p-4">
                <Bone className="h-8 w-48" />
                <Bone className="h-9 w-full" />
                <Bone className="h-9 w-full" />
                <SlowNote />
              </div>
            ) : !owner ? (
              <div className="flex flex-col items-start gap-3 px-4 py-6">
                <p className="text-sm text-rock/60">Connect a wallet to deposit.</p>
                <ConnectWallet />
              </div>
            ) : (
              <ActionForm
                key={vault.toBase58()}
                vault={vault}
                envelope={envelope}
                user={userLoading ? undefined : user}
                wallet={wallet.data}
              />
            )}
          </Panel>
          {envelope && user && <Requests vault={vault} envelope={envelope} user={user} />}
        </div>
        <div className="space-y-5">
          {owner && (
            <PositionPanel
              envelope={envelope}
              user={user}
              userLoading={userLoading}
              wallet={wallet.data}
            />
          )}
          {owner && <DevnetTools config={config} owner={owner} user={user} envelope={envelope} />}
        </div>
      </div>

      <Portfolio vault={vault} envelope={envelope} />
      <VaultDetails vault={vault} envelope={envelope} />
    </div>
  );
}

function Tiles({
  envelope,
  shares,
  owner,
  userLoading,
}: {
  envelope?: FlpEnvelope;
  shares: bigint | null;
  owner: string | null;
  userLoading: boolean;
}) {
  const now = useNow();
  const loading = !envelope;
  const v = envelope ? vaultView(envelope) : null;
  const q = (n: bigint, f = 2) => (v ? formatUnits(n, v.quoteDecimals, f) : '');

  let epochValue = <Dash />;
  let epochHint: string | null = null;
  if (v) {
    const left = v.epoch.scheduledEnd - now;
    epochValue = <>#{v.epoch.current.toString()}</>;
    epochHint =
      left > 0
        ? now < v.epoch.cutoffAt
          ? `ends in ${formatDuration(left)}`
          : `past cutoff, ends in ${formatDuration(left)}`
        : 'closing';
  }

  return (
    <div className="grid grid-cols-2 divide-outline border border-outline max-lg:[&>*]:border-b max-lg:[&>*]:border-outline lg:grid-cols-5 lg:divide-x">
      <Tile
        label="Phase"
        loading={loading}
        value={v ? MODE_LABEL[v.mode] : <Dash />}
        hint={
          v?.mode === 'pre-deposit' ? 'before graduation' : v?.mode === 'live' ? 'trading' : null
        }
        accent={v?.mode === 'pre-deposit'}
      />
      <Tile
        label="TVL"
        loading={loading}
        value={
          v ? v.tvl === null ? <NotAvailable reason="Portfolio read failed" /> : q(v.tvl) : <Dash />
        }
        hint={v ? `of ${q(v.tvlCap, 0)} shared cap` : null}
      />
      <Tile
        label="Share price"
        loading={loading}
        value={v ? formatPrice(v.price, 6) : <Dash />}
        hint={v ? 'USDC, at last close' : null}
      />
      <Tile label="Epoch" loading={loading} value={epochValue} hint={epochHint} />
      <Tile
        label="Your shares"
        loading={!!owner && (loading || userLoading)}
        value={
          !owner ? (
            <span className="text-base font-normal text-rock/45">Connect wallet</span>
          ) : v && shares !== null ? (
            formatUnits(shares, v.shareDecimals, 2)
          ) : v ? (
            '0'
          ) : (
            <Dash />
          )
        }
        hint={owner && v && shares ? `≈ ${q(sharesValue(v, shares))} USDC` : owner ? 'FLP' : null}
      />
    </div>
  );
}

/** How old the shown data is: the harness can serve a copy minutes old while it refreshes. */
function Freshness({ envelope }: { envelope: FlpEnvelope }) {
  const now = useNow();
  const age = Math.max(0, now - Math.floor(envelope.generated_ts_ms / 1000));
  const old = age > 30;
  return (
    <p
      className={cn(
        '-mt-3 px-1 text-right font-mono text-[11px] tabular-nums',
        old ? 'text-amber-200' : 'text-rock/35'
      )}
    >
      {envelope.cache?.refreshing && old ? 'Refreshing · ' : ''}
      Updated {formatDuration(age)} ago · slot {envelope.source.slot}
    </p>
  );
}

/** The devnet data API can take 15–40 s on an uncached read; say so after a few seconds. */
function SlowNote() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 4_000);
    return () => window.clearTimeout(id);
  }, []);
  if (!shown) return null;
  return (
    <p className="text-xs text-rock/45">
      Reading the vault from the {FLP_CLUSTER} data API. A fresh read can take up to 40 seconds.
    </p>
  );
}

/** Pauses, the breaker and recovery: say so above the form. */
function StatusNotice({ envelope }: { envelope: FlpEnvelope }) {
  const l = envelope.data.lifecycle;
  const notes: string[] = [];
  if (l.breaker) notes.push('The circuit breaker is tripped: deposits are closed.');
  else if (l.depositsPaused) notes.push('Deposits are paused.');
  else if (l.publicDepositsPaused)
    notes.push('Public deposits are paused. Approved wallets can still deposit directly.');
  if (l.withdrawalsPaused)
    notes.push('Trading withdrawals are paused. Pre-deposit refunds and claims still work.');
  if (l.mode === 'unwind')
    notes.push(
      'The vault is unwinding positions. New requests wait; pending deposits can be refunded.'
    );
  if (l.mode === 'closed')
    notes.push('The vault is closed. Redeem shares at the fixed closing ratio.');
  if (!notes.length) return null;
  return (
    <div className="border border-amber-200/40 bg-amber-200/5 px-4 py-2.5 text-xs text-amber-200">
      {notes.join(' ')}
    </div>
  );
}
