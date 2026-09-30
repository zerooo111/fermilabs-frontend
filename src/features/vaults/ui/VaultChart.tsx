/**
 * Time series chart for vault history, built on the same Lightweight Charts
 * setup as the trading terminal.
 *
 * `area` draws a cream line with a soft fill, for account value and share
 * price. `baseline` splits green and red around zero, for PnL.
 */
import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  BaselineSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

import { readChartColors, withAlpha } from '@/shared/lib/color-tokens';

export type VaultChartMode = 'area' | 'baseline';

export function VaultChart({
  data,
  mode,
  formatValue,
  height,
  minimal = false,
}: {
  data: { time: number; value: number }[];
  mode: VaultChartMode;
  formatValue: (n: number) => string;
  /** Pixel height. Leave unset to fill the parent. */
  height?: number;
  /** Hides both axes, for small preview charts. */
  minimal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Baseline'> | null>(null);
  const formatRef = useRef(formatValue);
  formatRef.current = formatValue;

  useEffect(() => {
    if (!containerRef.current) return;

    const colors = readChartColors();
    const fg = colors.neutral;
    const { up, down, crosshair } = colors;
    const labelBg = colors.labelBackground;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: colors.text,
        fontFamily: 'Geist Mono, monospace',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        // The panel behind the chart draws the grid, so the chart draws none.
        horzLines: { visible: false },
      },
      rightPriceScale: {
        visible: !minimal,
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        visible: !minimal,
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: crosshair, style: 3, labelBackgroundColor: labelBg },
        horzLine: {
          color: crosshair,
          style: 3,
          labelBackgroundColor: labelBg,
          visible: !minimal,
        },
      },
      localization: { priceFormatter: (n: number) => formatRef.current(n) },
      handleScroll: !minimal,
      handleScale: !minimal,
    });

    const series =
      mode === 'baseline'
        ? chart.addSeries(BaselineSeries, {
            baseValue: { type: 'price', price: 0 },
            topLineColor: up,
            topFillColor1: withAlpha(up, 0.25),
            topFillColor2: withAlpha(up, 0.02),
            bottomLineColor: down,
            bottomFillColor1: withAlpha(down, 0.02),
            bottomFillColor2: withAlpha(down, 0.25),
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: !minimal,
          })
        : chart.addSeries(AreaSeries, {
            lineColor: fg,
            topColor: withAlpha(fg, 0.18),
            bottomColor: withAlpha(fg, 0),
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: !minimal,
          });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [mode, minimal]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(data.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));
    chartRef.current.timeScale().fitContent();
  }, [data, mode, minimal]);

  return <div ref={containerRef} style={{ height: height ?? '100%' }} className="w-full" />;
}
