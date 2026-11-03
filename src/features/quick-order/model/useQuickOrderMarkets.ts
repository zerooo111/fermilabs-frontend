/**
 * Markets and mark prices for the quick-order palette.
 *
 * The trade page's SSE stream only carries the selected market, and a basket
 * spans several, so — like the market selector — this polls /v2/markets while
 * the palette is open and falls back to the market list's own snapshot.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { marketNameToSlug, marketsAtom, type Market } from '@/entities/market';
import { mapV2MetaToMetrics } from '@/shared/api/v2-adapter';
import { fetchV2Markets } from '@/shared/api/v2-api';
import type { QuickOrderMarket } from './parse';

export interface QuickOrderMarketInfo extends QuickOrderMarket {
  market: Market;
  /** Mark price in quote units, or null when unavailable. */
  markPrice: number | null;
}

function snapshotMarkPrice(market: Market): number | null {
  const raw = market.perp_state?.mark_price;
  if (raw === null || raw === undefined || raw <= 0) return null;
  return raw / 10 ** market.quote_decimals;
}

export function useQuickOrderMarkets(enabled: boolean) {
  const allMarkets = useAtomValue(marketsAtom);

  const meta = useQuery({
    queryKey: ['quick-order', 'marks'],
    queryFn: ({ signal }) => fetchV2Markets({ signal }),
    enabled,
    refetchInterval: enabled ? 5_000 : false,
  });

  const markets = useMemo<QuickOrderMarketInfo[]>(() => {
    const liveMarks = new Map(
      (meta.data?.markets ?? []).map(row => [
        row.market,
        mapV2MetaToMetrics({ market: row.market, meta: row.meta as Record<string, string> })
          .mark_price_ui,
      ])
    );

    return allMarkets
      .filter(m => m.kind === 'perp')
      .map(market => {
        const symbol = marketNameToSlug(market.name);
        const live = liveMarks.get(market.uuid);
        return {
          id: market.uuid,
          symbol,
          base: symbol.split(/[-/]/)[0],
          market,
          markPrice: live && live > 0 ? live : snapshotMarkPrice(market),
        };
      });
  }, [allMarkets, meta.data]);

  return markets;
}
