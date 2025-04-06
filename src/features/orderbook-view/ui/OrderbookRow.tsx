/**
 * Orderbook row component
 * Displays a single row in the orderbook
 */
import { cn } from '../../../shared/lib/utils';
import { formatPrice, formatQuantity } from '../lib/processOrderbook';

type OrderbookRowProps = {
  price: number;
  size: number;
  total: string;
  depth: number;
  side: 'Buy' | 'Sell';
};

export function OrderbookRow({ price, size, total, depth, side }: OrderbookRowProps) {
  return (
    <div className="relative">
      <div
        className={cn(
          'absolute inset-0 opacity-10',
          side === 'Buy' ? 'bg-green-500' : 'bg-red-500'
        )}
        style={{
          width: `${depth}%`,
          [side === 'Buy' ? 'right' : 'left']: 0,
        }}
      />
      <div
        className={cn(
          'tabular-nums font-mono grid grid-cols-8 text-xs px-3 py-1 relative z-10',
          side === 'Buy' ? 'text-green-600' : 'text-red-600'
        )}
      >
        <span className="text-left col-span-2">{formatPrice(price)}</span>
        <span className="text-right col-span-3">{formatQuantity(size)}</span>
        <span className="text-right col-span-3">{total}</span>
      </div>
    </div>
  );
}
