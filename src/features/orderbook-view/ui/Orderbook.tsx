/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isEqual } from 'lodash';
import { useWallet } from '@solana/wallet-adapter-react';

import { useSelectedMarket } from '@/entities/market';
import { useOrderbook } from '@/entities/orderbook';
import { processOrderbook, formatPrice } from '../lib/processOrderbook';

import { OrderbookRow } from './OrderbookRow';
import { Trades } from './Trades';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const orderbookRows = 10;

export function Orderbook() {
  const { selectedMarket } = useSelectedMarket();
  const { orderbook, loadOrderbook } = useOrderbook();
  const { publicKey } = useWallet();
  const lastProcessedRef = useRef<ReturnType<typeof processOrderbook> | null>(null);
  const showTradesTab = !!publicKey; // Hide trades tab when wallet not connected (shown in PortfolioTabs instead)

  // Setup orderbook polling
  const { isLoading } = useQuery({
    queryKey: ['orderbook', selectedMarket?.uuid],
    queryFn: loadOrderbook,
    refetchInterval: 500,
    enabled: !!selectedMarket?.uuid,
  });

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
    selectedMarket?.quoteTokenName,
    selectedMarket?.baseTokenName,
    selectedMarket?.baseDecimals,
    selectedMarket?.quoteDecimals,
  ]);

  useEffect(() => {
    if (selectedMarket) {
      // Orderbook effect
    }
  }, [selectedMarket, processedOrderbook]);

  const ROW_HEIGHT_CLASS = 'h-[26px]';

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
        <div className="text-left font-mono">Price</div>
        <div className="text-right font-mono">Size</div>
        <div className="text-right font-mono">Total</div>
      </div>

      {/* Orderbook Content */}
      <div className="flex flex-col h-[300px] md:h-[400px] lg:h-[500px] overflow-hidden">
        {isLoading || !processedOrderbook ? (
          <>
            {/* Skeleton Sells (asks) */}
            <div className="flex-1 flex flex-col-reverse overflow-y-auto border-none">
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
            <div className="flex-1 flex flex-col overflow-y-auto border-none">
              {Array.from({ length: orderbookRows }).map((_, i) => (
                <SkeletonOrderbookRow key={`skeleton-buy-${i}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Sells (asks) */}
            <div className="flex-1 flex flex-col-reverse overflow-y-auto border-none">
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
            <div className="flex-1 flex flex-col overflow-y-auto border-none">
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
    <div className="w-full lg:w-[360px]">
      {/* Tabs Header */}
      <Tabs defaultValue="orderbook" className="h-full">
        <TabsList className="border-b border-outline w-full   ">
          <TabsTrigger value="orderbook" className="flex-1">
            Orderbook
          </TabsTrigger>
          {showTradesTab && (
            <TabsTrigger value="trades" className="flex-1">
              Trades
            </TabsTrigger>
          )}
        </TabsList>

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

            {/* Trades Content: use same rows as Orderbook for consistency */}
            <Trades rows={20} fullView={false} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
