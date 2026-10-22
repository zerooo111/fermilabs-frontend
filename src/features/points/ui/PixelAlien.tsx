/**
 * A wallet's alien: a space-invader sprite generated from the address, so the
 * same wallet always gets the same one. 11 x 8 pixels, mirrored down the
 * middle. The face, eyes and a joined-up body are fixed so every seed reads
 * as a creature; antennae, shoulders, arms and feet vary.
 */
import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { H, W, alienSprite } from '../model/alienSprite';

export function PixelAlien({
  wallet,
  className,
  title,
}: {
  wallet: string;
  className?: string;
  title?: string;
}) {
  const { cells, color } = useMemo(() => alienSprite(wallet), [wallet]);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('shrink-0', className)}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {cells.flatMap((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null
        )
      )}
    </svg>
  );
}
