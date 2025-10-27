/**
 * Trades component
 * Displays recent trades for the selected market
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';

import { selectedMarketAtom } from '@/entities/market';
import { config } from '@/shared/config/constants';
import { getTokenDecimals } from '@/shared/lib/token-decimals';

type Trade = {
  id: string;
  price: number; // already divided by decimals
  quantity: number; // already divided by decimals
  timestamp: string; // epoch seconds as string
  txid: string;
  market_id: string;
};

type RecentTradesResponse = {
  trades: Trade[];
  count: number;
  limit: number;
  marketId: string;
};

const ROW_HEIGHT_CLASS = 'h-[26px]';

export function Trades({ rows }: { rows: number }) {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const marketId = selectedMarket?.uuid;
  const limit = rows; // Fetch exactly as many rows as we intend to show

  const { data } = useQuery<RecentTradesResponse | undefined>({
    queryKey: ['recent-trades', marketId, limit],
    queryFn: async () => {
      if (!marketId) return undefined;
      const base = config.devnet.graphApiUrl;
      const url = `${base}/trades/recent?limit=${encodeURIComponent(limit)}&marketId=${encodeURIComponent(
        marketId
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load recent trades');
      return (await res.json()) as RecentTradesResponse;
    },
    refetchInterval: 1000,
    enabled: !!marketId,
  });

  const trades = useMemo(() => data?.trades ?? [], [data]);

  // Determine side (Buy/Sell) by comparing to adjacent trade price
  const visibleTrades = useMemo(() => (trades.length ? trades.slice(0, rows) : []), [trades, rows]);

  type Direction = 'up' | 'down' | 'flat';

  function TradeRow({ trade, direction }: { trade: Trade; direction: Direction }) {
    const { price, quantity } = trade;

    // Format values (already divided by decimals from API)
    // Use market decimals as source of truth
    const quoteDecimals =
      selectedMarket?.quoteDecimals ?? getTokenDecimals(selectedMarket?.quoteTokenName);
    const baseDecimals =
      selectedMarket?.baseDecimals ?? getTokenDecimals(selectedMarket?.baseTokenName);
    const formattedPrice = price.toFixed(quoteDecimals);
    const formattedQuantity = quantity.toFixed(baseDecimals);
    const formattedTotal = (price * quantity).toFixed(quoteDecimals);

    return (
      <div
        className={`relative font-medium w-full select-none hover:bg-white/3 ${ROW_HEIGHT_CLASS}`}
      >
        {/* Content */}
        <div className="relative z-10 px-4 h-full flex items-center">
          <div
            className={cn(
              'grid grid-cols-3 gap-4 items-center font-mono  text-xs leading-none opacity-50 tracking-tight w-full',
              direction === 'up' && 'text-success',
              direction === 'down' && 'text-danger'
            )}
          >
            {/* Price */}
            <div className="text-left">
              <span className="tabular-nums">{formattedPrice}</span>
            </div>

            {/* Size */}
            <div className="text-right">
              <span className="tabular-nums">{formattedQuantity}</span>
            </div>

            {/* Total */}
            <div className="text-right">
              <span className="tabular-nums">{formattedTotal}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] overflow-hidden py-2">
      <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-white/5  border-none">
        {visibleTrades.map((t, i) => {
          const next = visibleTrades[i + 1]; // next is the previous trade in time (older)
          let direction: Direction = 'flat';
          if (next) {
            direction = t.price > next.price ? 'up' : t.price < next.price ? 'down' : 'flat';
          }
          return <TradeRow key={`${t.id}-${i}`} trade={t} direction={direction} />;
        })}

        {/* Pad with empty rows to keep height consistent */}
        {Array.from({ length: Math.max(0, rows - trades.length) }).map((_, i) => (
          <div key={`empty-trade-${i}`} className={ROW_HEIGHT_CLASS} />
        ))}
      </div>
    </div>
  );
}
