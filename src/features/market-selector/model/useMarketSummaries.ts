/**
 * Per-market stats for the market selector.
 *
 * The trade page's SSE stream only carries the selected market, so the
 * selector polls the gateway for all of them, and only while it is open:
 * - /v2/markets: mark, oracle, open interest and funding for every market
 * - /v2/stats/volume/24h: per-market quote volume
 * - /v2/candles (1h, last 24h) per market: 24h change and the sparkline
 */
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAtomValue } from 'jotai';
import { fetchV2Markets } from '@/shared/api/v2-api';
import { mapV2MetaToMetrics } from '@/shared/api/v2-adapter';
import { API_ROUTES_V2, config } from '@/shared/config/constants';
import { quoteLotsToUi } from '@/shared/lib/mango-sdk-conversions';
import { fetchPerpsCandles, processPerpsCandleData } from '@/features/chart/lib/perps-chart';
import { marketRiskLimits } from '@/features/order-placement/lib/useOrderForm';
import { serverConfigAtom } from '@/entities/server';
import { marketNameToSlug, type Market } from '@/entities/market';

export interface MarketSummary {
  id: string;
  /** Display name, e.g. "SOL-PERP". */
  symbol: string;
  base: string;
  maxLeverage: number;
  markPrice: number | null;
  oraclePrice: number | null;
  /** Hourly funding, in the same unit the chart header shows. */
  fundingHourly: number | null;
  openInterestUsd: number | null;
  volume24hUsd: number | null;
  /** Signed 24h price change, absolute and percent. */
  change24h: number | null;
  change24hPct: number | null;
  /** Hourly closes over the last 24h, oldest first. */
  sparkline: number[];
}

interface V2VolumeResponse {
  per_market: Array<{ market: string; volume_quote_lots?: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useMarketSummaries(markets: Market[], enabled: boolean) {
  const serverConfig = useAtomValue(serverConfigAtom);

  const metaQuery = useQuery({
    queryKey: ['market-selector', 'meta'],
    queryFn: ({ signal }) => fetchV2Markets({ signal }),
    enabled,
    refetchInterval: enabled ? 5_000 : false,
  });

  const volumeQuery = useQuery({
    queryKey: ['market-selector', 'volume24h'],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<V2VolumeResponse>(
        `${config.devnet.gatewayUrl}${API_ROUTES_V2.stats_volume_24h}`,
        { signal }
      );
      return data;
    },
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });

  const candleQueries = useQueries({
    queries: markets.map(market => ({
      queryKey: ['market-selector', 'candles-24h', market.uuid],
      queryFn: async () => {
        const now = Date.now();
        const raw = await fetchPerpsCandles({
          marketId: market.uuid,
          tf: '1h',
          from: new Date(now - DAY_MS).toISOString(),
          to: new Date(now).toISOString(),
        });
        return processPerpsCandleData(raw, market)
          .map(c => c.close)
          .filter((c): c is number => c !== undefined && Number.isFinite(c));
      },
      enabled,
      staleTime: 60_000,
      refetchInterval: enabled ? 60_000 : (false as const),
    })),
  });

  const closesByMarket = candleQueries.map(q => q.data);
  // useQueries returns a fresh array each render; memo on when the data changed
  const candlesVersion = candleQueries.map(q => q.dataUpdatedAt).join(',');

  const summaries = useMemo<MarketSummary[]>(() => {
    const metaById = new Map(
      (metaQuery.data?.markets ?? []).map(m => [
        m.market,
        mapV2MetaToMetrics({ market: m.market, meta: m.meta as Record<string, string> }),
      ])
    );
    const volumeById = new Map(
      (volumeQuery.data?.per_market ?? []).map(v => [v.market, v.volume_quote_lots])
    );

    return markets.map((market, i) => {
      const metrics = metaById.get(market.uuid);
      const markPrice = metrics?.mark_price_ui || null;
      const closes = closesByMarket[i] ?? [];
      const last = markPrice ?? closes[closes.length - 1] ?? null;
      const first = closes[0];
      const change24h = last !== null && first ? last - first : null;
      const volumeLots = volumeById.get(market.uuid);
      const hasFunding = metaQuery.data?.markets.some(
        m => m.market === market.uuid && 'funding_rate_hourly' in m.meta
      );
      const risk = serverConfig?.markets.find(
        m => m.market_index === parseInt(market.uuid, 10)
      )?.risk;

      return {
        id: market.uuid,
        symbol: marketNameToSlug(market.name),
        base: marketNameToSlug(market.name).split(/[-/]/)[0],
        maxLeverage: marketRiskLimits(risk).maxLeverage,
        markPrice,
        oraclePrice: metrics?.oracle_price_ui || null,
        // Matches ChartHeader: funding_rate_hourly_pct / 100
        fundingHourly: metrics && hasFunding ? metrics.funding_rate_hourly_pct / 100 : null,
        openInterestUsd:
          metrics && markPrice !== null ? metrics.open_interest_base_ui * markPrice : null,
        volume24hUsd:
          volumeLots !== undefined
            ? quoteLotsToUi(volumeLots, {
                quoteDecimals: market.quote_decimals,
                quoteLotSize: market.quote_lot_size,
              })
            : volumeQuery.data
              ? 0
              : null,
        change24h,
        change24hPct: change24h !== null && first ? (change24h / first) * 100 : null,
        sparkline: last !== null && closes.length > 0 ? [...closes.slice(0, -1), last] : closes,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, metaQuery.data, volumeQuery.data, serverConfig, candlesVersion]);

  return {
    summaries,
    isLoading: metaQuery.isLoading,
  };
}
