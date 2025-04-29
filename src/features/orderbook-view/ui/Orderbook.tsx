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
import { quantityThresholdAtom } from '../model/orderbook';
import { processOrderbook, formatPrice } from '../lib/processOrderbook';

import { OrderbookRow } from './OrderbookRow';
import { QuantityThresholdSelector } from './QuantityThresholdSelector';

const orderbookRows = 12;

export function Orderbook() {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const threshold = useAtomValue(quantityThresholdAtom);
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
    const processed = processOrderbook(orderbook, orderbookRows, undefined, threshold);

    // Only update if the data has actually changed
    if (!isEqual(processed, lastProcessedRef.current)) {
      lastProcessedRef.current = processed;
    }

    return lastProcessedRef.current;
  }, [orderbook, threshold]);

  useEffect(() => {
    if (selectedMarket) {
      console.debug('orderbook', processedOrderbook);
    }
  }, [selectedMarket, processedOrderbook]);

  if (!processedOrderbook) return null;

  return (
    <div className="rounded-md border w-[360px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3  rounded-t-md">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Orderbook</h2>
          <span className="text-xs text-muted-foreground">
            ({selectedMarket?.baseTokenName}/{selectedMarket?.quoteTokenName})
          </span>
        </div>
        <QuantityThresholdSelector />
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 px-4 py-2 text-xs text-muted-foreground bg-accent border-y border-border shrink-0">
        <div className="text-left font-mono">Price</div>
        <div className="text-right font-mono">Size</div>
        <div className="text-right font-mono">Total</div>
      </div>

      {/* Orderbook Content */}
      <div className="flex flex-col h-[500px] overflow-hidden">
        {/* Sells (asks) */}
        <div className="flex-1 flex flex-col-reverse overflow-y-auto">
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
        <div className="px-4 py-2 text-xs text-muted-foreground bg-muted flex justify-between items-center shrink-0">
          <span>Spread</span>
          <span className="font-mono">{formatPrice(processedOrderbook.spread)}</span>
        </div>

        {/* Buys (bids) */}
        <div className="flex-1 flex flex-col overflow-y-auto">
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
    </div>
  );
}
