/**
 * Market entity model
 * Defines market-related state and operations
 */
import { atom, useAtom } from 'jotai';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelectedServer } from '@/entities/server';

// Market types
export interface Market {
  uuid: string;
  name: string;
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: number;
  quote_lot_size: number;
  [key: string]: any;
}

// Market state atoms
export const marketsAtom = atom<Market[]>([]);
export const selectedMarketAtom = atom<Market | null>(null);

// Market hooks
export const useMarkets = () => {
  const [markets, setMarkets] = useAtom(marketsAtom);
  const { getMarkets } = useSequencerApi();
  const { selectedServer } = useSelectedServer();
  const queryClient = useQueryClient();

  // Create a wrapper function that matches the expected return type
  const fetchMarketsWrapper = useCallback(async () => {
    const marketsData = await getMarkets();
    return marketsData;
  }, [getMarkets]);

  // Use React Query to fetch and cache markets data
  const { data, isLoading, error } = useQuery<Market[]>({
    queryKey: ['markets', selectedServer.url],
    queryFn: fetchMarketsWrapper,
    staleTime: Infinity, // Don't mark as stale automatically
  });

  // Update Jotai state when data changes
  useEffect(() => {
    if (data) {
      setMarkets(data);
    }
  }, [data, setMarkets]);

  // Manual fetch function that can be called when needed
  const fetchMarkets = useCallback(async () => {
    const result = await queryClient.fetchQuery<Market[]>({
      queryKey: ['markets', selectedServer.url],
      queryFn: fetchMarketsWrapper,
    });
    if (result) {
      setMarkets(result);
    }
    return result;
  }, [fetchMarketsWrapper, queryClient, selectedServer.url, setMarkets]);

  return {
    markets,
    setMarkets,
    fetchMarkets,
    isLoading,
    error,
  };
};

export const useSelectedMarket = () => {
  const [selectedMarket, setSelectedMarket] = useAtom(selectedMarketAtom);
  const { markets } = useMarkets();

  const selectMarketById = useCallback(
    (marketId: string) => {
      const market = markets.find(m => m.uuid === marketId);
      if (market) {
        setSelectedMarket(market);
      }
      return market;
    },
    [markets, setSelectedMarket]
  );

  return {
    selectedMarket,
    setSelectedMarket,
    selectMarketById,
  };
};

// Export market model
export const MarketModel = {
  useMarkets,
  useSelectedMarket,
};
