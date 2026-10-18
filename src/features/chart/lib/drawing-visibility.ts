/**
 * Helpers for drawings' per-interval visibility, used by the Visibility
 * settings tab. Bounds come from CandleFrame's `DRAWING_VISIBILITY_UNITS`.
 */
import type {
  DrawingVisibility,
  DrawingVisibilityRange,
  DrawingVisibilityUnitInfo,
} from 'candleframe/core';

/** The stored range for a family, or its default: on, every count. */
export function visibilityRangeOf(
  visibility: DrawingVisibility | undefined,
  { unit, min, max }: DrawingVisibilityUnitInfo
): DrawingVisibilityRange {
  return visibility?.[unit] ?? { enabled: true, from: min, to: max };
}

/** The range with `from <= to`; the edited end wins when the two cross, like one thumb of a range slider. */
export function orderedRange(
  range: DrawingVisibilityRange,
  edited?: 'from' | 'to'
): DrawingVisibilityRange {
  let { from, to } = range;
  if (from > to) [from, to] = edited === 'to' ? [to, to] : [from, from];
  return { enabled: range.enabled, from, to };
}
