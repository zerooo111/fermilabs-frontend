/**
 * Position tab body for long / short position plans: entry, target and stop
 * prices, reward / risk with 1R-3R presets that move the target, and the
 * plan's width in bars, then the tool's Position and Outcome settings.
 *
 * Fields keep local drafts and commit on blur / Enter as one `points` update,
 * so an edit across several fields that is only valid together (moving entry
 * past the stop, then the stop) still lands as a single undo step.
 */
import { memo, useEffect, useState } from 'react';
import type { ChartApi } from 'candleframe/chart';
import type { Anchor } from 'candleframe/core';
import { cn } from '@/lib/utils';
import { SECTION_HEADING } from '@/features/chart/lib/drawing-settings';
import {
  POSITION_CLAIMS,
  positionBars,
  positionMetrics,
  positionSideMessage,
  targetForRatio,
  withPositionBars,
} from '@/features/chart/lib/position-metrics';
import { DrawingSettingFields } from './DrawingSettingFields';
import type { DrawingEditorProps } from './types';

const PRICES = ['entry', 'target', 'stop'] as const;
const PRESETS = [1, 2, 3];
const MAX_BARS = 100_000;

type Field = (typeof PRICES)[number] | 'bars' | 'ratio';
type Drafts = Partial<Record<Field, string>>;
/** A failed commit's message and the fields it points at. */
type FieldError = { message: string; fields: readonly Field[] };

const ROW = 'flex min-h-7 items-center justify-between gap-3 text-xs text-rock/70';
const INPUT =
  'h-7 w-28 border border-outline bg-background px-2 text-right font-mono text-xs text-rock outline-none focus:border-rock/40 disabled:opacity-50 aria-invalid:border-danger/70';

/** The pane's bar interval and tick size, kept current across interval switches. */
function useFeedScale(chart: ChartApi) {
  const [intervalMs, setIntervalMs] = useState(() => chart.inspect().feed.intervalMs);
  const [tickSize, setTickSize] = useState(() => chart.inspect().feed.instrument.tickSize);
  useEffect(
    () =>
      chart.subscribe(state => {
        setIntervalMs(state.feed.intervalMs);
        setTickSize(state.feed.instrument.tickSize);
      }),
    [chart]
  );
  return { intervalMs, tickSize };
}

const trim = (value: number, decimals: number) => String(Number(value.toFixed(decimals)));

