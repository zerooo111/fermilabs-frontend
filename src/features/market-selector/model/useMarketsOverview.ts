/**
 * One row of numbers per perp market for the market palette: live mark price,
 * funding and open interest from the SSE-fed markets atom, 24h volume from the
 * batch stats endpoint, and a 24h hourly close series (sparkline + 24h change)
 * from the candles endpoint. Candles are only fetched while `enabled`.
 */
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAtomValue } from 'jotai';

import { MarketModel, marketsAtom, type EnhancedMarket } from '@/entities/market';
import { fetchPerpsCandles, processPerpsCandleData } from '@/features/chart/lib/perps-chart';
import { API_ROUTES_V2, config } from '@/shared/config/constants';
import { quoteLotsToUi } from '@/shared/lib/mango-sdk-conversions';

export interface MarketOverview {
  market: EnhancedMarket;
  symbol: string;
  price: number | null;
  change24h: number | null;
  /** Hourly closes over the last 24h, oldest first */
  spark: number[];
  /** Funding in % per hour, as the market header shows it */
  funding: number | null;
  volume24h: number | null;
  /** Open interest notional in quote currency */
  openInterest: number | null;
  maxLeverage: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// The protocol enforces 5× regardless of the configured tiers (see the trade
// ticket), so never advertise more than that
const PROTOCOL_MAX_LEVERAGE = 5;

interface V2VolumeResponse {
  per_market: Array<{ market: string; volume_native_base: string; volume_quote_lots?: string }>;
}

function useVolumes(enabled: boolean) {
  return useQuery({
    queryKey: ['volume24h', 'all-markets'],
    enabled: enabled && config.devnet.useV2ReadLayer,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await axios.get<V2VolumeResponse>(
        `${config.devnet.gatewayUrl}${API_ROUTES_V2.stats_volume_24h}`
      );
      return new Map(data.per_market.map(m => [m.market, m.volume_quote_lots ?? null]));
    },
  });
}

export function useMarketsOverview(enabled: boolean): MarketOverview[] {
  const markets = useAtomValue(marketsAtom);
  const perps = useMemo(
    () => markets.filter(m => m.kind === 'perp').map(MarketModel.enhanceMarket),
    [markets]
  );
  const volumes = useVolumes(enabled);

  const candles = useQueries({
    queries: perps.map(m => ({
      queryKey: ['market-overview-candles', m.uuid],
      enabled,
      staleTime: 60_000,
      refetchInterval: enabled ? 60_000 : (false as const),
      queryFn: async () => {
        const now = Date.now();
        const raw = await fetchPerpsCandles({
          marketId: m.uuid,
          tf: '1h',
          from: new Date(now - DAY_MS - 60 * 60 * 1000).toISOString(),
          to: new Date(now).toISOString(),
          // Mark candles are continuous; last-trade candles are sparse on
          // quiet markets and draw a flat line
          priceSource: 'mark',
        });
        return processPerpsCandleData(
          raw,
          {
            base_mint: m.base_mint,
            quote_mint: m.quote_mint,
            base_decimals: m.base_decimals,
            quote_decimals: m.quote_decimals,
            base_lot_size: m.base_lot_size,
            quote_lot_size: m.quote_lot_size,
          },
          'mark'
        )
          .map(c => c.close)
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
      },
    })),
  });

  return useMemo(
    () =>
      perps.map((m, i) => {
        const rawMark = m.perp_state?.mark_price;
        const price = rawMark && rawMark > 0 ? rawMark / 10 ** m.quoteDecimals : null;
        const spark = candles[i]?.data ?? [];
        const first = spark[0];
        const last = price ?? spark[spark.length - 1];
        const change24h = first && last ? ((last - first) / first) * 100 : null;
        const fundingBps = m.perp_state?.funding_rate_bps ?? m.perp_state?.last_funding_rate_bps;
        const volLots = volumes.data?.get(m.uuid);
        const oiBase =
          m.open_interest !== undefined
            ? (m.open_interest * m.base_lot_size) / 10 ** m.baseDecimals
            : null;
        const tiers = m.perp_config?.max_leverage_tiers ?? [];
        return {
          market: m,
          symbol: m.baseTokenName,
          price,
          change24h,
          spark,
          funding: fundingBps !== null && fundingBps !== undefined ? fundingBps / 10_000 : null,
          volume24h:
            volLots != null
              ? quoteLotsToUi(volLots, {
                  quoteDecimals: m.quoteDecimals,
                  quoteLotSize: m.quote_lot_size,
                })
              : null,
          openInterest: oiBase !== null && price ? oiBase * price : null,
          maxLeverage: tiers.length
            ? Math.min(PROTOCOL_MAX_LEVERAGE, Math.max(...tiers.map(t => t.max_leverage)))
            : PROTOCOL_MAX_LEVERAGE,
        };
      }),
    [perps, candles, volumes.data]
  );
}
