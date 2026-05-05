/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { sseConnectionStateAtom } from '@/shared/api/sse-atoms';

import { useSelectedMarket } from '@/entities/market';
import { useOrderbook } from '@/entities/orderbook';
import { processOrderbook, formatPrice } from '../lib/processOrderbook';

import { OrderbookRow } from './OrderbookRow';
import { Trades } from './Trades';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ConnectionIndicator } from '@/shared/ui/ConnectionIndicator';

// Pixel sizes used to size rows / chrome. Keep in sync with the row/header
// classNames below — these drive the dynamic row-count math.
const ROW_HEIGHT_PX = 26;
const HEADER_PX = 36; // column headers row (px-4 py-2 + text-xs)
const SPREAD_PX = 36; // spread bar between asks and bids
const MIN_ROWS_PER_SIDE = 5;
const MAX_ROWS_PER_SIDE = 30;

export function Orderbook() {
  const { selectedMarket } = useSelectedMarket();
  const { orderbook } = useOrderbook();
  const { publicKey } = useWallet();
  const connectionState = useAtomValue(sseConnectionStateAtom);
  const lastProcessedRef = useRef<ReturnType<typeof processOrderbook> | null>(null);
  const showTradesTab = !!publicKey;
  const isLoading =
    connectionState === 'connecting' && orderbook.bids.length === 0 && orderbook.asks.length === 0;

  // Dynamic row count — measured from the available content height. The Tabs
  // wrapper fills its parent (chart sets the height in lg layout), so we
  // measure the wrapper and subtract chrome to compute how many rows fit.
  const tabContentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    const node = tabContentRef.current;
    if (!node) return;
    const update = () => setContentHeight(node.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const orderbookRows = useMemo(() => {
    if (contentHeight <= 0) return 10;
    const usable = contentHeight - HEADER_PX - SPREAD_PX;
    const perSide = Math.floor(usable / 2 / ROW_HEIGHT_PX);
    return Math.max(MIN_ROWS_PER_SIDE, Math.min(MAX_ROWS_PER_SIDE, perSide));
  }, [contentHeight]);

  const tradesRows = useMemo(() => {
    if (contentHeight <= 0) return 20;
    const usable = contentHeight - HEADER_PX;
    return Math.max(MIN_ROWS_PER_SIDE * 2, Math.floor(usable / ROW_HEIGHT_PX));
  }, [contentHeight]);

  // Process orderbook with memoization to prevent unnecessary re-renders
  const processedOrderbook = useMemo(() => {
    const processed = processOrderbook(
      orderbook,
      orderbookRows,
      undefined, // lastTradedPrice - not available in orderbook model
      undefined,
      selectedMarket?.quoteTokenName,
      selectedMarket?.baseTokenName,
      selectedMarket?.quoteDecimals,
      selectedMarket?.baseDecimals
    );

    // Only update if the data has actually changed
    if (!isEqual(processed, lastProcessedRef.current)) {
      lastProcessedRef.current = processed;
    }

    return lastProcessedRef.current;
  }, [
    orderbook,
    orderbookRows,
    selectedMarket?.quoteTokenName,
    selectedMarket?.baseTokenName,
    selectedMarket?.baseDecimals,
    selectedMarket?.quoteDecimals,
  ]);

  const ROW_HEIGHT_CLASS = 'h-[26px]';
  // Side height = orderbookRows × ROW_HEIGHT_PX, recomputed whenever the
  // measured container resizes. Keeps bids and asks equally sized and packed
  // tightly without overflow scrollbars.
  const SIDE_HEIGHT_PX = orderbookRows * ROW_HEIGHT_PX;

  function SkeletonOrderbookRow() {
    return (
      <div className={`relative font-medium w-full select-none ${ROW_HEIGHT_CLASS}`}>
        <div className="relative z-10 px-4 h-full flex items-center">
          <div className="grid grid-cols-3 gap-4 items-center font-mono text-xs leading-none tracking-tight w-full">
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
          </div>
        </div>
      </div>
    );
  }

  if (!selectedMarket) return null;

  const orderbookContent = (
    <>
      {/* Column Headers */}
      <div className="grid grid-cols-3 px-4 py-2 text-xs bg-card border-b border-outline shrink-0">
        <div className="text-left font-mono flex items-center gap-1.5">
          Price <ConnectionIndicator />
        </div>
        <div className="text-right font-mono">Size</div>
        <div className="text-right font-mono">Total</div>
      </div>

      {/* Orderbook Content */}
      <div className="flex flex-col">
        {isLoading || !processedOrderbook ? (
          <>
            {/* Skeleton Sells (asks) */}
            <div className="flex flex-col-reverse shrink-0" style={{ height: SIDE_HEIGHT_PX }}>
              {Array.from({ length: orderbookRows }).map((_, i) => (
                <SkeletonOrderbookRow key={`skeleton-sell-${i}`} />
              ))}
            </div>

            {/* Spread skeleton */}
            <div className="px-4 py-2 text-xs flex justify-between items-center shrink-0 bg-card border-y border-outline">
              <span>Spread</span>
              <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
            </div>

            {/* Skeleton Buys (bids) */}
            <div className="flex flex-col shrink-0" style={{ height: SIDE_HEIGHT_PX }}>
              {Array.from({ length: orderbookRows }).map((_, i) => (
                <SkeletonOrderbookRow key={`skeleton-buy-${i}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Sells (asks) */}
            <div className="flex flex-col-reverse shrink-0" style={{ height: SIDE_HEIGHT_PX }}>
              {processedOrderbook.sells.map((order, i) =>
                order ? (
                  <OrderbookRow
                    key={`${order.price}-${i}`}
                    price={order.price}
                    size={order.quantity}
                    depth={order.depth}
                    side="Sell"
                    quoteDecimals={selectedMarket.quoteDecimals}
                    baseDecimals={selectedMarket.baseDecimals}
                  />
                ) : (
                  <div key={`empty-sell-${i}`} className={ROW_HEIGHT_CLASS} />
                )
              )}
            </div>

            {/* Spread */}
            <div className="px-4 py-2 text-xs flex justify-between items-center shrink-0 bg-card border-y border-outline">
              <span>Spread</span>
              <span className="font-mono">
                {formatPrice(processedOrderbook.spread, selectedMarket.quoteDecimals)}
              </span>
            </div>

            {/* Buys (bids) */}
            <div className="flex flex-col shrink-0" style={{ height: SIDE_HEIGHT_PX }}>
              {processedOrderbook.buys.map((order, i) =>
                order ? (
                  <OrderbookRow
                    key={`${order.price}-${i}`}
                    price={order.price}
                    size={order.quantity}
                    depth={order.depth}
                    side="Buy"
                    quoteDecimals={selectedMarket.quoteDecimals}
                    baseDecimals={selectedMarket.baseDecimals}
                  />
                ) : (
                  <div key={`empty-buy-${i}`} className={ROW_HEIGHT_CLASS} />
                )
              )}
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="w-full lg:w-[360px] h-full flex flex-col">
      {/* Tabs Header */}
      <Tabs defaultValue="orderbook" className="flex flex-col flex-1 min-h-0">
        <TabsList className="border-b border-outline w-full">
          <TabsTrigger value="orderbook" className="flex-1">
            Orderbook
          </TabsTrigger>
          {showTradesTab && (
            <TabsTrigger value="trades" className="flex-1">
              Trades
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab content area — measured to drive dynamic row counts. */}
        <div ref={tabContentRef} className="flex-1 min-h-0">
          {/* Orderbook Tab */}
          <TabsContent value="orderbook">{orderbookContent}</TabsContent>

          {/* Trades Tab - only show when wallet is connected */}
          {showTradesTab && (
            <TabsContent value="trades">
              {/* Column Headers (same as orderbook for consistent layout) */}
              <div className="grid grid-cols-3 px-4 py-2 text-xs bg-card border-b border-outline shrink-0">
                <div className="text-left font-mono">Price</div>
                <div className="text-right font-mono">Size</div>
                <div className="text-right font-mono">Total</div>
              </div>

              <Trades rows={tradesRows} fullView={false} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
