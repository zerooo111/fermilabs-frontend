import { memo } from 'react';

interface SparklineProps {
  values: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

/** Plain line of the last 24h of hourly closes, coloured by direction. */
function SparklineBase({ values, positive, width = 80, height = 24 }: SparklineProps) {
  if (values.length < 2) {
    return <span className="block h-px w-full bg-rock/15" style={{ width }} aria-hidden />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - 1 - ((v - min) / range) * (height - 2)).toFixed(1)}`
    )
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.25}
        strokeLinejoin="round"
        className={positive ? 'stroke-success' : 'stroke-danger'}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export const Sparkline = memo(SparklineBase);
