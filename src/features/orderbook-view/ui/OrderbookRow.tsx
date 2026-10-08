/**
 * Orderbook row component
 * Displays a single row in the orderbook
 */
import type BN from 'bn.js';
import { cn } from '@/lib/utils';
import { formatPrice, formatQuantity, formatNotional } from '../lib/processOrderbook';

type OrderbookRowProps = {
  price: number;
  size: number;
  /** Notional (price_raw * qty_raw) for this row — per level or cumulative. */
  total: BN;
  depth: number;
  side: 'Buy' | 'Sell';
  baseDecimals: number;
  quoteDecimals: number;
};

export function OrderbookRow({
  price,
  size,
  total,
  depth,
  side,
  quoteDecimals,
  baseDecimals,
}: OrderbookRowProps) {
  return (
    <div className="relative w-full h-[22px]">
      {/* Depth indicator */}
      <div
        className={cn(
          'absolute inset-y-0 opacity-[0.14]',
          side === 'Buy' ? 'bg-success' : 'bg-danger'
        )}
        style={{
          width: `${depth}%`,
          [side === 'Buy' ? 'right' : 'left']: 0,
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-3 h-full flex items-center">
        <div
          className={cn(
            'grid grid-cols-3 gap-4 items-center',
            'font-mono text-xs leading-none tracking-tight w-full',
            side === 'Buy' ? 'text-success' : 'text-danger'
          )}
        >
          {/* Price */}
          <div className="text-left">
            <span className="tabular-nums">{formatPrice(price, quoteDecimals)}</span>
          </div>

          {/* Size */}
          <div className="text-right">
            <span className="tabular-nums">{formatQuantity(size, baseDecimals)}</span>
          </div>

          {/* Total */}
          <div className="text-right">
            <span className="tabular-nums">
              {formatNotional(total, quoteDecimals, baseDecimals)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
