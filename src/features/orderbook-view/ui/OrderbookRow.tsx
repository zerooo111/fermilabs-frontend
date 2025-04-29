/**
 * Orderbook row component
 * Displays a single row in the orderbook
 */
import { cn } from '../../../shared/lib/utils';
import { formatPrice, formatQuantity, formatTotal } from '../lib/processOrderbook';

type OrderbookRowProps = {
  price: number;
  size: number;
  depth: number;
  side: 'Buy' | 'Sell';
};

export function OrderbookRow({ price, size, depth, side }: OrderbookRowProps) {
  return (
    <div className={cn('relative w-full h-[26px]')}>
      {/* Depth indicator */}
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

      {/* Content */}
      <div className="relative z-10 px-4 h-full flex items-center">
        <div
          className={cn(
            'grid grid-cols-3 gap-4 items-center',
            'font-mono text-xs leading-none tracking-tight w-full',
            side === 'Buy' ? 'text-green-600' : 'text-red-600'
          )}
        >
          {/* Price */}
          <div className="text-left">
            <span className="tabular-nums">{formatPrice(price)}</span>
          </div>

          {/* Size */}
          <div className="text-right">
            <span className="tabular-nums">{formatQuantity(size)}</span>
          </div>

          {/* Total */}
          <div className="text-right">
            <span className="tabular-nums">{formatTotal(price, size)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
