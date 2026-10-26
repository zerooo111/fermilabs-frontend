/**
 * Vault queries. Gateway vaults read its synced copy of chain state; the FLP
 * vaults read the FLP data API (see `flpSource`). The connected wallet's
 * position comes back inline (`user`) when a wallet is connected.
 */
import { useMemo } from 'react';
import { useInfiniteQuery, useQueries, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

import { FLP_VAULTS, devOwner, flpVaultQuery } from '@/features/flp-vault';

import {
  fetchVault,
  fetchVaultActivity,
  fetchVaultDaily,
  fetchVaultDepositors,
  fetchVaultHistory,
  fetchVaults,
  type Vault,
  type VaultList,
  type VaultNetwork,
  type VaultWindow,
} from '../api/vaultsClient';
import { flpToVault, isFlpVault } from './flpSource';

const REFRESH_MS = 30_000;
export const ACTIVITY_PAGE = 25;

/** Prefix of every vault query, for invalidation after a deposit or withdrawal. */
export const vaultsKey = ['vaults'] as const;

/** Don't hammer a 4xx (bad address, endpoint not deployed); retry network/5xx once. */
function retry(failures: number, err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status && status >= 400 && status < 500) return false;
  }
  return failures < 1;
}

/** The connected wallet, or in dev the `?flpOwner=` wallet being viewed read-only. */
export function useWalletAddress(): string | undefined {
  return useWallet().publicKey?.toBase58() ?? devOwner() ?? undefined;
}

/** Every vault: the FLP vaults from the data API, plus whatever the gateway lists. */
export function useVaults(window: VaultWindow) {
  const wallet = useWalletAddress();
  const gateway = useQuery({
    queryKey: [...vaultsKey, 'list', window, wallet ?? null],
    queryFn: ({ signal }) => fetchVaults({ window, wallet }, signal),
    refetchInterval: REFRESH_MS,
    // Keep the last list while a new window loads, but never across wallets.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[3] === (wallet ?? null) ? prev : undefined,
    retry,
  });
  const flp = useQueries({
    queries: FLP_VAULTS.map(c => ({
      ...flpVaultQuery(c.address.toBase58(), wallet ?? null),
      // The wallet-less read stands in while this wallet's loads; flpToVault
      // drops its user, so the tiles show loading rather than nobody's position.
      placeholderData: keepPreviousData,
    })),
    combine: results => ({
      envelopes: results.map(r => r.data),
      pending: results.some(r => r.isPending),
      failed: results.filter(r => r.isError).length,
      error: results.find(r => r.isError)?.error ?? null,
      refetch: () => results.forEach(r => void r.refetch()),
    }),
  });

  const data = useMemo((): VaultList | undefined => {
    const synced = new Map((gateway.data?.vaults ?? []).map(v => [`${v.network}:${v.address}`, v]));
    const own: Vault[] = flp.envelopes.flatMap((env, i) =>
      env
        ? [
            withHistory(
              flpToVault(FLP_VAULTS[i], env, window, wallet),
              synced.get(key(FLP_VAULTS[i]))
            ),
          ]
        : []
    );
    const mine = new Set(own.map(v => `${v.network}:${v.address}`));
    const vaults = [
      ...own,
      ...[...synced.values()].filter(v => !mine.has(`${v.network}:${v.address}`)),
    ];
    if (!vaults.length && (flp.pending || gateway.isPending)) return undefined;
    const totals = (['mainnet', 'devnet'] as const).flatMap(network => {
      const of = vaults.filter(v => v.network === network);
      if (!of.length) return [];
      // A total over a vault that can't be valued is itself unknown.
      const tvl = of.some(v => v.tvl === null) ? null : of.reduce((a, v) => a + (v.tvl ?? 0), 0);
      return [{ network, vaults: of.length, tvl }];
    });
    return {
      window,
      network: 'all',
      updated_at_ms: Math.max(gateway.data?.updated_at_ms ?? 0, ...own.map(v => v.synced_at_ms)),
      totals,
      total: vaults.length,
      vaults,
    };
  }, [flp.envelopes, flp.pending, gateway.data, gateway.isPending, window, wallet]);

  const failed = flp.failed === FLP_VAULTS.length && gateway.isError;
  return {
    data,
    isPending: !data && !failed,
    isError: failed && !data?.vaults.length,
    /** FLP vaults that couldn't be read; the list shows the rest. */
    missing: flp.failed,
    error: flp.error ?? gateway.error,
    refetch: () => {
      void gateway.refetch();
      flp.refetch();
    },
  };
}

