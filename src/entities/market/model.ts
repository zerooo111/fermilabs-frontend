/**
 * Market entity model
 * Defines market-related state and operations
 * Completely refactored to avoid circular dependencies
 */
import { tryCatch } from '@/shared/lib/try-catch';
import axios, { AxiosResponse } from 'axios';
import { atom, useAtom } from 'jotai';
import { config } from '@/shared/config/constants';
import { useCallback } from 'react';

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

// Enhanced market type with parsed token names
export interface EnhancedMarket extends Market {
  baseTokenName: string;
  quoteTokenName: string;
}

// Helper function to enhance a market with token names
export function enhanceMarket(market: Market): EnhancedMarket {
  if (!market) return null as unknown as EnhancedMarket;

  // Parse the market name to get base and quote token names
  const [baseTokenName, quoteTokenName] = market.name.split('/').map((s: string) => s.trim());

  // Create enhanced market with token names
  return {
    ...market,
    baseTokenName: baseTokenName || 'BASE',
    quoteTokenName: quoteTokenName || 'QUOTE',
  };
}

// Market state atoms - separate atoms for different concerns
export const marketsAtom = atom<Market[]>([]);
export const selectedMarketIdAtom = atom<string | null>(null);

// Derived atom for the selected market object
export const selectedMarketAtom = atom(get => {
  const marketId = get(selectedMarketIdAtom);
  const markets = get(marketsAtom);

  if (!marketId || markets.length === 0) return null;

  const market = markets.find(m => m.uuid === marketId);
  return market ? enhanceMarket(market) : null;
});

/**
 * Hook to manage the selected market
 * This is a simple hook that just manages the selected market ID
 */
export const useSelectedMarket = () => {
  const [selectedMarketId, setSelectedMarketId] = useAtom(selectedMarketIdAtom);
  const [selectedMarket] = useAtom(selectedMarketAtom);
  const [markets, setMarkets] = useAtom(marketsAtom);

  console.log('[useSelectedMarket] Current state:', {
    selectedMarketId,
    hasSelectedMarket: !!selectedMarket,
    marketsCount: markets.length,
  });

  const loadMarkets = useCallback(async (): Promise<Market[]> => {
    const { data, error } = await tryCatch<AxiosResponse<any>>(
      axios.get(`${config.devnet.globalSequencerApiUrl}/markets`)
    );

    if (error) {
      throw error;
    }

    // Extract and return the array of markets
    const markets = data.data.data || [];

    setMarkets(markets);

    return markets;
  }, [setMarkets]);

  // Function to set a market by its ID
  const selectMarket = useCallback(
    (marketOrId: Market | string | null) => {
      if (marketOrId === null) {
        console.log('[useSelectedMarket] Clearing selected market');
        setSelectedMarketId(null);
        return;
      }

      const marketId = typeof marketOrId === 'string' ? marketOrId : marketOrId.uuid;
      console.log('[useSelectedMarket] Selecting market by ID:', marketId);
      setSelectedMarketId(marketId);
    },
    [setSelectedMarketId]
  );

  return {
    selectedMarket,
    selectedMarketId,
    selectMarket,
    loadMarkets,
  };
};

// Export market model
export const MarketModel = {
  useSelectedMarket,
  enhanceMarket,
};
