/**
 * Tiny price line for market lists and previews. Colour follows the trend
 * (last vs first point); the area under the line is a flat low-opacity fill.
 */
import { useId } from 'react';

import { cn } from '@/lib/utils';

export function Sparkline({
  values,
  width,
  height,
  className,
  strokeWidth = 1.25,
  fill = true,
}: {
  values: number[];
  width: number;
  height: number;
  className?: string;
  strokeWidth?: number;
  fill?: boolean;
}) {
  const clipId = useId();
  if (values.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line
          x1="0"
          x2={width}
          y1={height / 2}
          y2={height / 2}
          className="stroke-line"
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = strokeWidth;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = values
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
    .join('');
  const up = values[values.length - 1] >= values[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn(up ? 'text-positive-fg' : 'text-negative-fg', className)}
      aria-hidden
    >
      <clipPath id={clipId}>
        <rect width={width} height={height} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {fill && (
          <path d={`${line}L${width},${height}L0,${height}Z`} fill="currentColor" opacity={0.1} />
        )}
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
