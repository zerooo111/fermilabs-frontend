/**
 * Trades component
 * Displays recent trades for the selected market via SSE stream.
 */
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatPrice, formatQuantity } from '../lib/processOrderbook';
import { useAtomValue } from 'jotai';

import { selectedMarketAtom } from '@/entities/market';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { recentMarketTradesAtom } from '@/shared/api/sse-atoms';
import { sseConnectionStateAtom } from '@/shared/api/sse-atoms';
import type { RecentTrade } from '@/shared/api/sse-atom-bridge';
import './trade-dissolve.css';

const ROW_HEIGHT_CLASS = 'h-[22px]';

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

type Direction = 'up' | 'down' | 'flat';

function SkeletonRow({ fullView }: { fullView: boolean }) {
  return (
    <div className={`relative w-full select-none ${ROW_HEIGHT_CLASS}`}>
      <div className="relative z-10 px-4 h-full flex items-center">
        <div
          className={`grid gap-4 items-center font-mono text-xs leading-none tracking-tight w-full ${
            fullView ? 'grid-cols-6' : 'grid-cols-3'
          }`}
        >
          <div className="text-left">
            <div className="h-3 w-16 bg-rock/10 animate-pulse" />
          </div>
          <div className="text-right">
            <div className="h-3 w-12 bg-rock/10 animate-pulse ml-auto" />
          </div>
          <div className="text-right">
            <div className="h-3 w-14 bg-rock/10 animate-pulse ml-auto" />
          </div>
          {fullView && (
            <>
              <div className="text-left">
                <div className="h-3 w-20 bg-rock/10 animate-pulse" />
              </div>
              <div className="text-left">
                <div className="h-3 w-20 bg-rock/10 animate-pulse" />
              </div>
              <div className="text-right">
                <div className="h-3 w-16 bg-rock/10 animate-pulse ml-auto" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type TradeRowProps = {
  trade: RecentTrade;
  direction: Direction;
  fullView: boolean;
  quoteDecimals: number;
  baseDecimals: number;
  /** Whether the row arrived after the initial load; read once, on mount. */
  isNew: boolean;
};

function TradeRow({
  trade,
  direction,
  fullView,
  quoteDecimals,
  baseDecimals,
  isNew,
}: TradeRowProps) {
  const { price: rawPrice, quantity: rawQuantity, buyer_owner, seller_owner, timestamp } = trade;
  // Latched at mount: rows keep their element across renders (keyed by trade
  // id), so the dissolve plays once and later renders never restart it.
  const [dissolve] = useState(isNew);

  const price = rawPrice / Math.pow(10, quoteDecimals);
  const quantity = rawQuantity / Math.pow(10, baseDecimals);
  const total = price * quantity;

  // formatPrice/formatQuantity take the scaled integers and pick a sane
  // display precision, so pass the raw values rather than the UI floats.
  const formattedPrice = formatPrice(rawPrice, quoteDecimals);
  const formattedQuantity = formatQuantity(rawQuantity, baseDecimals);
  const formattedTotal = formatPrice(
    Math.round(total * Math.pow(10, quoteDecimals)),
    quoteDecimals
  );

  return (
    <div className={`relative w-full select-none hover:bg-rock/3 ${ROW_HEIGHT_CLASS}`}>
      {/* New-trade flash: a dither layer behind the text that thins out
          50 -> 25 -> 12 -> 6 -> gone (see trade-dissolve.css) */}
      {dissolve && (
        <div
          aria-hidden
          className={cn(
            'trade-dissolve absolute inset-0 pointer-events-none',
            direction === 'up'
              ? 'bg-success/35'
              : direction === 'down'
                ? 'bg-danger/35'
                : 'bg-rock/20'
          )}
        />
      )}
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
                <span className="tabular-nums text-rock/60">
                  {buyer_owner ? formatAddress(buyer_owner) : '-'}
                </span>
              </div>
              <div className="text-center">
                <span className="tabular-nums text-rock/60">
                  {seller_owner ? formatAddress(seller_owner) : '-'}
                </span>
              </div>
              <div className="text-right">
                <span className="tabular-nums text-rock/60">
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

export function Trades({ rows, fullView = false }: { rows: number; fullView?: boolean }) {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const allTrades = useAtomValue(recentMarketTradesAtom);
  const connectionState = useAtomValue(sseConnectionStateAtom);

  const isLoading = connectionState === 'connecting' && allTrades.length === 0;
  const visibleTrades = useMemo(() => allTrades.slice(0, rows), [allTrades, rows]);

  const quoteDecimals =
    selectedMarket?.quoteDecimals ?? getTokenDecimals(selectedMarket?.quoteTokenName);
  const baseDecimals =
    selectedMarket?.baseDecimals ?? getTokenDecimals(selectedMarket?.baseTokenName);

  // Only trades that land above the previous newest trade dissolve in. The
  // initial snapshot, a market switch and history backfilled at the bottom
  // all render without flashes.
  const marketKey = selectedMarket?.name ?? '';
  const topId = allTrades[0]?.id;
  const [prevTop, setPrevTop] = useState<{ market: string; id: string } | null>(null);
  useEffect(() => {
    if (topId === undefined) return;
    setPrevTop(p =>
      p?.market === marketKey && p.id === topId ? p : { market: marketKey, id: topId }
    );
  }, [topId, marketKey]);
  const freshCount =
    prevTop?.market === marketKey
      ? Math.max(
          0,
          visibleTrades.findIndex(t => t.id === prevTop.id)
        )
      : 0;

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 overflow-hidden ${fullView ? 'h-[500px] py-2' : ''}`}
    >
      <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-rock/5 border-none">
        {isLoading ? (
          Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={`skeleton-trade-${i}`} fullView={fullView} />
          ))
        ) : (
          <>
            {visibleTrades.map((t, i, list) => {
              const next = visibleTrades[i + 1];
              let direction: Direction = 'flat';
              if (next) {
                direction = t.price > next.price ? 'up' : t.price < next.price ? 'down' : 'flat';
              }
              // Key by trade id so rows keep their element as the list shifts
              // (the dissolve must not replay); suffix the rare duplicate id.
              const dupes = list.slice(0, i).filter(o => o.id === t.id).length;
              return (
                <TradeRow
                  key={dupes ? `${t.id}#${dupes}` : t.id}
                  trade={t}
                  direction={direction}
                  fullView={fullView}
                  quoteDecimals={quoteDecimals}
                  baseDecimals={baseDecimals}
                  isNew={i < freshCount}
                />
              );
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
