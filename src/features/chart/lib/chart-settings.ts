/**
 * User chart settings, like TradingView's chart settings dialog: candle and
 * line colors, the legend, scales and the canvas. One set for every pane and
 * market, kept in localStorage and applied as overrides on the Fermi theme.
 */
import { createTheme, themeColor, type ResolvedChartTheme } from 'candleframe/chart';
import { fermiChartTheme } from './candleframe-theme';

export type LineDash = 'solid' | 'dashed' | 'dotted';

export interface ChartSettings {
  candles: {
    up: string;
    down: string;
    wickUp: string;
    wickDown: string;
    /** Body width as a share of the bar spacing. */
    bodyRatio: number;
    wickWidth: number;
  };
  /** Line, area and baseline chart types. */
  line: {
    color: string;
    width: number;
    areaOpacity: number;
    baselineUp: string;
    baselineDown: string;
  };
  legend: {
    /**
     * Off by default. Renamed from `ohlc`, which every saved settings blob
     * has as true, so the new default reaches existing users too.
     */
    ohlcValues: boolean;
    change: boolean;
    indicators: boolean;
  };
  scales: {
    /** IANA zone, or 'local' for the browser's. */
    timeZone: string;
    lastPriceLine: boolean;
    axisTextSize: number;
  };
  canvas: {
    background: string;
    grid: boolean;
    gridColor: string;
    crosshairColor: string;
    crosshairStyle: LineDash;
  };
}

const KEY = 'fermi:chart:settings';

const { chart, palette } = fermiChartTheme;
/** Theme colors can be palette references (`@text`); the pickers need hex. */
const hex = (value: string) => themeColor(fermiChartTheme, value);

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  candles: {
    up: hex(chart.candleUp),
    down: hex(chart.candleDown),
    wickUp: hex(chart.wickUp),
    wickDown: hex(chart.wickDown),
    bodyRatio: chart.candleBodyRatio,
    wickWidth: chart.wickWidth,
  },
  line: {
    color: hex(chart.lineColor),
    width: chart.lineWidth,
    areaOpacity: chart.areaOpacity,
    baselineUp: hex(chart.baselineUp),
    baselineDown: hex(chart.baselineDown),
  },
  legend: { ohlcValues: false, change: true, indicators: true },
  scales: {
    timeZone: 'UTC',
    lastPriceLine: true,
    axisTextSize: fermiChartTheme.typography.axisSize,
  },
  canvas: {
    background: hex(palette.background),
    grid: true,
    gridColor: hex(palette.grid),
    crosshairColor: hex(chart.crosshairColor),
    crosshairStyle: 'dashed',
  },
};

/** Time zones offered in Scales, besides the browser's own. */
export const TIME_ZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'local', label: 'Local' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'America/Chicago', label: 'Chicago' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'Kolkata' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
] as const;

export function resolveTimeZone(value: string): string {
  return value === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : value;
}

const DASHES: Record<LineDash, readonly number[]> = {
  solid: [],
  dashed: [3, 4],
  dotted: [1, 3],
};

/** Height of the strip collapsed indicator panes sit in, above the time axis. */
export const PANE_STRIP_HEIGHT = 18;

/**
 * The Fermi theme with the user's settings applied. `paneStrip` widens the
 * gap above the time axis to make room for the collapsed-pane strip;
 * `priceAxisWidth` (lib/price-axis.ts) fits the axis to the market's labels.
 */
export function chartTheme(
  settings: ChartSettings,
  paneStrip = false,
  priceAxisWidth: number = chart.priceAxisWidth
): ResolvedChartTheme {
  const { candles, line, scales, canvas } = settings;
  return createTheme(fermiChartTheme, {
    palette: { background: canvas.background, grid: canvas.gridColor },
    typography: { axisSize: scales.axisTextSize },
    chart: {
      candleUp: candles.up,
      candleDown: candles.down,
      wickUp: candles.wickUp,
      wickDown: candles.wickDown,
      // Volume follows the candles, as on TradingView.
      volumeUp: candles.up,
      volumeDown: candles.down,
      candleBodyRatio: candles.bodyRatio,
      wickWidth: candles.wickWidth,
      lineColor: line.color,
      lineWidth: line.width,
      areaColor: line.color,
      areaOpacity: line.areaOpacity,
      baselineUp: line.baselineUp,
      baselineDown: line.baselineDown,
      gridOpacity: canvas.grid ? chart.gridOpacity : 0,
      crosshairColor: canvas.crosshairColor,
      crosshairDash: DASHES[canvas.crosshairStyle],
      lastPriceOpacity: scales.lastPriceLine ? chart.lastPriceOpacity : 0,
      axisGap: paneStrip ? chart.axisGap + PANE_STRIP_HEIGHT : chart.axisGap,
      priceAxisWidth,
    },
  });
}

/** Saved settings over the defaults, group by group, so new fields get defaults. */
export function loadChartSettings(): ChartSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ChartSettings>;
    const merged = { ...DEFAULT_CHART_SETTINGS };
    for (const group of Object.keys(merged) as (keyof ChartSettings)[]) {
      if (saved[group] && typeof saved[group] === 'object') {
        merged[group] = { ...DEFAULT_CHART_SETTINGS[group], ...saved[group] } as never;
      }
    }
    // Drop the retired key so it isn't saved back.
    const { ohlc: _retired, ...legend } = merged.legend as ChartSettings['legend'] & {
      ohlc?: boolean;
    };
    merged.legend = legend;
    return merged;
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}

export function saveChartSettings(settings: ChartSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: kept for this session only.
  }
}
