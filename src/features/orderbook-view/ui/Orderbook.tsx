/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useMemo, useRef } from 'react';
import { OrderbookRow } from './OrderbookRow';
import { isEqual } from 'lodash';
import { processOrderbook, formatPrice } from '../lib/processOrderbook';
import { useOrderbook } from '@/entities/orderbook';

const orderbookRows = 10;

export function Orderbook() {
  const { orderbook, useOrderbookQuery } = useOrderbook();
  const lastProcessedRef = useRef<ReturnType<typeof processOrderbook> | null>(null);

  // Setup orderbook polling
  useOrderbookQuery();

  const processedOrderbook = useMemo(() => {
    const processed = processOrderbook(orderbook, orderbookRows);

    // Only update if the data has actually changed
    if (!isEqual(processed, lastProcessedRef.current)) {
      lastProcessedRef.current = processed;
    }

    return lastProcessedRef.current;
  }, [orderbook]);

  if (!processedOrderbook) return null;

  return (
    <div className="flex flex-col h-full border border-border rounded-lg w-xs overflow-hidden">
      <h2 className="text-lg font-medium px-3 py-1 border-b border-border">Orderbook</h2>
      <div className="grid grid-cols-3 text-xs font-medium border-b border-border px-3 py-1.5 bg-neutral-100 text-neutral-600">
        <span className="text-left">Price</span>
        <span className="text-center">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex flex-col justify-between flex-1">
        <div className="flex flex-col justify-end relative">
          {/* Buy orders */}
          {processedOrderbook.buys
            .reverse()
            .map((order, index) =>
              order ? (
                <OrderbookRow
                  key={`buy-${order.price}`}
                  price={order.price / 10 ** 9}
                  size={order.quantity / 10 ** 9}
                  total={formatPrice(order.total)}
                  depth={order.depth}
                  side="Buy"
                />
              ) : (
                <div key={`buy-order-placeholder-${index}`} className="h-6" />
              )
            )}
        </div>
        <div className="flex text-sm bg-neutral-100 px-3 py-1.5 justify-between">
          <span>Spread</span>
          <span className="tabular-nums font-mono font-medium">
            {formatPrice(processedOrderbook.spread)}
          </span>
        </div>
        <div className="flex flex-col relative">
          {/* Sell orders */}
          {processedOrderbook.sells.map((order, index) =>
            order ? (
              <OrderbookRow
                key={`sell-${order.price}`}
                price={order.price / 10 ** 9}
                size={order.quantity / 10 ** 9}
                total={formatPrice(order.total)}
                depth={order.depth}
                side="Sell"
              />
            ) : (
              <div key={`sell-order-placeholder-${index}`} className="h-6" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
