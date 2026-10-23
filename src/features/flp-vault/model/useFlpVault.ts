/**
 * FLP reads for one vault. Display data (phase, epoch, NAV, portfolio, the
 * user's tickets) comes from the data API in one request; wallet balances come
 * from one RPC call. Account subscriptions on the vault and the Depositor
 * invalidate both, so the view follows the chain between polls.
 */
import { useEffect, useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import { deriveDepositor } from '../sdk';
import { fetchOrders, fetchVaultData, type FlpEnvelope, type FlpOrder } from './api';
import { COMMITMENT, getFlp, readWallet } from './chain';
import { FLP_PROGRAM_ID } from './config';

export const flpKeys = {
  all: ['flp'] as const,
  data: (vault: string, owner: string | null) => ['flp', 'data', vault, owner ?? ''] as const,
  wallet: (vault: string, owner: string) => ['flp', 'wallet', vault, owner] as const,
  orders: (vault: string, market: number) => ['flp', 'orders', vault, market] as const,
};

// The API caches each response for 3 s; a refetch sooner gets the same body.
const API_CACHE_MS = 3_500;

export function useFlpVault(vault: PublicKey) {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;
  const vaultKey = vault.toBase58();

  const data = useQuery({
    queryKey: flpKeys.data(vaultKey, owner),
    queryFn: () => fetchVaultData(vaultKey, owner),
    // A stale copy means a refresh is running on the harness: ask again soon.
    refetchInterval: query => (query.state.data?.cache?.stale ? 3_000 : 10_000),
    // An uncached read can take many seconds. Keep showing the vault while a
    // new wallet's view loads; callers check `envelope.owner` for user data.
    placeholderData: prev => (prev?.vault === vaultKey ? prev : undefined),
    retry: 2,
    retryDelay: 5_000,
  });

  const units = data.data?.data.units;
  const wallet = useQuery({
    queryKey: flpKeys.wallet(vaultKey, owner ?? ''),
    queryFn: () =>
      readWallet(publicKey!, new PublicKey(units!.quoteMint), new PublicKey(units!.shareMint)),
    enabled: !!owner && !!units,
    refetchInterval: 15_000,
  });

  const quoteAta = wallet.data?.quoteAta.toBase58();
  const shareAta = wallet.data?.shareAta.toBase58();
  useEffect(() => {
    const { connection } = getFlp();
    const timers: number[] = [];
    const refreshData = () =>
      timers.push(
        window.setTimeout(
          () => queryClient.invalidateQueries({ queryKey: ['flp', 'data', vaultKey] }),
          API_CACHE_MS
        )
      );
    const refreshWallet = () =>
      queryClient.invalidateQueries({ queryKey: flpKeys.wallet(vaultKey, owner ?? '') });

    const watched: Array<[PublicKey, () => void]> = [[vault, refreshData]];
    if (publicKey) {
      watched.push([deriveDepositor(FLP_PROGRAM_ID, vault, publicKey), refreshData]);
      if (quoteAta) watched.push([new PublicKey(quoteAta), refreshWallet]);
      if (shareAta) watched.push([new PublicKey(shareAta), refreshWallet]);
    }
    const ids = watched.map(([account, cb]) => connection.onAccountChange(account, cb, COMMITMENT));
    return () => {
      timers.forEach(t => window.clearTimeout(t));
      ids.forEach(id => void connection.removeAccountChangeListener(id));
    };
  }, [vault, vaultKey, publicKey, owner, quoteAta, shareAta, queryClient]);

  const envelope: FlpEnvelope | undefined = data.data;
  // Placeholder data from another wallet carries no user for this one.
  const user = envelope && envelope.owner === owner ? envelope.data.user : undefined;
  const userLoading = !!owner && (!envelope || envelope.owner !== owner);

  return { data, envelope, user, userLoading, wallet, owner };
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

/** Warm every listed vault, so switching between them doesn't wait on a fresh read. */
export function usePrefetchFlpVaults(vaults: readonly PublicKey[]) {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;
  const keys = vaults.map(v => v.toBase58()).join(',');
  useEffect(() => {
    for (const vault of keys.split(',')) {
      void queryClient.prefetchQuery({
        queryKey: flpKeys.data(vault, owner),
        queryFn: () => fetchVaultData(vault, owner),
        staleTime: 10_000,
      });
    }
  }, [keys, owner, queryClient]);
}
