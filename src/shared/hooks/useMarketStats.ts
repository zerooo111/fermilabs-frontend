/**
 * useMarketStats hook
 * Fetches market statistics from the API using react-query
 */
import { useQuery } from '@tanstack/react-query';
import axios, { AxiosResponse } from 'axios';
import { API_ROUTES, config } from '@/shared/config/constants';
import { tryCatch } from '@/shared/lib/try-catch';
import type { Market } from '@/entities/market';

export interface MarketStatsResponse {
  markets: Market[];
}

export interface UseMarketStatsOptions {
  refetchInterval?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch market statistics from the API
 * @param options - Query options
 * @returns React Query result with markets data
 */
export function useMarketStats(options: UseMarketStatsOptions = {}) {
  const { refetchInterval = 5000, enabled = true } = options;

  return useQuery({
    queryKey: ['marketStats'],
    queryFn: async (): Promise<Market[]> => {
      const apiBaseUrl = config.devnet.apiBaseUrl;
      const url = `${apiBaseUrl}${API_ROUTES.markets}`;

      const { data, error } = await tryCatch<AxiosResponse<Market[]>>(axios.get(url));

      if (error) {
        throw error;
      }

      return data.data || [];
    },
    refetchInterval,
    refetchIntervalInBackground: false,
    enabled,
    staleTime: 3000,
  });
}
