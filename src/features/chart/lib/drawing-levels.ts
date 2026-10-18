/**
 * Helpers for the levels of CandleFrame's Fibonacci and Gann drawings, used by
 * the Levels settings tab. Limits mirror CandleFrame's level validation.
 */
import { fibDefaultLevels, fibLevels } from 'candleframe/core';
import type { Drawing, DrawingLevelStyle, DrawingToolDefinition } from 'candleframe/core';

export const MAX_DRAWING_LEVELS = 24;
export const LEVEL_MIN = -1000;
export const LEVEL_MAX = 1000;

/** True for tools whose `Drawing.levels` drive their geometry. */
export const usesDrawingLevels = (type: string): boolean => fibDefaultLevels(type).length > 0;

/**
 * The levels a drawing shows (its own, else the tool's defaults) with one look
 * per level, and whether anything differs from the defaults.
 */
export function drawingLevelState(drawing: Drawing) {
  const own = drawing.levels;
  const defaults = fibDefaultLevels(drawing.type);
  const levels = own.length ? [...own] : [...defaults];
  const looks = levels.map((_, i): DrawingLevelStyle => ({ ...drawing.levelStyles?.[i] }));
  // Drawings added through the API store a copy of the defaults as their own.
  const ownDiffers =
    own.length > 0 && (own.length !== defaults.length || own.some((l, i) => l !== defaults[i]));
  const customised = ownDiffers || looks.some(look => Object.keys(look).length > 0);
  return { levels, looks, customised };
}

/** Each level's colour with per-level colours on: its own, else its built-in hue. */
export function drawingLevelColors(
  drawing: Drawing,
  tool: DrawingToolDefinition,
  levels: readonly number[],
  looks: readonly DrawingLevelStyle[]
): string[] {
  const rows = fibLevels(
    {
      ...drawing,
      levels: [...levels],
      levelStyles: looks.map(look => (look.color ? { color: look.color } : {})),
      options: { ...drawing.options, levelColors: true },
    },
    [],
    tool.settings
  );
  return rows.map(row => row.color);
}

/** The value a new level takes: one past the highest, within the limits. */
export const nextLevel = (levels: readonly number[]): number =>
  Math.min(LEVEL_MAX, Number((Math.max(...levels) + 1).toFixed(3)));

export const replaced = <T>(list: readonly T[], index: number, value: T): T[] =>
  list.map((item, i) => (i === index ? value : item));

export const without = <T>(list: readonly T[], index: number): T[] =>
  list.filter((_, i) => i !== index);
