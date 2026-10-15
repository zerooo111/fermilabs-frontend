/**
 * Multi-chart layouts for the perps chart: grid presets and the saved grid
 * (preset, active pane and the interval / price source of panes 2..4; pane 1
 * follows the container's own persisted selection).
 */
import type { PerpsPriceSource, PerpsTimeframe } from './perps-chart';
import { FERMI_INTERVALS } from './fermi-feed';

export type GridPreset = '1' | '2h' | '2v' | '1+2' | '2x2';

export const GRID_PRESETS: Record<
  GridPreset,
  {
    label: string;
    panes: number;
    cols: 1 | 2;
    rows: 1 | 2;
    first?: string;
    /** The row divider only spans the right column (pane 1 fills the left). */
    rowSplitRightOnly?: boolean;
  }
> = {
  '1': { label: 'Single chart', panes: 1, cols: 1, rows: 1 },
  '2h': { label: 'Two, side by side', panes: 2, cols: 2, rows: 1 },
  '2v': { label: 'Two, stacked', panes: 2, cols: 1, rows: 2 },
  '1+2': {
    label: 'One large, two small',
    panes: 3,
    cols: 2,
    rows: 2,
    first: 'row-span-2',
    rowSplitRightOnly: true,
  },
  '2x2': { label: 'Four', panes: 4, cols: 2, rows: 2 },
};

/** Divider positions as a share of the grid's width (x) and height (y). */
export interface GridSplit {
  x: number;
  y: number;
}

export const DEFAULT_SPLIT: GridSplit = { x: 0.5, y: 0.5 };
export const SPLIT_MIN = 0.15;
export const SPLIT_MAX = 0.85;

export const clampSplit = (v: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v));

export interface PaneSelection {
  interval: PerpsTimeframe;
  source: PerpsPriceSource;
}

export interface SavedGrid {
  preset: GridPreset;
  active: number;
  /** Panes 2..4. */
  extra: PaneSelection[];
  split: GridSplit;
}

const KEY = 'perps-chart:grid';
const DEFAULT: SavedGrid = { preset: '1', active: 0, extra: [], split: DEFAULT_SPLIT };

const isSelection = (p: unknown): p is PaneSelection =>
  !!p &&
  (FERMI_INTERVALS as readonly unknown[]).includes((p as PaneSelection).interval) &&
  ((p as PaneSelection).source === 'mark' || (p as PaneSelection).source === 'ltp');

export function loadGrid(): SavedGrid {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as SavedGrid | null;
    if (!raw || !(raw.preset in GRID_PRESETS)) return DEFAULT;
    const extra = Array.isArray(raw.extra) ? raw.extra.filter(isSelection).slice(0, 3) : [];
    const panes = GRID_PRESETS[raw.preset].panes;
    const active = Number.isInteger(raw.active) && raw.active < panes ? raw.active : 0;
    const split = {
      x: typeof raw.split?.x === 'number' ? clampSplit(raw.split.x) : DEFAULT_SPLIT.x,
      y: typeof raw.split?.y === 'number' ? clampSplit(raw.split.y) : DEFAULT_SPLIT.y,
    };
    return { preset: raw.preset, active, extra, split };
  } catch {
    return DEFAULT;
  }
}

export function saveGrid(grid: SavedGrid): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(grid));
  } catch {
    // ignore storage errors
  }
}
