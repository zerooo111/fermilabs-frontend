/**
 * Vault queries. Gateway vaults read its synced copy of chain state; the FLP
 * vaults read the FLP data API (see `flpSource`). The connected wallet's
 * position comes back inline (`user`) when a wallet is connected.
 */
import { useMemo } from 'react';
import { useInfiniteQuery, useQueries, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

import { FLP_VAULTS, flpVaultQuery } from '@/features/flp-vault';

import {
  fetchVault,
  fetchVaultActivity,
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

export function useWalletAddress(): string | undefined {
  return useWallet().publicKey?.toBase58();
}

/** Every vault: the FLP vaults from the data API, plus whatever the gateway lists. */
export function useVaults(window: VaultWindow) {
  const wallet = useWalletAddress();
  const gateway = useQuery({
    queryKey: [...vaultsKey, 'list', window, wallet ?? null],
    queryFn: ({ signal }) => fetchVaults({ window, wallet }, signal),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    retry,
  });
  const flp = useQueries({
    queries: FLP_VAULTS.map(c => ({
      ...flpVaultQuery(c.address.toBase58(), wallet ?? null),
      placeholderData: keepPreviousData,
    })),
  });

  const flpData = flp.map(r => r.data);
  const data = useMemo((): VaultList | undefined => {
    const own: Vault[] = flpData.flatMap((env, i) =>
      env ? [flpToVault(FLP_VAULTS[i], env, window)] : []
    );
    const mine = new Set(own.map(v => `${v.network}:${v.address}`));
    const vaults = [
      ...own,
      ...(gateway.data?.vaults ?? []).filter(v => !mine.has(`${v.network}:${v.address}`)),
    ];
    if (!vaults.length && (gateway.isPending || flp.some(r => r.isPending))) return undefined;
    const totals = (['mainnet', 'devnet'] as const).flatMap(network => {
      const of = vaults.filter(v => v.network === network);
      return of.length
        ? [{ network, vaults: of.length, tvl: of.reduce((a, v) => a + v.tvl, 0) }]
        : [];
    });
    return {
      window,
      network: 'all',
      updated_at_ms: Math.max(gateway.data?.updated_at_ms ?? 0, ...own.map(v => v.synced_at_ms)),
      totals,
      total: vaults.length,
      vaults,
    };
    // flpData changes identity every render; its entries are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...flpData, gateway.data, gateway.isPending, window]);

  const allFailed = gateway.isError && flp.every(r => r.isError);
  return {
    data,
    isPending: !data,
    isError: allFailed && !data,
    error: gateway.error,
    refetch: () => {
      void gateway.refetch();
      flp.forEach(r => void r.refetch());
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
    placeholderData: keepPreviousData,
    retry,
    enabled: !flpConfig,
  });
  const flp = useQuery({
    ...flpVaultQuery(address, wallet ?? null),
    placeholderData: keepPreviousData,
    enabled: !!flpConfig,
  });
  const env = flp.data;
  const data = useMemo(
    () => (flpConfig && env ? flpToVault(flpConfig, env, window) : undefined),
    [flpConfig, env, window]
  );
  if (!flpConfig) return gateway;
  return { data, isError: flp.isError && !env, error: flp.error, refetch: flp.refetch };
}

export function useVaultHistory(
  network: VaultNetwork,
  address: string,
  window: VaultWindow,
  enabled = true
) {
  return useQuery({
    enabled,
    queryKey: [...vaultsKey, 'history', network, address, window],
    queryFn: ({ signal }) => fetchVaultHistory(network, address, window, signal),
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
