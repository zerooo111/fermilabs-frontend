/**
 * Per-market chart layout: chart type, indicators, drawings and their groups,
 * volume and log scale, kept in localStorage. Shared by both price sources and
 * every interval, since mark and last-trade charts sit on the same price scale
 * and drawings are anchored by time and price.
 */
import type { ChartApi } from 'candleframe/chart';
import { isChartType } from 'candleframe/core';

const KEY_PREFIX = 'perps-chart:layout:';
const SAVE_DELAY_MS = 400;

type SavedLayout = Pick<
  ReturnType<ChartApi['exportDocument']>,
  'indicators' | 'drawings' | 'drawingGroups' | 'layers' | 'chartType'
> & { log?: boolean };

function read(symbol: string): SavedLayout | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + symbol);
    return raw ? (JSON.parse(raw) as SavedLayout) : null;
  } catch {
    return null;
  }
}

/**
 * Applies the saved layout onto the chart's current document, keeping its
 * feed, viewport and automatic price range. Not undoable.
 */
export function restoreChartLayout(chart: ChartApi, symbol: string): void {
  const saved = read(symbol);
  if (!saved) return;
  const { document, documentRevision } = chart.inspect();
  try {
    chart.restoreDocument(
      {
        ...document,
        indicators: saved.indicators ?? document.indicators,
        drawings: saved.drawings ?? document.drawings,
        drawingGroups: saved.drawingGroups ?? document.drawingGroups,
        chartType: saved.chartType && isChartType(saved.chartType) ? saved.chartType : undefined,
        layers: { ...document.layers, ...saved.layers },
        priceScale: saved.log ? { mode: 'auto', log: true } : { mode: 'auto' },
      },
      documentRevision,
      { undoable: false }
    );
  } catch {
    // A layout from an older CandleFrame that no longer validates: start fresh.
    try {
      window.localStorage.removeItem(KEY_PREFIX + symbol);
    } catch {
      // ignore storage errors
    }
  }
}

export interface ChartLayoutAutosave {
  /** Writes a pending change now, e.g. before the feed is replaced. */
  flush(): void;
  /** Flushes and stops saving. */
  dispose(): void;
}

/** Saves the layout shortly after each document change. */
export function autosaveChartLayout(chart: ChartApi, symbol: string): ChartLayoutAutosave {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRevision = chart.inspect().documentRevision;
  const save = () => {
    timer = undefined;
    const { indicators, drawings, drawingGroups, layers, priceScale, chartType } =
      chart.exportDocument();
    const layout: SavedLayout = {
      indicators,
      drawings,
      drawingGroups,
      layers,
      chartType,
      log: !!priceScale.log,
    };
    try {
      window.localStorage.setItem(KEY_PREFIX + symbol, JSON.stringify(layout));
    } catch {
      // ignore storage errors (quota, private mode)
    }
  };
  const unsubscribe = chart.subscribe(state => {
    if (state.documentRevision === lastRevision) return;
    lastRevision = state.documentRevision;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  });
  const flush = () => {
    if (!timer) return;
    clearTimeout(timer);
    save();
  };
  return {
    flush,
    dispose() {
      unsubscribe();
      flush();
    },
  };
}