function PositionEditorComponent({
  chart,
  drawing,
  tool,
  update,
  pricePrecision,
}: DrawingEditorProps) {
  const { intervalMs, tickSize } = useFeedScale(chart);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [error, setError] = useState<FieldError | null>(null);

  // Drop drafts when the plan changes underneath them (a drag, undo, or our own commit).
  const pointsKey = JSON.stringify(drawing.points);
  const [seenKey, setSeenKey] = useState(pointsKey);
  if (seenKey !== pointsKey) {
    setSeenKey(pointsKey);
    setDrafts({});
    setError(null);
  }

  const shown = (field: Exclude<Field, 'ratio'>) => {
    const draft = drafts[field];
    if (draft !== undefined) return draft;
    if (field === 'bars') return trim(positionBars(drawing.points, intervalMs), 4);
    return trim(drawing.points[PRICES.indexOf(field)].price, pricePrecision);
  };

  /** The drawing's points with every price / width draft applied. */
  const draftPoints = (next: Drafts): Anchor[] => {
    let points = drawing.points.map(point => ({ ...point }));
    PRICES.forEach((field, i) => {
      const value = next[field];
      if (value !== undefined) points[i].price = value.trim() ? Number(value) : NaN;
    });
    if (next.bars !== undefined) {
      points = withPositionBars(points, next.bars.trim() ? Number(next.bars) : NaN, intervalMs);
    }
    return points;
  };

  const draft = draftPoints(drafts);
  const metrics = positionMetrics(drawing.type, draft);

  const commit = (next: Drafts) => {
    const points = draftPoints(next);
    const bars = positionBars(points, intervalMs);
    const missing = PRICES.filter((_, i) => !(points[i].price >= tickSize));
    let failure: FieldError | null = null;
    if (missing.length) {
      failure = { message: 'Enter entry, target and stop prices above zero.', fields: missing };
    } else if (!(bars >= 1 && bars <= MAX_BARS)) {
      failure = {
        message: `Width must be between 1 and ${MAX_BARS.toLocaleString()} bars.`,
        fields: ['bars'],
      };
    } else if (!positionMetrics(drawing.type, points).valid) {
      failure = { message: positionSideMessage(drawing.type), fields: PRICES };
    }
    setError(failure);
    if (failure) {
      setDrafts(next);
      return;
    }
    setDrafts({});
    if (JSON.stringify(points) !== JSON.stringify(drawing.points)) update({ points });
  };

  const commitField = (field: Field) => {
    if (drafts[field] === undefined) return;
    if (field !== 'ratio') return commit(drafts);
    const { ratio, ...rest } = drafts;
    setRatio(Number(ratio), rest);
  };

  /** Moves the target to `ratio` R of the drafted entry / stop and commits. */
  const setRatio = (ratio: number, base: Drafts = drafts) => {
    const points = draftPoints(base);
    const target = targetForRatio(drawing.type, points[0].price, points[2].price, ratio);
    if (target === null) {
      setDrafts(base);
      setError(
        Number.isFinite(ratio) && ratio > 0
          ? { message: positionSideMessage(drawing.type), fields: ['entry', 'stop'] }
          : { message: 'Reward / risk must be above zero.', fields: ['ratio'] }
      );
      return;
    }
    commit({ ...base, target: trim(target, pricePrecision) });
  };

  const inputProps = (field: Field, label: string) => ({
    'aria-label': label,
    type: 'number' as const,
    inputMode: 'decimal' as const,
    step: 'any',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDrafts(d => ({ ...d, [field]: e.target.value })),
    onBlur: () => commitField(field),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commitField(field);
      if (e.key === 'Escape') setDrafts(({ [field]: _, ...rest }) => rest);
    },
    'aria-invalid': error?.fields.includes(field) || undefined,
    className: INPUT,
  });

  const fields = (tool.settings ?? []).filter(
    s => s.section && POSITION_CLAIMS.includes(s.section as never)
  );
  const ratioShown = drafts.ratio ?? (metrics.valid ? trim(metrics.ratio, 2) : '');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between border-b border-outline pb-2">
        <span className={SECTION_HEADING}>Reward / risk</span>
        <output className="font-mono text-sm text-rock" aria-label="Reward to risk ratio">
          {metrics.valid ? metrics.ratio.toFixed(2) : '—'}
          <span className="text-rock/50">R</span>
        </output>
      </div>

      <fieldset disabled={drawing.locked} className="flex flex-col gap-0.5">
        <legend className={cn(SECTION_HEADING, 'mb-1')}>Prices</legend>
        {PRICES.map(field => (
          <label key={field} className={ROW}>
            <span className="flex items-baseline gap-2 capitalize">
              {field}
              {field !== 'entry' && metrics.valid && (
                <span
                  className={cn(
                    'font-mono text-[10px]',
                    field === 'target' ? 'text-success' : 'text-danger'
                  )}
                >
                  {field === 'target'
                    ? `+${metrics.rewardPercent.toFixed(2)}%`
                    : `−${metrics.riskPercent.toFixed(2)}%`}
                </span>
              )}
            </span>
            <input
              {...inputProps(field, `Position ${field} price`)}
              min={tickSize}
              value={shown(field)}
            />
          </label>
        ))}

        <div className={ROW}>
          <label htmlFor={`${drawing.id}-ratio`}>Reward / risk</label>
          <div className="flex items-center gap-1">
            <div
              className="flex gap-px border border-rock/15 bg-rock/15"
              aria-label="Reward to risk presets"
            >
              {PRESETS.map(ratio => {
                const active = metrics.valid && Math.abs(metrics.ratio - ratio) < 0.005;
                return (
                  <button
                    key={ratio}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRatio(ratio)}
                    className={cn(
                      'flex h-[26px] min-w-7 items-center justify-center bg-background px-1.5 font-mono text-[11px] transition-colors hover:text-rock',
                      active
                        ? 'bg-[color-mix(in_srgb,var(--color-rock)_14%,var(--color-background))] text-rock'
                        : 'text-rock/50'
                    )}
                  >
                    {ratio}R
                  </button>
                );
              })}
            </div>
            <input
              {...inputProps('ratio', 'Position reward / risk')}
              id={`${drawing.id}-ratio`}
              min={0.01}
              value={ratioShown}
              className={cn(INPUT, 'w-16')}
            />
          </div>
        </div>

        <label className={ROW}>
          <span>Width in bars</span>
          <input
            {...inputProps('bars', 'Position width in bars')}
            min={1}
            max={MAX_BARS}
            value={shown('bars')}
          />
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="text-[11px] text-danger">
          {error.message}
        </p>
      )}
      {drawing.locked ? (
        <p className="text-[11px] text-rock/40">Unlock the drawing to edit its prices.</p>
      ) : (
        <p className="text-[11px] leading-relaxed text-rock/40">
          Drag the shaded area to move. Use the level handles to adjust prices and the side handle
          to resize.
        </p>
      )}

      {fields.length > 0 && (
        <DrawingSettingFields fields={fields} drawing={drawing} update={update} />
      )}
    </div>
  );
}

export const PositionForm = memo(PositionEditorComponent);
