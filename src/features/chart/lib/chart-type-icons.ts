/**
 * CandleFrame's chart type icons: inner SVG markup on a 24-unit grid, keyed by
 * `ChartType`. Copied from its ui-icons.ts, which the package doesn't export,
 * like drawing-tool-icons.ts. Re-generate when CandleFrame adds chart types.
 */
export const CHART_TYPE_ICONS: Record<string, string> = {
  candles:
    '<path d="M7 3v18M17 5v14"/><rect x="5" y="7" width="4" height="9" rx=".5"/><rect x="15" y="9" width="4" height="6" rx=".5"/>',
  'hollow-candles':
    '<path d="M7 3v4m0 9v5M17 5v4m0 6v4"/><rect x="5" y="7" width="4" height="9" rx=".5"/><rect x="15" y="9" width="4" height="6" rx=".5" fill="currentColor"/>',
  'heikin-ashi':
    '<path d="M5 13v8M12 8v10M19 3v10"/><rect x="3" y="15" width="4" height="4" rx=".5"/><rect x="10" y="10" width="4" height="5" rx=".5"/><rect x="17" y="5" width="4" height="6" rx=".5"/>',
  'ohlc-bars': '<path d="M8 4v15M5 8h3m0 7h3M16 6v13m-3-9h3m0 6h3"/>',
  'hlc-bars': '<path d="M8 4v15m0-4h3M16 6v13m0-3h3"/>',
  'high-low': '<path d="M6 6v9M12 9v11M18 4v10"/>',
  columns:
    '<path d="M3 20h18"/><rect x="5" y="12" width="3" height="8"/><rect x="10.5" y="7" width="3" height="13"/><rect x="16" y="10" width="3" height="10"/>',
  line: '<path d="m3 17 5-6 4 3 4-7 5 4"/>',
  'line-markers':
    '<path d="m3 17 5-6 4 3 4-7 5 4"/><circle cx="8" cy="11" r="1.6" fill="currentColor"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/><circle cx="16" cy="7" r="1.6" fill="currentColor"/>',
  'step-line': '<path d="M3 17h5v-6h4v3h4V7h5"/>',
  area: '<path d="M3 15 8 9l4 3 4-6 5 4v10H3Z" fill="currentColor" fill-opacity=".2" stroke="none"/><path d="m3 15 5-6 4 3 4-6 5 4"/>',
  baseline: '<path d="M3 12h18" stroke-dasharray="1.5 2.5"/><path d="m3 12 4-6 4 6 4 5 3-3 3-2"/>',
  footprint:
    '<path d="M5 3v18"/><rect x="8" y="5" width="12" height="14" rx="1"/><path d="M8 9.7h12M8 14.3h12M14 5v14"/>',
};
