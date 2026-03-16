/**
 * useMarketStats hook
 * Fetches market statistics from the API using react-query
 */
import { useQuery } from '@tanstack/react-query';
import axios, { AxiosResponse } from 'axios';
import { API_ROUTES, config } from '@/shared/config/constants';
import { tryCatch } from '@/shared/lib/try-catch';
import type { Market } from '@/entities/market';
import { baseLotsToUi, uiToNativeScaled } from '@/shared/lib/mango-sdk-conversions';
import { HarnessMarketMetadata, lotsPriceToNative } from '@/shared/lib/harness-market';

export interface MarketStatsResponse {
  markets: Market[];
}

export interface UseMarketStatsOptions {
  refetchInterval?: number;
  enabled?: boolean;
}

interface HarnessFullStateResponse {
  view: 'optimistic' | 'confirmed';
  market_metadata?: Record<string, HarnessMarketMetadata>;
  markets: Record<
    string,
    {
      market: string;
      bids: Array<{ price_lots: string; base_lots: string }>;
      asks: Array<{ price_lots: string; base_lots: string }>;
      open_orders: Array<{
        base_lots: string;
      }>;
    }
  >;
}

interface HarnessTradesResponse {
  view: 'optimistic' | 'confirmed';
  market: string;
  data: Array<{
    price_lots: string;
    ts_ms: number;
  }>;
}

function midpointPriceLots(market: {
  bids: Array<{ price_lots: string; base_lots: string }>;
  asks: Array<{ price_lots: string; base_lots: string }>;
}): number | null {
  const bestBid = market.bids.length > 0 ? Number(market.bids[0].price_lots) : null;
  const bestAsk = market.asks.length > 0 ? Number(market.asks[0].price_lots) : null;
  if (bestBid !== null && bestAsk !== null) return Math.floor((bestBid + bestAsk) / 2);
  if (bestBid !== null) return bestBid;
  if (bestAsk !== null) return bestAsk;
  return null;
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
      const url = `${config.devnet.apiBaseUrl}${API_ROUTES.markets}?view=optimistic`;
      const { data, error } = await tryCatch<AxiosResponse<HarnessFullStateResponse>>(
        axios.get(url)
      );

      if (error) {
        throw error;
      }

      const markets = Object.entries(data.data.markets || {});
      const marketMetadata = data.data.market_metadata || {};
      const latestTradePriceLotsByMarket = new Map<string, number>();
      await Promise.all(
        markets.map(async ([marketId]) => {
          const tradesUrl = `${config.devnet.apiBaseUrl}${API_ROUTES.market_trades.replace('{marketId}', marketId)}?view=optimistic&limit=200`;
          const tradesResult = await tryCatch<AxiosResponse<HarnessTradesResponse>>(
            axios.get(tradesUrl)
          );
          if (tradesResult.error) return;
          const trades = tradesResult.data.data.data || [];
          if (!trades.length) return;
          const latestTrade = trades[trades.length - 1];
          const latestPriceLots = Number(latestTrade.price_lots);
          if (Number.isFinite(latestPriceLots) && latestPriceLots > 0) {
            latestTradePriceLotsByMarket.set(marketId, latestPriceLots);
          }
        })
      );

      return markets.map(([marketId, marketState]) => {
        const marketMeta = marketMetadata[marketId];
        const markPriceLots =
          midpointPriceLots(marketState) ?? latestTradePriceLotsByMarket.get(marketId) ?? 0;
        const markPriceNative = lotsPriceToNative(markPriceLots, marketMeta);
        const openInterest = Array.isArray(marketState.open_orders)
          ? marketState.open_orders.reduce((acc, order) => {
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
          uuid: marketId,
          name:
            marketMeta?.name ||
            (marketId === config.devnet.defaultHarnessMarketId
              ? config.devnet.defaultMarketName
              : `Market ${marketId}`),
          base_mint: marketMeta?.base_mint || '',
          quote_mint: marketMeta?.quote_mint || '',
          created_at: 0,
          kind: 'perp',
          perp_config: null,
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
    },
    refetchInterval,
    refetchIntervalInBackground: false,
    enabled,
    staleTime: 3000,
  });
}
