import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { healthTone } from '@/shared/lib/account-health';

/**
 * Fill for a partly filled segment: snapped down to the 3px pixel grid, with a
 * two-cell checkerboard tip (the --dither-50 mask from shared/styles/dither.css)
 * so the edge dissolves instead of ending in a smooth line. Full and empty
 * segments stay plain.
 */
function fillStyle(fill: number): CSSProperties & { '--fill'?: string } {
  if (fill >= 1) return { width: '100%' };
  if (fill <= 0) return { width: 0 };
  // The snapped width needs CSS round(); where that's missing the class below
  // falls back to the exact width, never a full (overstated) segment.
  return {
    '--fill': `${fill * 100}%`,
    maskImage: 'var(--dither-50), linear-gradient(#000 0 0)',
    maskSize: '12px 12px, calc(100% - 6px) 100%',
    maskPosition: 'right top, left top',
    maskRepeat: 'repeat-y, no-repeat',
  };
}

/** Segmented health bar; each segment fills in turn. Empty when value is null. */
export function HealthBar({
  value,
  segments = 5,
  className,
}: {
  value: number | null;
  segments?: number;
  className?: string;
}) {
  const pct = value ?? 0;
  const size = 100 / segments;
  const { bar } = healthTone(pct);
  return (
    <div
      role="meter"
      aria-label="Account health"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(pct)}
      className={cn('flex gap-1', className)}
    >
      {Array.from({ length: segments }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (pct - i * size) / size));
        return (
          <div key={i} className="h-1.5 flex-1 overflow-hidden bg-rock/10">
            <div
              className={cn(
                'h-full w-(--fill) transition-[width] duration-300',
                'supports-[width:round(down,1%,3px)]:w-[min(100%,round(down,var(--fill),3px)+6px)]',
                bar
              )}
              style={fillStyle(fill)}
            />
          </div>
        );
      })}
    </div>
  );
}
