/**
 * Top-left chart legend: OHLC of the hovered candle (the latest one when the
 * pointer is off the chart), and a chip per indicator to hide or remove it.
 * It subscribes to the hover and candle stores itself, so ticks and pointer
 * moves re-render only the legend.
 */
import { memo, useSyncExternalStore } from 'react';
import type { Candle } from 'candleframe/core';
import { Eye, EyeOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValueStore } from '@/features/chart/lib/value-store';

export interface LegendIndicator {
  id: string;
  name: string;
  visible: boolean;
}

interface ChartLegendProps {
  hovered: ValueStore<Candle | null>;
  latest: ValueStore<Candle | null>;
  pricePrecision: number;
  /** Pane label in a grid, e.g. "5m · Mark". */
  caption?: string;
  indicators: readonly LegendIndicator[];
  onToggleIndicator: (id: string, visible: boolean) => void;
  onRemoveIndicator: (id: string) => void;
}

function Ohlc({
  hovered,
  latest,
  pricePrecision,
}: Pick<ChartLegendProps, 'hovered' | 'latest' | 'pricePrecision'>) {
  const hover = useSyncExternalStore(hovered.subscribe, hovered.get);
  const last = useSyncExternalStore(latest.subscribe, latest.get);
  const bar = hover ?? last;
  if (!bar) return null;
  const up = bar.close >= bar.open;
  const fmt = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: pricePrecision,
      maximumFractionDigits: pricePrecision,
    });
  const change = bar.close - bar.open;
  const pct = bar.open ? (change / bar.open) * 100 : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-2 font-mono text-[10px] tabular-nums text-rock/45">
      {(['open', 'high', 'low', 'close'] as const).map(key => (
        <span key={key}>
          {key[0].toUpperCase()}{' '}
          <span className={up ? 'text-success' : 'text-danger'}>{fmt(bar[key])}</span>
        </span>
      ))}
      <span className={up ? 'text-success' : 'text-danger'}>
        {change >= 0 ? '+' : '−'}
        {fmt(Math.abs(change))} ({change >= 0 ? '+' : '−'}
        {Math.abs(pct).toFixed(2)}%)
      </span>
    </div>
  );
}

function ChartLegendComponent({
  hovered,
  latest,
  pricePrecision,
  caption,
  indicators,
  onToggleIndicator,
  onRemoveIndicator,
}: ChartLegendProps) {
  return (
    <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex max-w-[calc(100%-6rem)] flex-col items-start gap-1">
      {caption && (
        <span className="font-mono text-[10px] uppercase tracking-wide text-rock/60">
          {caption}
        </span>
      )}
      <Ohlc hovered={hovered} latest={latest} pricePrecision={pricePrecision} />
      {indicators.map(({ id, name, visible }) => (
        <div
          key={id}
          className="group pointer-events-auto flex h-5 items-center gap-1 border border-transparent pl-1 pr-0.5 text-[10px] text-rock/60 hover:border-outline hover:bg-background/80"
        >
          <span className={cn(!visible && 'text-rock/30 line-through')}>{name}</span>
          <button
            type="button"
            aria-label={visible ? `Hide ${name}` : `Show ${name}`}
            onClick={() => onToggleIndicator(id, !visible)}
            className="flex size-4 items-center justify-center text-rock/45 opacity-0 hover:text-rock focus-visible:opacity-100 group-hover:opacity-100"
          >
            {visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          </button>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => onRemoveIndicator(id)}
            className="flex size-4 items-center justify-center text-rock/45 opacity-0 hover:text-rock focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export const ChartLegend = memo(ChartLegendComponent);
