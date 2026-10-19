/**
 * Orderbook row component
 * Displays a single row in the orderbook
 */
import { useState } from 'react';
import type BN from 'bn.js';
import { cn } from '@/lib/utils';
import { formatPrice, formatQuantity, formatNotional } from '../lib/processOrderbook';
import './row-flash.css';

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
  // Bump a key whenever the size at this price changes so the flash layer
  // remounts and its animation replays. Skipped on mount, so a fresh book or
  // a newly appearing level does not flash. The layer is dropped once it
  // finishes: dockview detaches hidden panes and re-attaching restarts CSS
  // animations, which would replay the last flash on every tab switch.
  const [prevSize, setPrevSize] = useState(size);
  const [flashKey, setFlashKey] = useState(0);
  const [flashing, setFlashing] = useState(false);
  if (size !== prevSize) {
    setPrevSize(size);
    setFlashKey(k => k + 1);
    setFlashing(true);
  }

  return (
    <div className="relative w-full h-[22px]">
      {/* Depth indicator, anchored left on both sides. The ask bar uses a
          darker red at higher opacity; at 0.14 the danger token reads brown
          over the green-tinted background. */}
      <div
        className={cn(
          'absolute inset-y-0 left-0',
          side === 'Buy' ? 'bg-success opacity-[0.14]' : 'bg-[oklch(48%_0.19_25)] opacity-30'
        )}
        style={{ width: `${depth}%` }}
      />

      {/* Size-change flash (see row-flash.css) */}
      {flashing && (
        <div
          key={flashKey}
          aria-hidden
          onAnimationEnd={() => setFlashing(false)}
          className={cn(
            'row-flash absolute inset-0 pointer-events-none',
            side === 'Buy' ? 'bg-success/20' : 'bg-danger-deep/20'
          )}
        />
      )}

      {/* Content */}
      <div className="relative z-10 px-3 h-full flex items-center">
        <div
          className={cn(
            'grid grid-cols-3 gap-4 items-center',
            'font-mono text-xs leading-none tracking-tight w-full',
            side === 'Buy' ? 'text-success' : 'text-danger-deep'
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
