/**
 * Market entity model
 * Defines market-related state and operations
 * Completely refactored to avoid circular dependencies
 */
import { config } from '@/shared/config/constants';
import { tryCatch } from '@/shared/lib/try-catch';
import axios, { AxiosResponse } from 'axios';
import { atom, useAtom } from 'jotai';
import { useCallback, useRef, useMemo } from 'react';

// Market types
export type MarketKind = 'spot' | 'perp';

export interface PerpConfig {
  initial_margin: number;
  maintenance_margin: number;
  liquidation_penalty: number;
  max_leverage_tiers: Array<{
    notional: number;
    max_leverage: number;
  }>;
  funding_interval_seconds: number;
  funding_rate_cap_bps: number;
  funding_interest_rate_bps: number;
  funding_premium_cap_bps: number;
  funding_oracle: string | null;
}

export interface LeverageLimits {
  min: number;
  max: number;
  recommended: number[];
}

/**
 * Get leverage limits from market configuration
 */
export function getLeverageLimitsFromMarket(market: Market): LeverageLimits | null {
  if (market.kind !== 'perp' || !market.perp_config) {
    return null;
  }

  const tiers = market.perp_config.max_leverage_tiers;
  if (!tiers || tiers.length === 0) {
    return null;
  }

  // Sort tiers by notional size ascending
  const sortedTiers = [...tiers].sort((a, b) => a.notional - b.notional);

  // The max leverage is the highest leverage available (typically from the highest tier)
  const maxLeverage = Math.max(...sortedTiers.map(tier => tier.max_leverage));

  // Min leverage is typically 1
  const minLeverage = 1;

  // Recommended leverages - could be based on common values or tier boundaries
  const recommended = [1, 2, 5, 10, 25, 50, 100].filter(l => l <= maxLeverage);

  return {
    min: minLeverage,
    max: maxLeverage,
    recommended,
  };
}

export interface PerpState {
  mark_price: number | null;
  mark_price_timestamp: number | null;
  index_price: number | null;
  index_price_timestamp: number | null;
  last_premium_rate_bps: number | null;
  last_funding_rate_bps: number | null;
  last_funding_timestamp: number | null;
  next_funding_timestamp: number | null;
}

export interface Market {
  uuid: string;
  name: string;
  base_mint: string;
  quote_mint: string;
  created_at: number;
  kind: MarketKind;
  perp_config: PerpConfig | null;
  perp_state: PerpState | null;
  // base_decimals: number;
  // quote_decimals: number;
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
        axios.get(`${config.devnet.apiBaseUrl}/me/markets`)
      );

      if (error) throw error;

      // Extract markets from response
      const newMarkets = data.data || [];

      // Quick hash comparison using market IDs
      const newHash = newMarkets.map((m: Market) => m.uuid).join(',');

      // Only update if markets have actually changed
      if (newHash !== marketsHashRef.current) {
        marketsHashRef.current = newHash;
        setMarkets(newMarkets);
      }

      marketsLoadedRef.current = true;
      return newMarkets;
    } catch {
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
