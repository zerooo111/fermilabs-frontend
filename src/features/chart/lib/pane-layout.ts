/**
 * Where CandleFrame puts its indicator panes, so HTML controls can sit on
 * them. CandleFrame exports the geometry types but not the layout, so this
 * mirrors `geometryForRanges` in candleframe/dist/lib/geometry.js (0.3.0);
 * recheck it when the vendored tarball changes.
 */
import type { ResolvedChartTheme } from 'candleframe/chart';

export interface PaneRect {
  /** Indicator id; CandleFrame keys separate panes by it. */
  id: string;
  top: number;
  height: number;
  /**
   * The empty band above the pane: from the price plot's bottom (or the pane
   * above) to this pane's top. CandleFrame draws its lines inside it, two
   * above the first pane.
   */
  gap: { top: number; height: number };
}

export interface PaneLayout {
  left: number;
  plotWidth: number;
  /** Bottom of the plotted area: the last pane, or the price plot. */
  bottom: number;
  panes: PaneRect[];
}

/** `paneIds` are the visible separate-pane indicators, in document order. */
export function paneLayout(
  width: number,
  height: number,
  chart: ResolvedChartTheme['chart'],
  paneIds: readonly string[]
): PaneLayout {
  const left = chart.plotLeft;
  const plotWidth = Math.max(1, width - left - chart.priceAxisWidth);
  const available = height - chart.plotTop - chart.timeAxisHeight - chart.axisGap;
  const gap = chart.volumeGap;
  const n = paneIds.length;
  // Each pane takes a fifth of the height, within limits, and together at most 55%.
  let paneHeight = n ? Math.max(56, Math.min(140, available * 0.2)) : 0;
  if (n && n * (paneHeight + gap) > available * 0.55)
    paneHeight = Math.max(28, (available * 0.55) / n - gap);
  const priceArea = available - n * (paneHeight + gap);
  const volumeHeight = Math.min(chart.volumeHeight, Math.max(0, priceArea - gap - 1));
  const plotHeight = Math.max(1, priceArea - gap - volumeHeight);
  const volumeTop = chart.plotTop + plotHeight + gap;
  const firstTop = volumeTop + volumeHeight + gap;
  const plotBottom = chart.plotTop + plotHeight;
  const panes = paneIds.map((id, i) => {
    const top = firstTop + i * (paneHeight + gap);
    const above = i === 0 ? plotBottom : top - gap;
    return { id, top, height: paneHeight, gap: { top: above, height: top - above } };
  });
  const bottom = n ? panes[n - 1].top + paneHeight : volumeTop + volumeHeight;
  return { left, plotWidth, bottom, panes };
}
