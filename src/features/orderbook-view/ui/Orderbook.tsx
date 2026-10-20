/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { orderbookConnectionStateAtom } from '@/shared/api/sse-atoms';

import { useSelectedMarket } from '@/entities/market';
import { useOrderbook } from '@/entities/orderbook';
import { processOrderbook, formatPrice } from '../lib/processOrderbook';
import { quantityThresholdAtom } from '../model/orderbook';

import { OrderbookRow } from './OrderbookRow';
import { DepthModeSelector } from './DepthModeSelector';
import { QuantityThresholdSelector } from './QuantityThresholdSelector';
import { Trades } from './Trades';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ConnectionIndicator } from '@/shared/ui/ConnectionIndicator';

// Pixel sizes used to size rows / chrome. Keep in sync with the row/header
// classNames below — these drive the dynamic row-count math.
const TAB_TRIGGER_CLASS = 'flex-1';

const ROW_HEIGHT_PX = 22;
const TOOLBAR_PX = 28; // depth-mode / size-filter bar (h-7, border inside)
const HEADER_PX = 28; // column headers row (h-7, border inside)
const SPREAD_PX = 28; // spread bar between asks and bids (h-7, borders inside)
const MIN_ROWS_PER_SIDE = 5;
const MAX_ROWS_PER_SIDE = 30;

/**
 * `standalone` is used inside a dock pane: the parent owns the width and the
 * Orderbook/Trades tab strip is dropped (Trades is its own widget there).
 */
