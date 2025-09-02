/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useEffect, useMemo, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { isEqual } from 'lodash';

import { selectedMarketAtom } from '@/entities/market';
import { useOrderbook } from '@/entities/orderbook';
import { processOrderbook, formatPrice } from '../lib/processOrderbook';

import { OrderbookRow } from './OrderbookRow';
import { Trades } from './Trades';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const orderbookRows = 12;

export function Orderbook() {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const { orderbook, loadOrderbook } = useOrderbook();
  const lastProcessedRef = useRef<ReturnType<typeof processOrderbook> | null>(null);

  // Setup orderbook polling
  useQuery({
    queryKey: ['orderbook', selectedMarket?.uuid],
    queryFn: loadOrderbook,
    refetchInterval: 1000,
    enabled: !!selectedMarket?.uuid,
  });

  // Process orderbook with memoization to prevent unnecessary re-renders
  const processedOrderbook = useMemo(() => {
    const processed = processOrderbook(orderbook, orderbookRows, undefined);

    // Only update if the data has actually changed
    if (!isEqual(processed, lastProcessedRef.current)) {
      lastProcessedRef.current = processed;
    }

    return lastProcessedRef.current;
  }, [orderbook]);

  useEffect(() => {
    if (selectedMarket) {
      // Orderbook effect
    }
  }, [selectedMarket, processedOrderbook]);

  if (!processedOrderbook) return null;

  return (
    <div className="w-[360px]">
      {/* Tabs Header */}
      <Tabs defaultValue="orderbook" className="h-full">
        <TabsList className="border-b border-outline w-full   ">
          <TabsTrigger value="orderbook" className="flex-1">
            Orderbook
          </TabsTrigger>
          <TabsTrigger value="trades" className="flex-1">
            Trades
          </TabsTrigger>
        </TabsList>

        {/* Orderbook Tab */}
        <TabsContent value="orderbook">
          {/* Column Headers */}
          <div className="grid grid-cols-3 px-4 py-2 text-xs bg-card border-b border-outline shrink-0">
            <div className="text-left font-mono">Price</div>
            <div className="text-right font-mono">Size</div>
            <div className="text-right font-mono">Total</div>
          </div>

          {/* Orderbook Content */}
          <div className="flex flex-col h-[500px] overflow-hidden">
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
                  />
                ) : (
                  <div key={`empty-sell-${i}`} className="h-[26px]" />
                )
              )}
            </div>

            {/* Spread */}
            <div className="px-4 py-2 text-xs flex justify-between items-center shrink-0 bg-card border-y border-outline">
              <span>Spread</span>
              <span className="font-mono">{formatPrice(processedOrderbook.spread)}</span>
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
                  />
                ) : (
                  <div key={`empty-buy-${i}`} className="h-[26px]" />
                )
              )}
            </div>
          </div>
        </TabsContent>

        {/* Trades Tab */}
        <TabsContent value="trades">
          {/* Column Headers (same as orderbook for consistent layout) */}
          <div className="grid grid-cols-3 px-4 py-2 text-xs bg-card border-b border-outline shrink-0">
            <div className="text-left font-mono">Price</div>
            <div className="text-right font-mono">Size</div>
            <div className="text-right font-mono">Total</div>
          </div>

          {/* Trades Content: use same rows as Orderbook for consistency */}
          <Trades rows={20} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
