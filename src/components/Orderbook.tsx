import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { useBids } from '@/hooks/useBids';
import { useAsks } from '@/hooks/useAsks';
import { BN } from '@coral-xyz/anchor';

/**
 * OrderRow component to display individual orders in the orderbook
 */
interface OrderRowProps {
  price: string;
  size: string;
  total: string;
  side: 'buy' | 'sell';
}

const OrderRow: React.FC<OrderRowProps> = ({ price, size, total, side }) => (
  <div
    className={cn(
      'grid grid-cols-3 text-sm py-1 px-2 hover:bg-zinc-100 cursor-pointer',
      side === 'buy' ? 'text-green-600' : 'text-red-600'
    )}
  >
    <span>{price}</span>
    <span className="text-center">{size}</span>
    <span className="text-right">{total}</span>
  </div>
);

/**
 * Orderbook component displays buy and sell orders in a structured format
 */
interface OrderbookProps {
  className?: string;
  maxRows?: number;
}

const Orderbook: React.FC<OrderbookProps> = ({ className, maxRows = 8 }) => {
  const { data: bidsData, isLoading: bidsLoading } = useBids();
  const { data: asksData, isLoading: asksLoading } = useAsks();

  /**
   * Process orderbook data and calculate spread
   */
  const { bids, asks, spread } = useMemo(() => {
    if (!bidsData || !asksData) {
      return {
        bids: [],
        asks: [],
        spread: 0,
      };
    }

    // Sort and limit the number of orders shown
    const processedBids = bidsData
      .sort((a, b) => b.price - a.price)
      .slice(0, maxRows)
      .map(bid => ({
        price: bid.price,
        size: bid.quantity,
        total: new BN(bid.price).mul(new BN(bid.quantity)).toString(),
      }));

    const processedAsks = asksData
      .sort((a, b) => a.price - b.price)
      .slice(0, maxRows)
      .map(ask => ({
        price: ask.price,
        size: ask.quantity,
        total: new BN(ask.price).mul(new BN(ask.quantity)).toString(),
      }));

    // Calculate spread
    const spreadValue =
      processedAsks[0]?.price && processedBids[0]?.price
        ? processedAsks[0].price - processedBids[0].price
        : 0;

    return {
      bids: processedBids,
      asks: processedAsks,
      spread: spreadValue,
    };
  }, [bidsData, asksData, maxRows]);

  // Show loading state
  if (bidsLoading || asksLoading) {
    return (
      <div
        className={cn(
          'w-full max-w-sm bg-zinc-100 border border-zinc-300 rounded-lg p-1',
          className
        )}
      >
        <div className="bg-white flex flex-col gap-2 border border-zinc-300 rounded-md shadow-lg p-4">
          <h6 className="heading">Orderbook</h6>
          <div className="text-center py-8 text-zinc-500">Loading orderbook...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('w-full max-w-sm bg-zinc-100 border border-zinc-300 rounded-lg p-1', className)}
    >
      <div className="bg-white flex flex-col gap-2 border border-zinc-300 rounded-md shadow-lg p-4">
        <h6 className="heading">Orderbook</h6>

        {/* Header */}
        <div className="grid grid-cols-3 text-xs text-zinc-500 font-semibold border-b border-zinc-200 pb-2">
          <span>PRICE</span>
          <span className="text-center">SIZE</span>
          <span className="text-right">TOTAL</span>
        </div>

        {/* Asks (Sell Orders) - Displayed in reverse order */}
        <div className="flex flex-col">
          {asks
            .slice()
            .reverse()
            .map((ask, index) => (
              <OrderRow
                key={`ask-${index}`}
                price={ask.price}
                size={ask.size}
                total={ask.total}
                side="sell"
              />
            ))}
        </div>

        {/* Spread */}
        <div className="text-center text-sm text-zinc-500 border-y border-zinc-200 py-1">
          Spread: {spread.toFixed(2)}
        </div>

        {/* Bids (Buy Orders) */}
        <div className="flex flex-col">
          {bids.map((bid, index) => (
            <OrderRow
              key={`bid-${index}`}
              price={bid.price}
              size={bid.size}
              total={bid.total}
              side="buy"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Orderbook;
