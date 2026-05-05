/**
 * Trades component
 * Displays recent trades for the selected market via SSE stream.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAtomValue } from 'jotai';

import { selectedMarketAtom } from '@/entities/market';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { recentMarketTradesAtom } from '@/shared/api/sse-atoms';
import { sseConnectionStateAtom } from '@/shared/api/sse-atoms';
import type { RecentTrade } from '@/shared/api/sse-atom-bridge';

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
  const allTrades = useAtomValue(recentMarketTradesAtom);
  const connectionState = useAtomValue(sseConnectionStateAtom);

  const isLoading = connectionState === 'connecting' && allTrades.length === 0;
  const visibleTrades = useMemo(() => allTrades.slice(0, rows), [allTrades, rows]);

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
            <div className="text-left">
              <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
            </div>
            <div className="text-right">
              <div className="h-3 w-12 bg-white/10 rounded animate-pulse ml-auto" />
            </div>
            <div className="text-right">
              <div className="h-3 w-14 bg-white/10 rounded animate-pulse ml-auto" />
            </div>
            {fullView && (
              <>
                <div className="text-left">
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                </div>
                <div className="text-left">
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                </div>
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

  function TradeRow({ trade, direction }: { trade: RecentTrade; direction: Direction }) {
    const { price: rawPrice, quantity: rawQuantity, buyer_owner, seller_owner, timestamp } = trade;

    const quoteDecimals =
      selectedMarket?.quoteDecimals ?? getTokenDecimals(selectedMarket?.quoteTokenName);
    const baseDecimals =
      selectedMarket?.baseDecimals ?? getTokenDecimals(selectedMarket?.baseTokenName);

    const price = rawPrice / Math.pow(10, quoteDecimals);
    const quantity = rawQuantity / Math.pow(10, baseDecimals);
    const total = price * quantity;

    const formattedPrice = price.toFixed(quoteDecimals);
    const formattedQuantity = quantity.toFixed(baseDecimals);
    const formattedTotal = total.toFixed(quoteDecimals);

    return (
      <div
        className={`relative font-medium w-full select-none hover:bg-white/3 ${ROW_HEIGHT_CLASS}`}
      >
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
            <div className="text-left">
              <span className="tabular-nums">{formattedPrice}</span>
            </div>
            <div className={fullView ? 'text-center' : 'text-right'}>
              <span className="tabular-nums">{formattedQuantity}</span>
            </div>
            <div className={fullView ? 'text-center' : 'text-right'}>
              <span className="tabular-nums">{formattedTotal}</span>
            </div>
            {fullView && (
              <>
                <div className="text-center">
                  <span className="tabular-nums text-white/60">
                    {buyer_owner ? formatAddress(buyer_owner) : '-'}
                  </span>
                </div>
                <div className="text-center">
                  <span className="tabular-nums text-white/60">
                    {seller_owner ? formatAddress(seller_owner) : '-'}
                  </span>
                </div>
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
    <div
      className={`flex flex-col flex-1 min-h-0 overflow-hidden ${fullView ? 'h-[500px] py-2' : ''}`}
    >
      <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-white/5 border-none">
        {isLoading ? (
          Array.from({ length: rows }).map((_, i) => <SkeletonRow key={`skeleton-trade-${i}`} />)
        ) : (
          <>
            {visibleTrades.map((t, i) => {
              const next = visibleTrades[i + 1];
              let direction: Direction = 'flat';
              if (next) {
                direction = t.price > next.price ? 'up' : t.price < next.price ? 'down' : 'flat';
              }
              return <TradeRow key={`${t.id}-${i}`} trade={t} direction={direction} />;
            })}
            {Array.from({ length: Math.max(0, rows - visibleTrades.length) }).map((_, i) => (
              <div key={`empty-trade-${i}`} className={ROW_HEIGHT_CLASS} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
