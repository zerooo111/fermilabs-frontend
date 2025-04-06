/**
 * Market entity model
 * Defines market-related state and operations
 * Completely refactored to avoid circular dependencies
 */
import { tryCatch } from '@/shared/lib/try-catch';
import axios, { AxiosResponse } from 'axios';
import { atom, useAtom } from 'jotai';
import { config } from '@/shared/config/constants';
import { useCallback, useRef, useMemo } from 'react';

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

// Memoized market enhancement to avoid unnecessary object creation
const memoizedEnhanceMarket = (market: Market): EnhancedMarket => {
  if (!market) return null as unknown as EnhancedMarket;

  // Parse the market name to get base and quote token names
  const [baseTokenName, quoteTokenName] = market.name.split('/').map((s: string) => s.trim());

  // Create enhanced market with token names
  return {
    ...market,
    baseTokenName: baseTokenName || 'BASE',
    quoteTokenName: quoteTokenName || 'QUOTE',
  };
};

// Market state atoms - separate atoms for different concerns
export const marketsAtom = atom<Market[]>([]);
export const selectedMarketIdAtom = atom<string | null>(null);

// Derived atom for the selected market object with memoization
export const selectedMarketAtom = atom(get => {
  const marketId = get(selectedMarketIdAtom);
  const markets = get(marketsAtom);

  if (!marketId || markets.length === 0) return null;

  const market = markets.find(m => m.uuid === marketId);
  return market ? memoizedEnhanceMarket(market) : null;
});

/**
 * Hook to manage the selected market
 * This is a simple hook that just manages the selected market ID
 */
export const useSelectedMarket = () => {
  const [selectedMarketId, setSelectedMarketId] = useAtom(selectedMarketIdAtom);
  const [selectedMarket] = useAtom(selectedMarketAtom);
  const [markets, setMarkets] = useAtom(marketsAtom);
  const marketsLoadedRef = useRef(false);
  const marketsHashRef = useRef('');

  // Memoize the market loading function
  const loadMarkets = useCallback(async (): Promise<Market[]> => {
    // Skip if markets are already loaded
    if (marketsLoadedRef.current && markets.length > 0) {
      return markets;
    }

    try {
      const { data, error } = await tryCatch<AxiosResponse<any>>(
        axios.get(`${config.devnet.globalSequencerApiUrl}/markets`)
      );

      if (error) throw error;

      // Extract markets from response
      const newMarkets = data.data.data || [];

      // Quick hash comparison using market IDs
      const newHash = newMarkets.map((m: Market) => m.uuid).join(',');

      // Only update if markets have actually changed
      if (newHash !== marketsHashRef.current) {
        marketsHashRef.current = newHash;
        setMarkets(newMarkets);
      }

      marketsLoadedRef.current = true;
      return newMarkets;
    } catch (error) {
      console.error('Failed to load markets:', error);
      return markets; // Return existing markets on error
    }
  }, [markets, setMarkets]);

  // Memoize the market selection function
  const selectMarket = useCallback(
    (marketOrId: Market | string | null) => {
      if (marketOrId === null) {
        if (selectedMarketId !== null) {
          setSelectedMarketId(null);
        }
        return;
      }

      const marketId = typeof marketOrId === 'string' ? marketOrId : marketOrId.uuid;

      // Only update if the market ID has changed
      if (marketId !== selectedMarketId) {
        setSelectedMarketId(marketId);
      }
    },
    [selectedMarketId, setSelectedMarketId]
  );

  // Memoize the return object to prevent unnecessary rerenders
  return useMemo(
    () => ({
      selectedMarket,
      selectedMarketId,
      selectMarket,
      loadMarkets,
    }),
    [selectedMarket, selectedMarketId, selectMarket, loadMarkets]
  );
};

// Export market model
export const MarketModel = {
  useSelectedMarket,
  enhanceMarket: memoizedEnhanceMarket,
};
