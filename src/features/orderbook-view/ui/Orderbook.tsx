/**
 * Orderbook component
 * Displays the orderbook for the selected market
 */
import { useMemo, useRef, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { orderbookAtom } from '../../../entities/orderbook';
import { OrderbookRow } from './OrderbookRow';
import { isEqual } from 'lodash';

const orderbookRows = 10;
const PRICE_DECIMALS = 9; // 10^9 for price normalization
const DISPLAY_DECIMALS = 4; // Number of decimals to display

type AggregatedOrder = {
  price: number;
  quantity: number;
  total: number; // Cumulative quantity
  volumeTotal: number; // Cumulative price * quantity
  depth: number;
};

type ProcessedOrderbook = {
  buys: (AggregatedOrder | null)[];
  sells: (AggregatedOrder | null)[];
  spread: number;
  lastUpdated: Date;
  maxDepth: number;
};

export function Orderbook() {
  const orderbook = useAtomValue(orderbookAtom);
  const lastProcessedRef = useRef<ProcessedOrderbook | null>(null);

  const aggregateOrders = useCallback((orders: any[], sortFn: (a: number, b: number) => number) => {
    const aggregated = new Map<number, number>();

    orders.forEach(order => {
      const existing = aggregated.get(order.price) || 0;
      aggregated.set(order.price, existing + order.quantity);
    });

    let runningQuantity = 0;
    let runningVolume = 0;

    return Array.from(aggregated.entries())
      .sort(([a], [b]) => sortFn(a, b))
      .slice(0, orderbookRows)
      .map(([price, quantity]) => {
        runningQuantity += quantity;
        runningVolume += quantity * price;
        return {
          price,
          quantity,
          total: runningQuantity,
          volumeTotal: runningVolume,
          depth: 0, // Will be calculated after finding maxDepth
        };
      });
  }, []);

  const processedOrderbook = useMemo(() => {
    if (!orderbook || !orderbook.buys || !orderbook.sells) {
      return (
        lastProcessedRef.current || {
          buys: Array(orderbookRows).fill(null),
          sells: Array(orderbookRows).fill(null),
          spread: 0,
          lastUpdated: new Date(),
          maxDepth: 0,
        }
      );
    }

    // Process buys and sells
    const buys = aggregateOrders(orderbook.buys, (a, b) => b - a); // Descending
    const sells = aggregateOrders(orderbook.sells, (a, b) => a - b); // Ascending

    // Calculate max depth based on cumulative quantity
    const maxDepth = Math.max(
      buys.length > 0 ? buys[buys.length - 1].total : 0,
      sells.length > 0 ? sells[sells.length - 1].total : 0
    );

    // Calculate depth percentages
    const calculateDepth = (orders: AggregatedOrder[]) => {
      orders.forEach(order => {
        order.depth = (order.total / maxDepth) * 100;
      });
    };

    calculateDepth(buys);
    calculateDepth(sells);

    // Fill remaining rows with null
    const filledBuys = [...buys, ...Array(Math.max(0, orderbookRows - buys.length)).fill(null)];
    const filledSells = [...sells, ...Array(Math.max(0, orderbookRows - sells.length)).fill(null)];

    const spread = Math.abs((filledBuys[0]?.price || 0) - (filledSells[0]?.price || 0));

    const processed = {
      buys: filledBuys,
      sells: filledSells,
      spread,
      lastUpdated: orderbook.lastUpdated,
      maxDepth,
    };

    // Only update if the data has actually changed
    if (!isEqual(processed, lastProcessedRef.current)) {
      lastProcessedRef.current = processed;
    }

    return lastProcessedRef.current;
  }, [orderbook, aggregateOrders]);

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
                  price={order.price / 10 ** PRICE_DECIMALS}
                  size={order.quantity / 10 ** PRICE_DECIMALS}
                  total={(order.total / 10 ** PRICE_DECIMALS).toFixed(DISPLAY_DECIMALS)}
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
            {Number(processedOrderbook.spread / 10 ** PRICE_DECIMALS).toFixed(DISPLAY_DECIMALS)}
          </span>
        </div>
        <div className="flex flex-col relative">
          {/* Sell orders */}
          {processedOrderbook.sells.map((order, index) =>
            order ? (
              <OrderbookRow
                key={`sell-${order.price}`}
                price={order.price / 10 ** PRICE_DECIMALS}
                size={order.quantity / 10 ** PRICE_DECIMALS}
                total={(order.total / 10 ** PRICE_DECIMALS).toFixed(DISPLAY_DECIMALS)}
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
