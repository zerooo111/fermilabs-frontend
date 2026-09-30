/**
 * Orderbook row component
 * Displays a single row in the orderbook
 */
import { cn } from '@/lib/utils';
import { formatPrice, formatQuantity, formatTotal } from '../lib/processOrderbook';

type OrderbookRowProps = {
  price: number;
  size: number;
  depth: number;
  side: 'Buy' | 'Sell';
  baseDecimals: number;
  quoteDecimals: number;
};

export function OrderbookRow({
  price,
  size,
  depth,
  side,
  quoteDecimals,
  baseDecimals,
}: OrderbookRowProps) {
  return (
    <div className={cn('relative font-medium w-full h-[26px] hover:bg-state-hover')}>
      {/* Depth indicator */}
      <div
        className={cn(
          'absolute inset-0',
          side === 'Buy' ? 'bg-positive-solid/25' : 'bg-negative-solid/25'
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
            'font-mono text-xs leading-none tracking-tight w-full text-fg-secondary'
          )}
        >
          {/* Price */}
          <div
            className={cn('text-left', side === 'Buy' ? 'text-positive-fg' : 'text-negative-fg')}
          >
            <span className="tabular-nums">{formatPrice(price, quoteDecimals)}</span>
          </div>

          {/* Size */}
          <div className="text-right">
            <span className="tabular-nums">{formatQuantity(size, baseDecimals)}</span>
          </div>

          {/* Total */}
          <div className="text-right">
            <span className="tabular-nums">
              {formatTotal(price, size, quoteDecimals, baseDecimals)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
