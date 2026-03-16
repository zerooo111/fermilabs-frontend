/**
 * Market entity model
 * Defines market-related state and operations
 * Completely refactored to avoid circular dependencies
 */
import { API_ROUTES, baseMint, config, quoteMint } from '@/shared/config/constants';
import { baseLotsToUi, uiToNativeScaled } from '@/shared/lib/mango-sdk-conversions';
import { HarnessMarketMetadata, lotsPriceToNative } from '@/shared/lib/harness-market';
import { getTokenDecimals, getTokenNameFromMint } from '@/shared/lib/token-decimals';
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
 * Get max leverage for a specific notional value based on leverage tiers
 * @param market - The market configuration
 * @param notional - The notional value in raw token units (price * quantity in smallest units)
 * @returns The maximum allowed leverage for this notional value
 */
export function getMaxLeverageForNotional(market: Market, notional: number): number | null {
  if (market.kind !== 'perp' || !market.perp_config) {
    return null;
  }

  const tiers = market.perp_config.max_leverage_tiers;
  if (!tiers || tiers.length === 0) {
    return null;
  }

  // Sort tiers by notional size descending (highest first)
  // We want to find the first tier where notional >= tier.notional
  const sortedTiers = [...tiers].sort((a, b) => b.notional - a.notional);

  // Find the appropriate tier - the first tier where our notional is >= tier threshold
  for (const tier of sortedTiers) {
    if (notional >= tier.notional) {
      return tier.max_leverage;
    }
  }

  // If notional is less than all tier thresholds, use the lowest tier's leverage
  const lowestTier = sortedTiers[sortedTiers.length - 1];
  return lowestTier.max_leverage;
}

/**
 * Get leverage limits from market configuration
 * @param market - The market configuration
 * @param notional - Optional notional value to get dynamic max leverage
 */
export function getLeverageLimitsFromMarket(
  market: Market,
  notional?: number
): LeverageLimits | null {
  if (market.kind !== 'perp' || !market.perp_config) {
    return null;
  }

  const tiers = market.perp_config.max_leverage_tiers;
  if (!tiers || tiers.length === 0) {
    return null;
  }

  // Sort tiers by notional size ascending
  const sortedTiers = [...tiers].sort((a, b) => a.notional - b.notional);

  // If notional is provided, get the max leverage for that specific notional
  // Otherwise, use the highest leverage available
  const maxLeverage =
    notional !== undefined
      ? (getMaxLeverageForNotional(market, notional) ??
        Math.max(...sortedTiers.map(tier => tier.max_leverage)))
      : Math.max(...sortedTiers.map(tier => tier.max_leverage));

  if (maxLeverage === null) {
    return null;
  }

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
  funding_rate_bps?: number | null;
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
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: number;
  quote_lot_size: number;
  price_decimals: number | null;
  open_interest?: number;
}

// Enhanced market type with parsed token names
export interface EnhancedMarket extends Market {
  baseTokenName: string;
  quoteTokenName: string;
  baseDecimals: number;
  quoteDecimals: number;
}

// Atom for sharing stop loss and take profit values between trade panel and chart
export interface SLTPValues {
  stopLoss: number | null;
  takeProfit: number | null;
}

export const sltpValuesAtom = atom<SLTPValues>({
  stopLoss: null,
  takeProfit: null,
});

/**
 * Parse market name to extract base and quote token names
 * Handles both formats:
 * - "SOL/USDC" or "SOL/USDC Perps" → base: SOL, quote: USDC
 * - "ETH-PERP" → base: ETH, quote: from quote_mint
 */
const parseMarketName = (market: Market): { baseTokenName: string; quoteTokenName: string } => {
  const name = market.name.split(' ')[0]; // Remove suffix like "Perps"

  // Check for "BASE/QUOTE" format
  if (name.includes('/')) {
    const [base, quote] = name.split('/').map((s: string) => s.trim());
    return {
      baseTokenName: base || 'BASE',
      quoteTokenName: quote || 'QUOTE',
    };
  }

  // Check for "BASE-PERP" format (perps market)
  if (name.includes('-PERP')) {
    const base = name.replace('-PERP', '').trim();
    // Get quote token from mint address
    const quoteFromMint = getTokenNameFromMint(market.quote_mint);
    return {
      baseTokenName: base || 'BASE',
      quoteTokenName: quoteFromMint || 'USDC', // Default to USDC for perps
    };
  }

  // Fallback: try to get names from mint addresses
  const baseFromMint = getTokenNameFromMint(market.base_mint);
  const quoteFromMint = getTokenNameFromMint(market.quote_mint);

  return {
    baseTokenName: baseFromMint || 'BASE',
    quoteTokenName: quoteFromMint || 'QUOTE',
  };
};

