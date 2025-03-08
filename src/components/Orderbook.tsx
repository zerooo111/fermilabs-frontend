import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { useBids } from '@/hooks/useBids';
import { useAsks } from '@/hooks/useAsks';
import { BN } from '@coral-xyz/anchor';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';

/**
 * Orderbook component displays buy and sell orders in a structured format
 */
interface OrderbookProps {
  className?: string;
  maxRows?: number;
}

const Orderbook: React.FC<OrderbookProps> = ({ className, maxRows = 10 }) => {
  const { data: bidsData, isLoading: bidsLoading } = useBids();
  const { data: asksData, isLoading: asksLoading } = useAsks();

  /**
   * Process orderbook data and calculate spread
   */
  const { bids, asks, spread } = useMemo(() => {
    const bids = Array(maxRows).fill({ price: 0, size: 0, total: '0' });
    const asks = Array(maxRows).fill({ price: 0, size: 0, total: '0' });

    if (!bidsData || !asksData) {
      return {
        bids,
        asks,
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
      bids: [...bids.slice(0, maxRows - processedBids.length), ...processedBids].reverse(),
      asks: [...asks.slice(0, maxRows - processedAsks.length), ...processedAsks],
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
    <div className={cn('w-full card-outer', className)}>
      <div className="h-full bg-white flex flex-col gap-2 border border-zinc-300 rounded-md shadow-lg p-4">
        <h6 className="heading">Orderbook</h6>

        <div className="rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price</TableHead>
                <TableHead className="text-center">Size</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            {/* Asks (Sell orders) in reverse order */}
            <TableBody>
              {asks
                .slice()
                .reverse()
                .map((ask, index) => (
                  <TableRow key={`ask-${index}`}>
                    <TableCell className="text-red-500">{ask.price}</TableCell>
                    <TableCell className="text-center">{ask.size}</TableCell>
                    <TableCell className="text-right">{ask.total}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
            {/* Spread row */}
            <TableBody>
              <TableRow className="bg-zinc-100">
                <TableCell colSpan={3} className="text-center text-sm text-zinc-500">
                  Spread: {spread.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
            {/* Bids (Buy orders) */}
            <TableBody>
              {bids.map((bid, index) => (
                <TableRow key={`bid-${index}`}>
                  <TableCell className="text-emerald-500">{bid.price}</TableCell>
                  <TableCell className="text-center">{bid.size}</TableCell>
                  <TableCell className="text-right">{bid.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Orderbook;
