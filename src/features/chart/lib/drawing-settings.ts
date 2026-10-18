/**
 * Helpers for CandleFrame drawing settings shared by the settings tabs.
 */
import type { Drawing, DrawingOptionValue, DrawingSetting } from 'candleframe/core';

export const SECTION_HEADING = 'text-[10px] uppercase tracking-wide text-rock/40';

// CandleFrame rejects styles outside these ranges.
export const FILL_OPACITY_RANGE = { min: 0, max: 1 } as const;
export const FONT_SIZE_RANGE = { min: 10, max: 32 } as const;

/**
 * Tools that paint a fill with `style.fillOpacity`: CandleFrame's scene uses it
 * for any filled path that doesn't carry its own opacity. Found by projecting
 * every built-in tool with each setting toggled; the trend lines' middle-point
 * dot is left out, as the only fill they draw.
 */
const FILL_TOOLS: ReadonlySet<string> = new Set([
  'parallel-channel',
  'regression-trend',
  'flat-top-bottom',
  'disjoint-channel',
  'pitchfork',
  'schiff-pitchfork',
  'modified-schiff-pitchfork',
  'inside-pitchfork',
  'fib-retracement',
  'fib-extension',
  'fib-channel',
  'fib-fan',
  'fib-trend-time',
  'fib-arcs',
  'fib-circles',
  'fib-wedge',
  'pitchfan',
  'gann-square-fixed',
  'gann-square',
  'gann-fan',
  'xabcd',
  'cypher',
  'head-and-shoulders',
  'triangle-pattern',
  'time-cycles',
  'long-position',
  'short-position',
  'forecast',
  'bars-pattern',
  'ghost-feed',
  'projection',
  'anchored-vwap',
  'rectangle',
  'ellipse',
  'triangle',
  'rotated-rectangle',
  'circle',
  'arc',
]);

/**
 * Tools that draw text at `style.fontSize`: labels, stats and ratios as well
 * as the text tools. Text primitives without their own size use it.
 */
const LABEL_TOOLS: ReadonlySet<string> = new Set([
  'trendline',
  'ray',
  'info-line',
  'extended-line',
  'trend-angle',
  'horizontal-line',
  'horizontal-ray',
  'cross-line',
  'regression-trend',
  'fib-retracement',
  'fib-extension',
  'fib-channel',
  'fib-time-zone',
  'fib-fan',
  'fib-trend-time',
  'fib-arcs',
  'fib-circles',
  'fib-wedge',
  'pitchfan',
  'gann-box',
  'gann-square-fixed',
  'gann-square',
  'gann-fan',
  'xabcd',
  'cypher',
  'head-and-shoulders',
  'abcd',
  'triangle-pattern',
  'three-drives',
  'elliott-impulse',
  'elliott-correction',
  'elliott-triangle',
  'elliott-double-combo',
  'elliott-triple-combo',
  'long-position',
  'short-position',
  'forecast',
  'projection',
  'date-range',
  'price-range',
  'date-price-range',
  'arrow',
  'arrow-marker',
  'arrow-mark-up',
  'arrow-mark-down',
  'text',
  'callout',
  'price-label',
  'note',
  'price-note',
  'pin',
  'signpost',
  'comment',
  'table',
  'anchored-text',
  'anchored-note',
]);

/** Whether the tool's fills follow `style.fillOpacity`. */
export const drawsFill = (type: string) => FILL_TOOLS.has(type);

/** Whether the tool draws text at `style.fontSize`. */
export const drawsLabels = (type: string) => LABEL_TOOLS.has(type);

/** The drawing's value for a setting, or the setting's default. */
export function settingValue(drawing: Drawing, field: DrawingSetting): DrawingOptionValue {
  return drawing.options?.[field.key] ?? field.default;
}

/** Settings grouped by section, keeping first-seen order. */
export function groupSettings(fields: readonly DrawingSetting[]) {
  const groups: { section: string | undefined; fields: DrawingSetting[] }[] = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (last && last.section === field.section) last.fields.push(field);
    else groups.push({ section: field.section, fields: [field] });
  }
  return groups;
}

/** A typed whole count clamped to `min`..`max`, or null when the field is blank or not a number. */
export function countFromDraft(draft: string, min: number, max: number): number | null {
  const next = Math.round(Number(draft));
  if (draft.trim() === '' || !Number.isFinite(next)) return null;
  return Math.min(max, Math.max(min, next));
}
