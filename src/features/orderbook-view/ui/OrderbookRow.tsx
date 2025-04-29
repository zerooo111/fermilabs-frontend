/**
 * Orderbook row component
 * Displays a single row in the orderbook
 */
import { cn } from '../../../shared/lib/utils';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
  MIN_DISPLAY_QUANTITY,
  PRICE_DECIMALS,
} from '../lib/processOrderbook';

type OrderbookRowProps = {
  price: number;
  size: number;
  depth: number;
  side: 'Buy' | 'Sell';
};

export function OrderbookRow({ price, size, depth, side }: OrderbookRowProps) {
  // Normalize the quantity to compare with the threshold
  const normalizedSize = size / Math.pow(10, PRICE_DECIMALS);
  const isSmallQuantity = normalizedSize < MIN_DISPLAY_QUANTITY;

  return (
    <div className={cn('relative w-full', isSmallQuantity && 'opacity-50')}>
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
      <div className="relative z-10 px-4 py-1">
        <div
          className={cn(
            'grid grid-cols-3 gap-2 items-center',
            'font-mono text-xs leading-none tracking-tight w-full',
            side === 'Buy' ? 'text-green-600' : 'text-red-600'
          )}
        >
          {/* Price */}
          <div className="w-[100px] overflow-hidden">
            <span className="tabular-nums font-mono block truncate text-left">
              {formatPrice(price)}
            </span>
          </div>

          {/* Size */}
          <div className="w-[100px] overflow-hidden">
            <span className="tabular-nums font-mono block truncate text-right">
              {formatQuantity(size)}
            </span>
          </div>

          {/* Total */}
          <div className="w-[100px] overflow-hidden">
            <span className="tabular-nums font-mono block truncate text-right">
              {formatTotal(price, size)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
