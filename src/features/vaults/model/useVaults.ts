/**
 * Vault queries. Everything reads the gateway's synced copy of chain state;
 * the connected wallet's position comes back inline (`user`) when a wallet is
 * connected. The gateway syncs every ~30s, so data refetches on that rhythm.
 */
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

import {
  fetchVault,
  fetchVaultActivity,
  fetchVaultDepositors,
  fetchVaultHistory,
  fetchVaults,
  type VaultNetwork,
  type VaultWindow,
} from '../api/vaultsClient';

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

export function useVaults(window: VaultWindow) {
  const wallet = useWalletAddress();
  return useQuery({
    queryKey: [...vaultsKey, 'list', window, wallet ?? null],
    queryFn: ({ signal }) => fetchVaults({ window, wallet }, signal),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    retry,
  });
}

export function useVault(network: VaultNetwork, address: string, window: VaultWindow) {
  const wallet = useWalletAddress();
  return useQuery({
    queryKey: [...vaultsKey, 'detail', network, address, window, wallet ?? null],
    queryFn: ({ signal }) => fetchVault(network, address, { window, wallet }, signal),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    retry,
  });
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
