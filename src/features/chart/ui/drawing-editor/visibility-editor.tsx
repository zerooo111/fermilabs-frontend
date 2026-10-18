/**
 * Body of the Visibility tab: per interval family (ticks, seconds … months,
 * ranges) whether the drawing shows, and between which counts, like
 * CandleFrame's Visibility section. Notes the chart's current interval and
 * says when the drawing is hidden on it.
 */
import { memo, useEffect, useState } from 'react';
import type { ChartApi } from 'candleframe/chart';
import {
  DRAWING_VISIBILITY_UNITS,
  intervalLabel,
  intervalVisibility,
  visibleOnInterval,
  type DrawingVisibilityRange,
  type DrawingVisibilityUnitInfo,
} from 'candleframe/core';
import { cn } from '@/lib/utils';
import { SECTION_HEADING, countFromDraft } from '@/features/chart/lib/drawing-settings';
import { orderedRange, visibilityRangeOf } from '@/features/chart/lib/drawing-visibility';
import type { DrawingEditorProps } from './types';

/** The chart's interval, kept current across feed swaps. */
function useChartInterval(chart: ChartApi) {
  const [interval, setChartInterval] = useState(() => chart.inspect().feed.interval);
  useEffect(() => chart.subscribe(state => setChartInterval(state.feed.interval)), [chart]);
  return interval;
}

function CountField({
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = countFromDraft(draft, min, max);
    setDraft(null);
    if (next !== null && next !== value) onCommit(next);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      value={draft ?? String(value)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="h-7 w-full min-w-0 border border-outline bg-background px-2 text-right font-mono text-xs text-rock outline-none focus:border-rock/40 disabled:opacity-40"
    />
  );
}

function DrawingVisibilityEditorComponent({ chart, drawing, update }: DrawingEditorProps) {
  const interval = useChartInterval(chart);
  const current = intervalVisibility(interval);
  const hidden = !visibleOnInterval(drawing, interval);
  const name = intervalLabel(interval);

  const commit = (
    info: DrawingVisibilityUnitInfo,
    range: DrawingVisibilityRange,
    edited?: 'from' | 'to'
  ) => update({ visibility: { [info.unit]: orderedRange(range, edited) } });

  return (
    <div className="flex flex-col gap-3">
      <p className={cn('text-[11px] leading-4', hidden ? 'text-danger' : 'text-rock/50')}>
        {hidden
          ? `Hidden on ${name}, the chart's interval.`
          : `Shown on ${name}, the chart's interval.`}
      </p>

      <fieldset className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto_4.5rem] items-center gap-x-2 gap-y-1">
        <legend className={cn(SECTION_HEADING, 'mb-1')}>Show on intervals</legend>
        {DRAWING_VISIBILITY_UNITS.map(info => {
          const range = visibilityRangeOf(drawing.visibility, info);
          const active = current?.unit === info.unit;
          return (
            <div key={info.unit} className="contents">
              <label
                className={cn(
                  'flex min-h-7 cursor-pointer items-center gap-2 text-xs text-rock/70 hover:text-rock',
                  active && 'text-rock'
                )}
              >
                <input
                  type="checkbox"
                  checked={range.enabled}
                  onChange={e => commit(info, { ...range, enabled: e.target.checked })}
                  className="size-3.5 accent-[var(--color-primary)]"
                />
                {info.label}
                {active && (
                  <span className="font-mono text-[10px] text-primary" title="The chart's interval">
                    {current.count}
                  </span>
                )}
              </label>
              <CountField
                label={`${info.label} from`}
                value={range.from}
                min={info.min}
                max={info.max}
                disabled={!range.enabled}
                onCommit={from => commit(info, { ...range, from }, 'from')}
              />
              <span className="text-rock/30" aria-hidden>
                –
              </span>
              <CountField
                label={`${info.label} to`}
                value={range.to}
                min={info.min}
                max={info.max}
                disabled={!range.enabled}
                onCommit={to => commit(info, { ...range, to }, 'to')}
              />
            </div>
          );
        })}
      </fieldset>

      <button
        type="button"
        disabled={!drawing.visibility}
        onClick={() => update({ visibility: null })}
        className="self-start text-[11px] text-rock/50 underline-offset-2 transition-colors hover:text-rock hover:underline disabled:pointer-events-none disabled:opacity-40"
      >
        Show on all intervals
      </button>
    </div>
  );
}

export const DrawingVisibilityEditor = memo(DrawingVisibilityEditorComponent);
