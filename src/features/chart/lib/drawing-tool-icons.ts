/**
 * CandleFrame's drawing tool icons: inner SVG markup on a 24-unit grid,
 * keyed by tool type. CandleFrame keeps these inside its widget and doesn't
 * export them, so they are copied here (generated from its ui-icons.ts).
 * Re-generate when a CandleFrame upgrade adds tools; a missing key falls back
 * to the trend line.
 */
export const DRAWING_TOOL_ICONS: Record<string, string> = {
  cursor: '<path d="m5 3 14 8-7 2-3 7-4-17Z"/>',
  trendline:
    '<path d="m6 18 12-12"/><rect x="3" y="16" width="4" height="4" rx=".5"/><rect x="17" y="3" width="4" height="4" rx=".5"/>',
  ray: '<path d="m6 18 15-15"/><circle cx="5" cy="19" r="2"/>',
  'info-line':
    '<path d="m5 19 9-9"/><circle cx="4" cy="20" r="1.5"/><circle cx="15" cy="9" r="1.5"/><rect x="13" y="13" width="8" height="7" rx="1"/><path d="M15 16h4"/>',
  'extended-line': '<path d="m3 21 18-18M7 13l4 4m2-10 4 4"/>',
  'trend-angle': '<path d="M4 19 19 6M4 19h16"/><path d="M11 19a7 7 0 0 0-2-5"/>',
  'horizontal-line': '<path d="M3 12h7m4 0h7"/><rect x="10" y="10" width="4" height="4" rx=".5"/>',
  'horizontal-ray': '<path d="M7 12h14"/><circle cx="5" cy="12" r="2"/>',
  'vertical-line': '<path d="M12 3v7m0 4v7"/><rect x="10" y="10" width="4" height="4" rx=".5"/>',
  'cross-line': '<path d="M12 3v18M3 12h18"/>',
  'parallel-channel':
    '<path d="m3 14 15-9M6 20l15-9"/><path d="m5 17 15-9" stroke-dasharray="2 3"/>',
  'regression-trend':
    '<path d="m3 12 18-7M3 20l18-7"/><path d="m3 16 18-7" stroke-dasharray="2 2"/>',
  'flat-top-bottom': '<path d="M3 6h18M3 19l18-8"/>',
  'disjoint-channel': '<path d="m3 10 18-6M3 14l18 6"/>',
  pitchfork: '<path d="m4 20 16-16M4 12l4 4 4 4M4 12l9-9m-1 17 9-9"/>',
  'schiff-pitchfork':
    '<path d="m4 20 16-16M3 11l10 10M3 11l8-8m2 18 8-8"/><path d="m4 20 4-4" stroke-dasharray="1 3"/>',
  'modified-schiff-pitchfork':
    '<path d="m8 16 12-12M3 11l10 10M3 11l8-8m2 18 8-8"/><path d="m3 11 10 10" stroke-dasharray="1 3"/>',
  'inside-pitchfork': '<path d="m7 15 13-11M5 9l7-6m-2 18 11-11M5 9l5 12"/>',
  'fib-retracement':
    '<path d="M4 4h16M4 9h16M4 13h16M4 20h16"/><path d="m5 19 14-14" stroke-dasharray="2 3"/>',
  'fib-extension': '<path d="M3 4h18M10 9h11M10 14h11m-17 6 4-9 4 5 6-12"/>',
  'fib-channel': '<path d="m3 11 14-8M3 16l18-10M5 21l16-9"/>',
  'fib-time-zone': '<path d="M3 4v16M6 4v16M11 4v16M20 4v16"/>',
  'fib-fan': '<path d="M3 20 21 3M3 20 21 10M3 20h18"/>',
  'fib-trend-time':
    '<path d="M9 4v16M13 4v16M20 4v16"/><path d="m3 18 3-8 3 5" stroke-dasharray="2 2"/>',
  'fib-arcs': '<path d="M4 20 17 7M11 20a7 7 0 0 0-7-7m14 7A14 14 0 0 0 4 6"/>',
  'fib-circles':
    '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9"/>',
  'fib-spiral':
    '<path d="M12 12a2 2 0 0 1 2 2 3 3 0 0 1-3 3 5 5 0 0 1-5-5 7 7 0 0 1 7-7 8 8 0 0 1 8 8"/>',
  'fib-wedge': '<path d="M3 20 20 6M3 20h18M12 20a9 9 0 0 0-2-6m10 6a17 17 0 0 0-3-11"/>',
  pitchfan:
    '<path d="M3 20 21 4M3 20l18-8M3 20 13 3M3 20l18 1"/><path d="m13 3 8 18" stroke-dasharray="2 2"/>',
  'gann-box':
    '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M8 4v16M14 4v16"/>',
  'gann-square-fixed':
    '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 21 21 3M3 21l18-9M3 21 12 3M3 12a9 9 0 0 1 9 9"/>',
  'gann-square':
    '<rect x="3" y="5" width="18" height="15" rx="1"/><path d="M3 20 21 5M3 20l18-7M3 11h18M10 5v15"/>',
  'gann-fan': '<path d="M3 21 21 3M3 21l18-9M3 21 12 3M3 21l18-4M3 21 7 3"/>',
  xabcd:
    '<path d="m3 18 4-12 5 9 4-7 5 10"/><path d="M3 18 12 15M7 6l9 2" stroke-dasharray="2 2"/>',
  cypher:
    '<path d="m3 17 5-12 4 7 6-9 3 14"/><path d="M3 17h18M3 17 18 3" stroke-dasharray="2 2"/>',
  'head-and-shoulders':
    '<path d="m2 18 4-8 3 4 3-10 3 10 3-4 4 8"/><path d="M4 14h16" stroke-dasharray="2 2"/>',
  abcd: '<path d="m4 19 5-12 5 7 6-10"/><path d="M4 19 14 14M9 7l11-3" stroke-dasharray="2 2"/>',
  'triangle-pattern':
    '<path d="m3 5 4 13 4-10 4 7 3-4"/><path d="m3 5 18 8M7 18l14-5" stroke-dasharray="2 2"/>',
  'three-drives':
    '<path d="m2 20 4-8 3 3 5-8 3 3 5-8"/><path d="M6 12 14 7l8-5" stroke-dasharray="2 2"/>',
  'elliott-impulse':
    '<path d="m3 19 4-7 3 3 5-11 3 6 3-4"/><circle cx="7" cy="12" r="1"/><circle cx="15" cy="4" r="1"/><circle cx="21" cy="6" r="1"/>',
  'elliott-correction':
    '<path d="m3 5 6 10 4-5 8 9"/><circle cx="9" cy="15" r="1"/><circle cx="13" cy="10" r="1"/>',
  'elliott-triangle':
    '<path d="m3 4 4 15 3-11 3 8 3-5 2 3 3-2"/><path d="m3 4 18 8M7 19l14-7" stroke-dasharray="1 2"/>',
  'elliott-double-combo': '<path d="m3 5 4 7 3-3 4 8 3-4 4 7"/><circle cx="10" cy="9" r="1"/>',
  'elliott-triple-combo':
    '<path d="m2 4 3 6 3-3 3 7 3-3 3 7 3-3 2 5"/><circle cx="8" cy="7" r="1"/><circle cx="14" cy="11" r="1"/>',
  'cyclic-lines': '<path d="M3 4v16M9 4v16M15 4v16M21 4v16"/>',
  'time-cycles': '<path d="M2 17a5 5 0 0 1 10 0 5 5 0 0 1 10 0"/>',
  'sine-line': '<path d="M2 12c1.7-6 3.3-6 5 0s3.3 6 5 0 3.3-6 5 0 3.3 6 5 0"/>',
  'long-position':
    '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 14h16M12 7v5m-2-3 2-2 2 2"/>',
  'short-position':
    '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 10h16M12 12v5m-2-2 2 2 2-2"/>',
  forecast:
    '<path d="m5 18 11-9"/><circle cx="4" cy="19" r="1.5"/><circle cx="17" cy="8" r="1.5"/><rect x="14" y="2" width="7" height="3.5" rx="1"/><path d="M17 8v12" stroke-dasharray="2 2"/>',
  'bars-pattern':
    '<path d="M5 5v10M3.5 8H5m0 4h1.5M10 3v9M8.5 5H10m0 5h1.5"/><path d="M15 12v9m-1.5-6H15m0 4h1.5M20 10v8m-1.5-6H20m0 4h1.5" stroke-dasharray="2 1.5"/>',
  'ghost-feed':
    '<rect x="3" y="11" width="4" height="6" rx=".5"/><path d="M5 8v3m0 6v3"/><rect x="10" y="7" width="4" height="6" rx=".5" stroke-dasharray="2 1.5"/><path d="M12 4v3m0 6v3"/><rect x="17" y="5" width="4" height="5" rx=".5" stroke-dasharray="2 1.5"/><path d="M19 2v3m0 5v3"/>',
  projection: '<path d="M4 20 13 3M4 20l17-8"/><path d="M13 3a19 19 0 0 1 8 9"/>',
  'anchored-vwap':
    '<path d="M5 17c3-1 4-7 8-7s5 3 8 1"/><circle cx="5" cy="17" r="2"/><path d="M5 4v9M5 21v-2" stroke-dasharray="2 2"/>',
  'fixed-range-volume-profile':
    '<path d="M4 3v18M20 3v18M4 6h6M4 10h10M4 14h7M4 18h4"/><path d="M4 10h16" stroke-dasharray="2 2"/>',
  'date-range': '<path d="M3 7v10M21 7v10M3 12h18m-15-3-3 3 3 3m12-6 3 3-3 3"/>',
  'price-range': '<path d="M7 3h10M7 21h10M12 3v18m-3-15 3-3 3 3m-6 12 3 3 3-3"/>',
  'date-price-range':
    '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="m7 17 10-10m-5 0h5v5"/>',
  brush: '<path d="M3 17c2-9 5-14 7-11s-5 13 0 13c3 0 4-8 6-8s-1 8 5 3"/>',
  highlighter: '<path d="m8 15 8-11 5 4-8 11-5-4ZM8 15l-4 6h7M3 21h13"/>',
  arrow: '<path d="M4 20 20 4m-9 0h9v9"/>',
  'arrow-marker': '<path d="M3 9.5h10V5l8 7-8 7v-4.5H3v-5Z"/>',
  'arrow-mark-up': '<path d="M12 3 5 11h4.5v9h5v-9H19l-7-8Z"/>',
  'arrow-mark-down': '<path d="M12 21 5 13h4.5V4h5v9H19l-7 8Z"/>',
  rectangle: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  triangle: '<path d="m12 4 9 16H3L12 4Z"/>',
  polyline:
    '<path d="m3 17 5-10 8 9 5-12"/><circle cx="8" cy="7" r="1.5"/><circle cx="16" cy="16" r="1.5"/>',
  'rotated-rectangle': '<path d="m3 14 9-10 9 7-9 10-9-7Z"/>',
  circle: '<circle cx="12" cy="12" r="8"/><path d="M12 12h8"/><circle cx="12" cy="12" r=".8"/>',
  path: '<path d="m3 19 6-9 5 5 6-10m-5 0h5v5"/>',
  arc: '<path d="M3 18a9 8 0 0 1 18 0"/><path d="M3 18h18" stroke-dasharray="2 3"/>',
  curve: '<path d="M3 19Q12 0 21 19"/>',
  'double-curve': '<path d="M3 12Q7.5 1 12 12t9 0"/>',
  text: '<path d="M5 7V4h14v3M12 4v16m-4 0h8"/>',
  callout: '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',
  'price-label': '<path d="m3 12 6-7h12v14H9l-6-7Z"/><circle cx="9" cy="12" r="1"/>',
  note: '<path d="M5 4h14v10l-5 5H5V4Z"/><path d="M14 19v-5h5M8 8h8m-8 3h5"/>',
  'price-note':
    '<circle cx="5" cy="18" r="1.5"/><path d="m6 17 5-5"/><rect x="11" y="5" width="10" height="7" rx="1"/><path d="M14 8.5h4"/>',
  pin: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11Z"/><circle cx="12" cy="10" r="2"/>',
  signpost:
    '<path d="M12 21V11"/><rect x="5" y="4" width="14" height="7" rx="1"/><path d="M8 7.5h8"/>',
  'flag-mark': '<path d="M6 21V4c4-2 7 2 12 0v8c-5 2-8-2-12 0"/>',
  comment:
    '<path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>',
  table: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 14.5h18M10 5v14"/>',
  'anchored-text': '<path d="M8 8V7h8v1M12 7v10m-2 0h4M3 7V3h4m10 0h4v4M3 17v4h4m10 0h4v-4"/>',
  'anchored-note':
    '<path d="M7 7h10v6l-4 4H7V7Z"/><path d="M13 17v-4h4M3 6V3h3m12 0h3v3M3 18v3h3m12 0h3v-3"/>',
};
