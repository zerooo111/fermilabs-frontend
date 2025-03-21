import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import orderbookAtom from '@/atoms/orderbook';
import OrderbookRow from './OrderbookRow';

const orderbookRows = 10;

export default function Orderbook() {
  const orderbook = useAtomValue(orderbookAtom);

  const processedOrderbook = useMemo(() => {
    if (!orderbook)
      return {
        buys: Array(orderbookRows).fill(null),
        sells: Array(orderbookRows).fill(null),
        spread: 0,
        lastUpdated: new Date(),
      };

    // // Aggregate buys by price
    // const aggregatedBuys = orderbook.buys.reduce(
    //   (acc, order) => {
    //     acc[order.price] = (acc[order.price] || 0) + order.quantity;
    //     return acc;
    //   },
    //   {} as Record<number, number>
    // );

    // // Aggregate sells by price
    // const aggregatedSells = orderbook.sells.reduce(
    //   (acc, order) => {
    //     acc[order.price] = (acc[order.price] || 0) + order.quantity;
    //     return acc;
    //   },
    //   {} as Record<number, number>
    // );

    // Convert aggregated data back to arrays
    const sortedBuys = orderbook.buys.sort((a, b) => b.price - a.price); // Sort buys in descending order

    const sortedSells = orderbook.sells.sort((a, b) => a.price - b.price); // Sort sells in ascending order

    const buys = [
      ...sortedBuys.slice(0, orderbookRows),
      ...Array(Math.max(0, orderbookRows - sortedBuys.length)).fill(null),
    ];
    const sells = [
      ...sortedSells.slice(0, orderbookRows),
      ...Array(Math.max(0, orderbookRows - sortedSells.length)).fill(null),
    ];

    const spread = Math.abs((buys[0]?.price || 0) - (sells[0]?.price || 0));

    return {
      buys,
      sells,
      spread,
      lastUpdated: orderbook.lastUpdated,
    };
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
      <div className="flex flex-col justify-between  flex-1/3">
        <div className="flex flex-col justify-end">
          {/* Buy orders */}
          {processedOrderbook?.buys
            .reverse()
            .map((order, index) =>
              order ? (
                <OrderbookRow
                  key={`buy-order-${order.order_id}`}
                  price={order.price / 10 ** 9}
                  size={order.quantity / 10 ** 9}
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
            {Number(processedOrderbook?.spread / 10 ** 9).toFixed(4)}
          </span>
        </div>
        <div className="flex flex-col">
          {/* Sell orders */}
          {processedOrderbook?.sells.map((order, index) =>
            order ? (
              <OrderbookRow
                key={`sell-order-${order.order_id}`}
                price={order?.price / 10 ** 9}
                size={order?.quantity / 10 ** 9}
                side="Sell"
              />
            ) : (
              <span key={`sell-order-placeholder-${index}`} className="h-6" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
