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
  { label: string; panes: number; grid: string; first?: string }
> = {
  '1': { label: 'Single chart', panes: 1, grid: 'grid-cols-1 grid-rows-1' },
  '2h': { label: 'Two, side by side', panes: 2, grid: 'grid-cols-2 grid-rows-1' },
  '2v': { label: 'Two, stacked', panes: 2, grid: 'grid-cols-1 grid-rows-2' },
  '1+2': {
    label: 'One large, two small',
    panes: 3,
    grid: 'grid-cols-2 grid-rows-2',
    first: 'row-span-2',
  },
  '2x2': { label: 'Four', panes: 4, grid: 'grid-cols-2 grid-rows-2' },
};

export interface PaneSelection {
  interval: PerpsTimeframe;
  source: PerpsPriceSource;
}

export interface SavedGrid {
  preset: GridPreset;
  active: number;
  /** Panes 2..4. */
  extra: PaneSelection[];
}

const KEY = 'perps-chart:grid';
const DEFAULT: SavedGrid = { preset: '1', active: 0, extra: [] };

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
    return { preset: raw.preset, active, extra };
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