export function Orderbook({ standalone = false }: { standalone?: boolean } = {}) {
  const { selectedMarket } = useSelectedMarket();
  const { orderbook } = useOrderbook();
  const { publicKey } = useWallet();
  const connectionState = useAtomValue(orderbookConnectionStateAtom);
  const quantityThreshold = useAtomValue(quantityThresholdAtom);
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

  // Each side takes half the space below the chrome. Rows are floored to
  // whole ROW_HEIGHT_PX slots and then stretched over the leftover (under one
  // row per side), so the bids reach the bottom edge instead of leaving a gap.
  const { orderbookRows, sideHeight } = useMemo(() => {
    if (contentHeight <= 0) return { orderbookRows: 10, sideHeight: 10 * ROW_HEIGHT_PX };
    const half = Math.floor((contentHeight - TOOLBAR_PX - HEADER_PX - SPREAD_PX) / 2);
    const rows = Math.max(
      MIN_ROWS_PER_SIDE,
      Math.min(MAX_ROWS_PER_SIDE, Math.floor(half / ROW_HEIGHT_PX))
    );
    const height = Math.max(rows * ROW_HEIGHT_PX, Math.min(half, (rows + 1) * ROW_HEIGHT_PX - 1));
    return { orderbookRows: rows, sideHeight: height };
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
      quantityThreshold,
      selectedMarket?.baseDecimals
    );

    // Only update if the data has actually changed
    if (!isEqual(processed, lastProcessedRef.current)) {
      lastProcessedRef.current = processed;
    }

    return lastProcessedRef.current;
  }, [orderbook, orderbookRows, quantityThreshold, selectedMarket?.baseDecimals]);

  const ROW_HEIGHT_CLASS = 'h-[22px]';

  function SkeletonOrderbookRow() {
    return (
      <div className={`relative w-full select-none ${ROW_HEIGHT_CLASS}`}>
        <div className="relative z-10 px-3 h-full flex items-center">
          <div className="grid grid-cols-3 gap-4 items-center font-mono text-xs leading-none tracking-tight w-full">
            {/* Price skeleton */}
            <div className="text-left">
              <div className="h-3 w-16 bg-rock/10 animate-pulse" />
            </div>
            {/* Size skeleton */}
            <div className="text-right">
              <div className="h-3 w-12 bg-rock/10 animate-pulse ml-auto" />
            </div>
            {/* Total skeleton */}
            <div className="text-right">
              <div className="h-3 w-14 bg-rock/10 animate-pulse ml-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** Slot past the last level on a side: dashes keep the column rhythm so a
   * thin book reads as "no orders here" rather than a blank gap. */
  function EmptyOrderbookRow() {
    return (
      <div className={`relative w-full select-none ${ROW_HEIGHT_CLASS}`}>
        <div className="grid grid-cols-3 gap-4 items-center px-3 h-full font-mono text-xs leading-none text-rock/20">
          <div className="text-left">—</div>
          <div className="text-right">—</div>
          <div className="text-right">—</div>
        </div>
      </div>
    );
  }

  if (!selectedMarket) return null;

  const isCumulative = orderbook.depthMode === 'cumulative';

  const orderbookContent = (
    <>
      {/* Depth mode + min size */}
      <div className="flex items-center justify-between h-7 px-1 border-b border-outline shrink-0 text-rock/70">
        <DepthModeSelector />
        <QuantityThresholdSelector />
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 h-7 items-center px-3 text-[11px] text-rock/50 bg-card border-b border-outline shrink-0">
        <div className="text-left font-mono flex items-center gap-1.5">
          Price <ConnectionIndicator />
        </div>
        <div className="text-right font-mono">{isCumulative ? 'Cum. Size' : 'Size'}</div>
        <div className="text-right font-mono">{isCumulative ? 'Cum. Total' : 'Total'}</div>
      </div>

      {/* Orderbook Content */}
      <div className="flex flex-col">
        {isLoading || !processedOrderbook ? (
          <>
            {/* Skeleton Sells (asks) */}
            <div className="flex flex-col-reverse shrink-0 *:flex-1" style={{ height: sideHeight }}>
              {Array.from({ length: orderbookRows }).map((_, i) => (
                <SkeletonOrderbookRow key={`skeleton-sell-${i}`} />
              ))}
            </div>

            {/* Spread skeleton */}
            <div className="h-7 px-3 text-xs flex justify-between items-center shrink-0 bg-card border-y border-outline">
              <span>Spread</span>
              <div className="h-3 w-16 bg-rock/10 animate-pulse" />
            </div>

            {/* Skeleton Buys (bids) */}
            <div className="flex flex-col shrink-0 *:flex-1" style={{ height: sideHeight }}>
              {Array.from({ length: orderbookRows }).map((_, i) => (
                <SkeletonOrderbookRow key={`skeleton-buy-${i}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Sells (asks) */}
            <div className="flex flex-col-reverse shrink-0 *:flex-1" style={{ height: sideHeight }}>
              {processedOrderbook.sells.map((order, i) =>
                order ? (
                  <OrderbookRow
                    key={order.price}
                    price={order.price}
                    size={order.quantity}
                    levelSize={order.levelQuantity}
                    total={order.total}
                    depth={order.depth}
                    side="Sell"
                    quoteDecimals={selectedMarket.quoteDecimals}
                    baseDecimals={selectedMarket.baseDecimals}
                  />
                ) : (
                  <EmptyOrderbookRow key={`empty-sell-${i}`} />
                )
              )}
            </div>

            {/* Spread */}
            <div className="h-7 px-3 text-xs flex justify-between items-center shrink-0 bg-card border-y border-outline">
              <span>Spread</span>
              <span className="font-mono">
                {formatPrice(processedOrderbook.spread, selectedMarket.quoteDecimals)}
              </span>
            </div>

            {/* Buys (bids) */}
            <div className="flex flex-col shrink-0 *:flex-1" style={{ height: sideHeight }}>
              {processedOrderbook.buys.map((order, i) =>
                order ? (
                  <OrderbookRow
                    key={order.price}
                    price={order.price}
                    size={order.quantity}
                    levelSize={order.levelQuantity}
                    total={order.total}
                    depth={order.depth}
                    side="Buy"
                    quoteDecimals={selectedMarket.quoteDecimals}
                    baseDecimals={selectedMarket.baseDecimals}
                  />
                ) : (
                  <EmptyOrderbookRow key={`empty-buy-${i}`} />
                )
              )}
            </div>
          </>
        )}
      </div>
    </>
  );

  if (standalone) {
    return (
      <div className="w-full h-full flex flex-col">
        <div ref={tabContentRef} className="flex-1 min-h-0">
          {orderbookContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-[360px] h-full flex flex-col">
      {/* Tabs Header */}
      <Tabs defaultValue="orderbook" className="flex flex-col flex-1 min-h-0">
        <TabsList className="border-b border-outline w-full">
          <TabsTrigger value="orderbook" className={TAB_TRIGGER_CLASS}>
            Orderbook
          </TabsTrigger>
          {showTradesTab && (
            <TabsTrigger value="trades" className={TAB_TRIGGER_CLASS}>
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
              <div className="grid grid-cols-3 h-7 items-center px-3 text-[11px] text-rock/50 bg-card border-b border-outline shrink-0">
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
