import { useQuery } from '@tanstack/react-query';
import axios, { AxiosResponse } from 'axios';
import { config, API_ROUTES } from '../config/constants';
import { tryCatch } from '../lib/try-catch';
import { baseLotsToUi, uiToNativeScaled } from '../lib/mango-sdk-conversions';
import {
  HarnessMarketMetadata,
  lotsPriceToNative,
  resolveMarketConversionParams,
} from '../lib/harness-market';

export interface Position {
  owner: string;
  market_id: string;
  market_name: string;
  base_position: string;
  average_entry_price: string;
  mark_price: string;
  realized_pnl: string;
  unrealized_pnl: string;
  cumulative_funding: string;
  stop_loss_price?: string;
  take_profit_price?: string;
  // Market metadata (if available from backend)
  base_decimals?: number;
  quote_decimals?: number;
  base_mint?: string;
  quote_mint?: string;
}

interface UsePositionsParams {
  owner?: string;
  marketId?: string;
  enabled?: boolean; // Optional override for query enabled state
}

interface HarnessFullStateResponse {
  view: 'optimistic' | 'confirmed';
  market_metadata?: Record<string, HarnessMarketMetadata>;
  markets: Record<
    string,
    {
      bids: Array<{ price_lots: string; base_lots: string }>;
      asks: Array<{ price_lots: string; base_lots: string }>;
    }
  >;
  users: Record<
    string,
    {
      owner: string;
      per_market: Array<{
        market: string;
        base_position_lots: string;
        quote_position_native: string;
      }>;
    }
  >;
}

interface HarnessTradesResponse {
  view: 'optimistic' | 'confirmed';
  market: string;
  data: Array<{
    market: string;
    price_lots: string;
    ts_ms: number;
  }>;
}

function getMidPriceLots(marketState?: {
  bids: Array<{ price_lots: string; base_lots: string }>;
  asks: Array<{ price_lots: string; base_lots: string }>;
}): number | null {
  if (!marketState) return null;
  const bestBid = marketState.bids.length > 0 ? Number(marketState.bids[0].price_lots) : null;
  const bestAsk = marketState.asks.length > 0 ? Number(marketState.asks[0].price_lots) : null;
  if (bestBid !== null && bestAsk !== null) return Math.floor((bestBid + bestAsk) / 2);
  if (bestBid !== null) return bestBid;
  if (bestAsk !== null) return bestAsk;
  return null;
}

function pow10(exp: number): bigint {
  const safeExp = Math.max(0, Math.floor(exp));
  return 10n ** BigInt(safeExp);
}

/**
 * Hook to fetch positions from the /positions endpoint
 * @param params - Query parameters for filtering positions
 * @param params.owner - Base58-encoded pubkey to filter by account owner (optional)
 * @param params.marketId - UUID to filter by specific market (optional)
 * @param params.enabled - Override for query enabled state (optional)
 */
export function usePositions(params: UsePositionsParams = {}) {
  const { owner, marketId, enabled } = params;

  return useQuery({
    queryKey: ['positions', owner, marketId],
    queryFn: async (): Promise<Position[]> => {
      if (!owner && !marketId) return [];
      const url = `${config.devnet.apiBaseUrl}${API_ROUTES.markets}?view=optimistic`;
      const { data, error } = await tryCatch<AxiosResponse<HarnessFullStateResponse>>(
        axios.get(url)
      );

      if (error) {
        throw error;
      }

      const users = data.data.users || {};
      const marketMetadata = data.data.market_metadata || {};
      const ownersToScan = owner ? [owner] : Object.keys(users);
      const candidateMarkets = [
        ...new Set(
          ownersToScan.flatMap(currentOwner =>
            (users[currentOwner]?.per_market || [])
              .filter(entry => (marketId ? entry.market === marketId : true))
              .map(entry => entry.market)
          )
        ),
      ];
      const latestTradePriceLotsByMarket = new Map<string, number>();

      await Promise.all(
        candidateMarkets.map(async candidateMarket => {
          const tradesUrl = `${config.devnet.apiBaseUrl}${API_ROUTES.market_trades.replace('{marketId}', candidateMarket)}?view=optimistic&limit=200`;
          const tradesResult = await tryCatch<AxiosResponse<HarnessTradesResponse>>(
            axios.get(tradesUrl)
          );
          if (tradesResult.error) return;

          const trades = tradesResult.data.data.data || [];
          if (!trades.length) return;

          const latestTrade = trades[trades.length - 1];
          const latestPriceLots = Number(latestTrade.price_lots);
          if (Number.isFinite(latestPriceLots) && latestPriceLots > 0) {
            latestTradePriceLotsByMarket.set(candidateMarket, latestPriceLots);
          }
        })
      );

      const mapped = ownersToScan.flatMap(currentOwner => {
        const user = users[currentOwner];
        if (!user) return [];

        return (user.per_market || [])
          .filter(entry => (marketId ? entry.market === marketId : true))
          .filter(entry => BigInt(entry.base_position_lots || '0') !== 0n)
          .map(entry => {
            const marketMeta = marketMetadata[entry.market];
            const params = resolveMarketConversionParams(marketMeta);
            const baseScale = pow10(params.base_decimals);
            const midPriceLots = getMidPriceLots(data.data.markets?.[entry.market]);
            const fallbackTradePriceLots = latestTradePriceLotsByMarket.get(entry.market) ?? null;
            const selectedPriceLots = midPriceLots ?? fallbackTradePriceLots ?? 0;

            const basePositionNative = BigInt(
              uiToNativeScaled(
                baseLotsToUi(entry.base_position_lots || '0', {
                  baseDecimals: params.base_decimals,
                  baseLotSize: params.base_lot_size,
                }),
                params.base_decimals
              )
            );
            const quotePositionNative = BigInt(entry.quote_position_native || '0');
            const markPriceNative = BigInt(lotsPriceToNative(selectedPriceLots, marketMeta));
            const averageEntryNative =
              basePositionNative !== 0n
                ? (-quotePositionNative * baseScale) / basePositionNative
                : 0n;
            const unrealizedPnlNative =
              basePositionNative !== 0n
                ? (basePositionNative * markPriceNative) / baseScale + quotePositionNative
                : 0n;

            return {
              owner: currentOwner,
              market_id: entry.market,
              market_name: marketMeta?.name || `Market ${entry.market}`,
              base_position: basePositionNative.toString(),
              average_entry_price: averageEntryNative.toString(),
              mark_price: markPriceNative.toString(),
              realized_pnl: '0', // TODO: enrich from dedicated PnL endpoint
              unrealized_pnl: unrealizedPnlNative.toString(),
              cumulative_funding: '0', // TODO: enrich from funding endpoint
              base_decimals: params.base_decimals,
              quote_decimals: params.quote_decimals,
              base_mint: marketMeta?.base_mint || '',
              quote_mint: marketMeta?.quote_mint || '',
            } satisfies Position;
          });
      });

      return mapped;
    },
    enabled: enabled !== undefined ? enabled : !!owner || !!marketId,
    refetchInterval: 500,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to fetch positions for a specific user
 * @param userPubKey - Base58-encoded user public key
 */
export function useUserPositions(userPubKey: string) {
  return usePositions({ owner: userPubKey });
}

/**
 * Hook to fetch positions for a specific market
 * @param marketId - Market UUID
 */
export function useMarketPositions(marketId: string) {
  return usePositions({ marketId });
}
