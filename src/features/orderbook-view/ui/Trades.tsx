/**
 * Trades component
 * Displays recent trades for the selected market
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';

import { selectedMarketAtom } from '@/entities/market';
import { config, API_ROUTES } from '@/shared/config/constants';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { baseLotsToUi, priceLotsToUi, uiToNativeScaled } from '@/shared/lib/mango-sdk-conversions';

type Trade = {
  id?: string;
  price: number; // raw/scaled integer value (needs to be divided by 10^quoteDecimals)
  quantity: number; // raw/scaled integer value (needs to be divided by 10^baseDecimals)
  timestamp: number | string; // epoch seconds as number or string
  txid?: string;
  market_id?: string;
  buyer_owner?: string;
  seller_owner?: string;
  base_mint?: string;
  quote_mint?: string;
};

type HarnessTrade = {
  trade_id: string;
  market: string;
  price_lots: string;
  base_lots: string;
  quote_lots: string;
  taker_side: 'bid' | 'ask';
  maker_owner: string;
  taker_owner: string;
  maker_order_id: string;
  taker_sequence: string;
  ts_ms: number;
};

const ROW_HEIGHT_CLASS = 'h-[26px]';

function formatTimestamp(timestamp: number | string): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  const date = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function Trades({ rows, fullView = false }: { rows: number; fullView?: boolean }) {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const marketId = selectedMarket?.uuid;
  const limit = rows; // Fetch exactly as many rows as we intend to show

  const { data, isLoading } = useQuery<Trade[] | undefined>({
    queryKey: ['recent-trades', marketId, limit],
    queryFn: async () => {
      if (!marketId) return undefined;
      const apiBaseUrl = config.devnet.gatewayUrl;
      const url = `${apiBaseUrl}${API_ROUTES.market_trades.replace('{marketId}', marketId)}?view=optimistic&limit=${encodeURIComponent(limit)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load recent trades');
      const response = await res.json();
      const trades: HarnessTrade[] = response?.data || [];
      const quoteLotSize = selectedMarket?.quote_lot_size ?? config.devnet.quoteLotSize;
      const baseLotSize = selectedMarket?.base_lot_size ?? config.devnet.baseLotSize;
      const quoteDecimals = selectedMarket?.quote_decimals ?? config.devnet.quoteDecimals;
      const baseDecimals = selectedMarket?.base_decimals ?? 9;
      const lotsPriceToNative = (priceLots: string | number): number =>
        uiToNativeScaled(
          priceLotsToUi(priceLots, {
            baseDecimals,
            quoteDecimals,
            baseLotSize,
            quoteLotSize,
          }),
          quoteDecimals
        );
      const lotsBaseToNative = (baseLots: string | number): number =>
        uiToNativeScaled(
          baseLotsToUi(baseLots, {
            baseDecimals,
            baseLotSize,
          }),
          baseDecimals
        );
      return trades.map((trade, index: number) => ({
        id: trade.trade_id || `${trade.ts_ms}-${index}`,
        price: lotsPriceToNative(trade.price_lots),
        quantity: lotsBaseToNative(trade.base_lots),
        timestamp: String(Math.floor(Number(trade.ts_ms) / 1000)),
        buyer_owner: trade.taker_side === 'bid' ? trade.taker_owner : trade.maker_owner,
        seller_owner: trade.taker_side === 'ask' ? trade.taker_owner : trade.maker_owner,
      }));
    },
    refetchInterval: 1000,
    enabled: !!marketId,
  });

  const trades = useMemo(() => data ?? [], [data]);

  // Determine side (Buy/Sell) by comparing to adjacent trade price
  const visibleTrades = useMemo(() => (trades.length ? trades.slice(0, rows) : []), [trades, rows]);

  type Direction = 'up' | 'down' | 'flat';

  function SkeletonRow() {
    return (
      <div className={`relative font-medium w-full select-none ${ROW_HEIGHT_CLASS}`}>
        <div className="relative z-10 px-4 h-full flex items-center">
          <div
            className={`grid gap-4 items-center font-mono text-xs leading-none tracking-tight w-full ${
              fullView ? 'grid-cols-6' : 'grid-cols-3'
            }`}
          >
            {/* Price skeleton */}
            <div className="text-left">
              <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
            </div>
            {/* Size skeleton */}
            <div className="text-right">
              <div className="h-3 w-12 bg-white/10 rounded animate-pulse ml-auto" />
            </div>
            {/* Total skeleton */}
            <div className="text-right">
              <div className="h-3 w-14 bg-white/10 rounded animate-pulse ml-auto" />
            </div>
            {fullView && (
              <>
                {/* Buyer skeleton */}
                <div className="text-left">
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                </div>
                {/* Seller skeleton */}
                <div className="text-left">
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                </div>
                {/* Time skeleton */}
                <div className="text-right">
                  <div className="h-3 w-16 bg-white/10 rounded animate-pulse ml-auto" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function TradeRow({ trade, direction }: { trade: Trade; direction: Direction }) {
    const { price: rawPrice, quantity: rawQuantity, buyer_owner, seller_owner, timestamp } = trade;

    // Use market decimals as source of truth
    const quoteDecimals =
      selectedMarket?.quoteDecimals ?? getTokenDecimals(selectedMarket?.quoteTokenName);
    const baseDecimals =
      selectedMarket?.baseDecimals ?? getTokenDecimals(selectedMarket?.baseTokenName);

    // Divide raw values by appropriate decimals to get human-readable values
    const price = rawPrice / Math.pow(10, quoteDecimals);
    const quantity = rawQuantity / Math.pow(10, baseDecimals);
    const total = price * quantity;

    // Format values for display
    const formattedPrice = price.toFixed(quoteDecimals);
    const formattedQuantity = quantity.toFixed(baseDecimals);
    const formattedTotal = total.toFixed(quoteDecimals);

    return (
      <div
        className={`relative font-medium w-full select-none hover:bg-white/3 ${ROW_HEIGHT_CLASS}`}
      >
        {/* Content */}
        <div className="relative z-10 px-4 h-full flex items-center">
          <div
            className={cn(
              `grid gap-4 items-center font-mono text-xs leading-none tracking-tight w-full ${
                fullView ? 'grid-cols-6' : 'grid-cols-3'
              }`,
              direction === 'up' && 'text-success',
              direction === 'down' && 'text-danger'
            )}
          >
            {/* Price */}
            <div className="text-left">
              <span className="tabular-nums">{formattedPrice}</span>
            </div>

            {/* Size */}
            <div className={fullView ? 'text-center' : 'text-right'}>
              <span className="tabular-nums">{formattedQuantity}</span>
            </div>

            {/* Total */}
            <div className={fullView ? 'text-center' : 'text-right'}>
              <span className="tabular-nums">{formattedTotal}</span>
            </div>

            {fullView && (
              <>
                {/* Buyer Owner */}
                <div className="text-center">
                  <span className="tabular-nums text-white/60">
                    {buyer_owner ? formatAddress(buyer_owner) : '-'}
                  </span>
                </div>

                {/* Seller Owner */}
                <div className="text-center">
                  <span className="tabular-nums text-white/60">
                    {seller_owner ? formatAddress(seller_owner) : '-'}
                  </span>
                </div>

                {/* Time */}
                <div className="text-right">
                  <span className="tabular-nums text-white/60">
                    {timestamp ? formatTimestamp(timestamp) : '-'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] flex-1 min-h-0 overflow-hidden py-2">
      <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-white/5  border-none">
        {isLoading ? (
          // Show skeleton rows when loading
          Array.from({ length: rows }).map((_, i) => <SkeletonRow key={`skeleton-trade-${i}`} />)
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