export function useVault(network: VaultNetwork, address: string, window: VaultWindow) {
  const wallet = useWalletAddress();
  const flpConfig = isFlpVault(network, address);
  const gateway = useQuery({
    queryKey: [...vaultsKey, 'detail', network, address, window, wallet ?? null],
    queryFn: ({ signal }) => fetchVault(network, address, { window, wallet }, signal),
    refetchInterval: REFRESH_MS,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[6] === (wallet ?? null) ? prev : undefined,
    retry,
  });
  const flp = useQuery({
    ...flpVaultQuery(address, wallet ?? null),
    placeholderData: keepPreviousData,
    enabled: !!flpConfig,
  });
  const env = flp.data;
  const synced = gateway.data;
  const data = useMemo(
    () =>
      flpConfig && env
        ? withHistory(flpToVault(flpConfig, env, window, wallet), synced)
        : undefined,
    [flpConfig, env, window, wallet, synced]
  );
  if (!flpConfig) return gateway;
  return { data, isError: flp.isError && !env, error: flp.error, refetch: flp.refetch };
}

const key = (c: { address: { toBase58(): string } }) => `devnet:${c.address.toBase58()}`;

/**
 * An FLP vault's live state with the gateway's history-derived numbers (APR,
 * window return, sparkline), when the gateway has synced it.
 */
function withHistory(v: Vault, synced: Vault | undefined): Vault {
  if (!synced) return v;
  return {
    ...v,
    apr: synced.apr,
    window_return: synced.window_return,
    sparkline: synced.sparkline,
  };
}

export function useVaultHistory(network: VaultNetwork, address: string, window: VaultWindow) {
  return useQuery({
    queryKey: [...vaultsKey, 'history', network, address, window],
    queryFn: ({ signal }) => fetchVaultHistory(network, address, window, signal),
    refetchInterval: REFRESH_MS * 2,
    placeholderData: keepPreviousData,
    retry,
  });
}

/** Daily P&L rows; empty for vaults the gateway has no data API for. */
export function useVaultDaily(
  network: VaultNetwork,
  address: string,
  window: VaultWindow,
  enabled = true
) {
  return useQuery({
    queryKey: [...vaultsKey, 'daily', network, address, window],
    queryFn: ({ signal }) => fetchVaultDaily(network, address, window, signal),
    enabled,
    refetchInterval: REFRESH_MS * 2,
    placeholderData: keepPreviousData,
    retry,
  });
}

export function useVaultDepositors(
  network: VaultNetwork,
  address: string,
  page: number,
  size: number
) {
  return useQuery({
    queryKey: [...vaultsKey, 'depositors', network, address, page, size],
    queryFn: ({ signal }) =>
      fetchVaultDepositors(network, address, { limit: size, offset: page * size }, signal),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    retry,
  });
}

export function useVaultActivity(network: VaultNetwork, address: string, wallet?: string) {
  return useInfiniteQuery({
    queryKey: [...vaultsKey, 'activity', network, address, wallet ?? null],
    queryFn: ({ pageParam, signal }) =>
      fetchVaultActivity(
        network,
        address,
        { wallet, before: pageParam ?? undefined, limit: ACTIVITY_PAGE },
        signal
      ),
    initialPageParam: null as number | null,
    getNextPageParam: last => last.next_before,
    refetchInterval: REFRESH_MS,
    retry,
  });
}
