/**
 * FLP reads for one vault. Display data (phase, epoch, NAV, portfolio, the
 * user's tickets) comes from the data API in one request; wallet balances come
 * from one RPC call. `useFlpLiveUpdates` (mounted once per page) follows the
 * chain between polls.
 *
 * The data API serves stale copies while it refreshes (`cache.stale`), so
 * reads older than the user's last confirmed transaction are flagged
 * `syncing` and re-polled quickly.
 */
import { useEffect, useMemo } from 'react';
import { queryOptions, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import { deriveDepositor } from '../sdk';
import { fetchOrders, fetchVaultData, type FlpEnvelope, type FlpOrder } from './api';
import { COMMITMENT, getFlp, readWallet, walletAtas } from './chain';
import { FLP_PROGRAM_ID } from './config';
import { devOwner } from './devOwner';
import { API_CACHE_MS, flpKeys } from './keys';
import { getTxState, setTxState, useTxState } from './txStore';

export { flpKeys };

/** The read predates the user's last confirmed transaction on this vault. */
function behindLastTx(vault: string, env: FlpEnvelope | undefined): boolean {
  const min = getTxState(vault).minSlot;
  return !!env && min !== null && Number(env.source.slot) < min;
}

/** The data API read for one vault (and wallet), shared by every view of it. */
export function flpVaultQuery(vault: string, owner: string | null) {
  return queryOptions({
    queryKey: flpKeys.data(vault, owner),
    queryFn: () => fetchVaultData(vault, owner),
    // Behind the user's last transaction, or a stale copy whose refresh is
    // running on the harness: ask again soon.
    refetchInterval: query =>
      behindLastTx(vault, query.state.data)
        ? 2_000
        : query.state.data?.cache?.stale
          ? 3_000
          : 10_000,
    retry: 2,
    retryDelay: 5_000,
  });
}

export function useFlpVault(vault: PublicKey) {
  const { publicKey } = useWallet();
  const viewAs = publicKey ? null : devOwner();
  const owner = publicKey?.toBase58() ?? viewAs;
  const vaultKey = vault.toBase58();
  const tx = useTxState(vaultKey);

  const data = useQuery({
    ...flpVaultQuery(vaultKey, owner),
    // An uncached read can take many seconds. Keep showing the vault while a
    // new wallet's view loads; `user` below is only ever this wallet's.
    placeholderData: prev => (prev?.vault === vaultKey ? prev : undefined),
  });

  const units = data.data?.data.units;
  const wallet = useQuery({
    queryKey: flpKeys.wallet(vaultKey, owner ?? ''),
    queryFn: () =>
      readWallet(
        new PublicKey(owner!),
        new PublicKey(units!.quoteMint),
        new PublicKey(units!.shareMint)
      ),
    enabled: !!owner && !!units,
    refetchInterval: 15_000,
  });

  const envelope: FlpEnvelope | undefined = data.data;
  const syncing = tx.minSlot !== null && behindLastTx(vaultKey, envelope);
  // Caught up: the next transaction sets a new floor.
  useEffect(() => {
    if (tx.minSlot !== null && envelope && !syncing) setTxState(vaultKey, { minSlot: null });
  }, [tx.minSlot, envelope, syncing, vaultKey]);

  // Placeholder data from another wallet carries no user for this one.
  const user = envelope && envelope.owner === owner ? envelope.data.user : undefined;
  const userLoading = !!owner && (!envelope || envelope.owner !== owner);

  /** `?flpOwner=` dev view: another wallet's data, nothing can be signed. */
  const readOnly = !!viewAs;
  return { data, envelope, user, userLoading, wallet, owner, syncing, readOnly };
}

/**
 * Account subscriptions for one vault page: the vault and the wallet's
 * Depositor refresh the data API read, the wallet's token accounts refresh
 * balances. Mount once per page; every view shares the queries.
 */
export function useFlpLiveUpdates(vault: PublicKey) {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const vaultKey = vault.toBase58();
  const units = useQuery({
    ...flpVaultQuery(vaultKey, publicKey?.toBase58() ?? null),
    enabled: false,
  }).data?.data.units;
  const quoteMint = units?.quoteMint;
  const shareMint = units?.shareMint;

  useEffect(() => {
    const { connection } = getFlp();
    const timers: number[] = [];
    // Don't cancel a slow read in flight: let it land, then read again.
    const refreshData = () => {
      timers.push(
        window.setTimeout(
          () =>
            queryClient.invalidateQueries(
              { queryKey: flpKeys.dataAll(vaultKey) },
              { cancelRefetch: false }
            ),
          API_CACHE_MS
        )
      );
    };
    const refreshWallet = () => {
      void queryClient.invalidateQueries({ queryKey: flpKeys.walletAll(vaultKey) });
    };

    const watched: Array<[PublicKey, () => void]> = [[vault, refreshData]];
    if (publicKey) {
      watched.push([deriveDepositor(FLP_PROGRAM_ID, vault, publicKey), refreshData]);
      if (quoteMint && shareMint) {
        const { quoteAta, shareAta } = walletAtas(
          publicKey,
          new PublicKey(quoteMint),
          new PublicKey(shareMint)
        );
        watched.push([quoteAta, refreshWallet], [shareAta, refreshWallet]);
      }
    }
    const ids = watched.map(([account, cb]) => connection.onAccountChange(account, cb, COMMITMENT));
    return () => {
      timers.forEach(t => window.clearTimeout(t));
      ids.forEach(id => void connection.removeAccountChangeListener(id));
    };
  }, [vault, vaultKey, publicKey, quoteMint, shareMint, queryClient]);
}

/** Price and size of the vault's resting orders, for markets where it has any. */
export function useFlpOrders(vault: PublicKey, envelope: FlpEnvelope | undefined) {
  const vaultKey = vault.toBase58();
  const authority = useMemo(() => getFlp().client.authority(vault).toBase58(), [vault]);
  const portfolio = envelope?.data.portfolio;
  const markets =
    portfolio && 'positions' in portfolio
      ? portfolio.positions
          .filter(p => p.bidsBaseLots !== '0' || p.asksBaseLots !== '0')
          .map(p => p.marketIndex)
      : [];

  return useQueries({
    queries: markets.map(market => ({
      queryKey: flpKeys.orders(vaultKey, market),
      queryFn: () => fetchOrders(market, authority),
      refetchInterval: 15_000,
    })),
    combine: results => ({
      orders: results.flatMap((r, i) =>
        (r.data ?? []).map((o: FlpOrder) => ({ ...o, marketIndex: markets[i] }))
      ),
      loading: results.some(r => r.isPending),
    }),
  });
}
