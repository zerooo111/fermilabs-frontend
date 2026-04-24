/**
 * useMarketStats hook
 * Reads market statistics from SSE-populated atoms.
 * Options param is accepted for backward compat but ignored (SSE is always on).
 */
import { useAtomValue } from 'jotai';
import { marketsAtom } from '@/entities/market';
import type { Market } from '@/entities/market';

export interface MarketStatsResponse {
  markets: Market[];
}

export interface UseMarketStatsOptions {
  refetchInterval?: number;
  enabled?: boolean;
}

export function useMarketStats(_options?: UseMarketStatsOptions) {
  const markets = useAtomValue(marketsAtom);
  return {
    data: markets.length > 0 ? markets : undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: async () => ({ data: markets }),
  };
}
