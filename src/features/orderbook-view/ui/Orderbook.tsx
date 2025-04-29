/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useMemo, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { selectedMarketAtom } from '@/entities/market';
import { useOrderbook } from '@/entities/orderbook';
import { formatPrice, processOrderbook } from '../lib/processOrderbook';
import { OrderbookRow } from './OrderbookRow';
import { QuantityThresholdSelector } from './QuantityThresholdSelector';
import { quantityThresholdAtom } from '../model/orderbook';
import { useQuery } from '@tanstack/react-query';
import { isEqual } from 'lodash';

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

  if (!selectedMarket) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a market to view orderbook
      </div>
    );
  }

  if (!processedOrderbook) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading orderbook...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] w-[360px] bg-background border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <h2 className="text-lg font-medium">Orderbook</h2>
        <QuantityThresholdSelector />
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border shrink-0">
        <div className="w-[100px]">Price</div>
        <div className="text-right w-[100px]">Size</div>
        <div className="text-right w-[100px]">Total</div>
      </div>

      {/* Orderbook Content */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col divide-y divide-border">
        {/* Sells (asks) */}
        <div className="flex-1 flex flex-col-reverse min-h-0">
          {processedOrderbook.sells
            .slice()
            .map((order, i) =>
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
        <div className="px-4 py-2 text-xs text-muted-foreground bg-accent/5 flex justify-between items-center shrink-0">
          <span>Spread</span>
          <span className="font-mono">{formatPrice(processedOrderbook.spread)}</span>
        </div>

        {/* Buys (bids) */}
        <div className="flex-1 flex flex-col min-h-0">
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