// Memoized market enhancement to avoid unnecessary object creation
const memoizedEnhanceMarket = (market: Market): EnhancedMarket => {
  if (!market) return null as unknown as EnhancedMarket;

  // Parse the market name to get base and quote token names
  const { baseTokenName, quoteTokenName } = parseMarketName(market);

  const baseDecimals = market.base_decimals ?? getTokenDecimals(baseTokenName);
  const quoteDecimals = market.quote_decimals ?? getTokenDecimals(quoteTokenName);

  // Create enhanced market with token names
  return {
    ...market,
    baseTokenName,
    quoteTokenName,
    baseDecimals,
    quoteDecimals,
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
        axios.get(`${config.devnet.apiBaseUrl}${API_ROUTES.markets}?view=optimistic`)
      );

      if (error) throw error;

      const snapshot = data.data || {};
      const marketsMap = snapshot.markets || {};
      const marketMetadataMap = (snapshot.market_metadata || {}) as Record<
        string,
        HarnessMarketMetadata
      >;
      const marketIds = Object.keys(marketsMap);

      const computeMidPriceLots = (marketState: any): number | null => {
        const bestBid =
          Array.isArray(marketState?.bids) && marketState.bids.length > 0
            ? Number(marketState.bids[0].price_lots)
            : null;
        const bestAsk =
          Array.isArray(marketState?.asks) && marketState.asks.length > 0
            ? Number(marketState.asks[0].price_lots)
            : null;
        if (bestBid !== null && bestAsk !== null) return Math.floor((bestBid + bestAsk) / 2);
        if (bestBid !== null) return bestBid;
        if (bestAsk !== null) return bestAsk;
        return null;
      };

      const latestTradePriceLotsByMarket = new Map<string, number>();
      await Promise.all(
        marketIds.map(async (marketId: string) => {
          const tradesUrl = `${config.devnet.apiBaseUrl}${API_ROUTES.market_trades.replace('{marketId}', marketId)}?view=optimistic&limit=200`;
          const tradesResult = await tryCatch<AxiosResponse<any>>(axios.get(tradesUrl));
          if (tradesResult.error) return;
          const trades = tradesResult.data.data?.data || [];
          if (!Array.isArray(trades) || !trades.length) return;
          const latestTrade = trades[trades.length - 1];
          const latestPriceLots = Number(latestTrade.price_lots);
          if (Number.isFinite(latestPriceLots) && latestPriceLots > 0) {
            latestTradePriceLotsByMarket.set(marketId, latestPriceLots);
          }
        })
      );

      const mappedFromHarness = marketIds.map((harnessMarketId: string) => {
        const marketState = marketsMap[harnessMarketId];
        const marketMeta = marketMetadataMap[harnessMarketId];
        const markPriceLots =
          computeMidPriceLots(marketState) ??
          latestTradePriceLotsByMarket.get(harnessMarketId) ??
          0;
        const markPriceNative = lotsPriceToNative(markPriceLots, marketMeta);
        const openInterest = Array.isArray(marketState?.open_orders)
          ? marketState.open_orders.reduce((acc: number, order: any) => {
              const uiSize = baseLotsToUi(order.base_lots || '0', {
                baseDecimals: marketMeta?.base_decimals ?? config.devnet.baseDecimals,
                baseLotSize: Number(marketMeta?.base_lot_size ?? config.devnet.baseLotSize),
              });
              return (
                acc +
                uiToNativeScaled(uiSize, marketMeta?.base_decimals ?? config.devnet.baseDecimals)
              );
            }, 0)
          : 0;

        return {
          uuid: harnessMarketId,
          name:
            marketMeta?.name ||
            (harnessMarketId === config.devnet.defaultHarnessMarketId
              ? config.devnet.defaultMarketName
              : `Market ${harnessMarketId}`),
          base_mint: marketMeta?.base_mint || baseMint.toBase58(),
          quote_mint: marketMeta?.quote_mint || quoteMint.toBase58(),
          created_at: Date.now(),
          kind: 'perp' as MarketKind,
          perp_config: {
            initial_margin: 0,
            maintenance_margin: 0,
            liquidation_penalty: 0,
            max_leverage_tiers: [{ notional: 0, max_leverage: 100 }],
            funding_interval_seconds: 3600,
            funding_rate_cap_bps: 0,
            funding_interest_rate_bps: 0,
            funding_premium_cap_bps: 0,
            funding_oracle: null,
          },
          perp_state: {
            mark_price: markPriceNative,
            mark_price_timestamp: Date.now(),
            index_price: markPriceNative,
            index_price_timestamp: Date.now(),
            last_premium_rate_bps: 0,
            last_funding_rate_bps: 0,
            funding_rate_bps: 0,
            last_funding_timestamp: Date.now(),
            next_funding_timestamp: Date.now(),
          },
          base_decimals: marketMeta?.base_decimals ?? config.devnet.baseDecimals,
          quote_decimals: marketMeta?.quote_decimals ?? config.devnet.quoteDecimals,
          base_lot_size: Number(marketMeta?.base_lot_size ?? config.devnet.baseLotSize),
          quote_lot_size: Number(marketMeta?.quote_lot_size ?? config.devnet.quoteLotSize),
          price_decimals: marketMeta?.quote_decimals ?? config.devnet.quoteDecimals,
          open_interest: openInterest,
        } as Market;
      });

      const fallbackMarket: Market[] = [
        {
          uuid: config.devnet.defaultHarnessMarketId,
          name: config.devnet.defaultMarketName,
          base_mint: baseMint.toBase58(),
          quote_mint: quoteMint.toBase58(),
          created_at: Date.now(),
          kind: 'perp',
          perp_config: {
            initial_margin: 0,
            maintenance_margin: 0,
            liquidation_penalty: 0,
            max_leverage_tiers: [{ notional: 0, max_leverage: 100 }],
            funding_interval_seconds: 3600,
            funding_rate_cap_bps: 0,
            funding_interest_rate_bps: 0,
            funding_premium_cap_bps: 0,
            funding_oracle: null,
          },
          perp_state: {
            mark_price: 0,
            mark_price_timestamp: Date.now(),
            index_price: 0,
            index_price_timestamp: Date.now(),
            last_premium_rate_bps: 0,
            last_funding_rate_bps: 0,
            funding_rate_bps: 0,
            last_funding_timestamp: Date.now(),
            next_funding_timestamp: Date.now(),
          },
          base_decimals: config.devnet.baseDecimals,
          quote_decimals: config.devnet.quoteDecimals,
          base_lot_size: config.devnet.baseLotSize,
          quote_lot_size: config.devnet.quoteLotSize,
          price_decimals: config.devnet.quoteDecimals,
        },
      ];

      const newMarkets = mappedFromHarness.length > 0 ? mappedFromHarness : fallbackMarket;

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
