/**
 * Perps chart component
 * Optimized with memoization for better performance
 * Uses TradingView lightweight charts for perps data visualization
 */
import {
  createChart,
  ColorType,
  ISeriesApi,
  IChartApi,
  Time,
  CandlestickData,
  HistogramData,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  TimeScaleOptions,
  TickMarkFormatter,
  BusinessDay,
  DeepPartial,
  ChartOptions,
  MouseEventParams,
} from 'lightweight-charts';
import { useEffect, useRef, memo, useMemo, useCallback, useState } from 'react';
import { ExtendedPerpsOHLCVData, PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import { Loader2, AlertCircle } from 'lucide-react';
import { CHART_CONFIG } from '@/features/chart/lib/chart-constants';
import { useResizeObserver } from '@/shared/hooks/useResizeObserver';
import { cn } from '@/lib/utils';

export type PerpsChartType = 'candlestick' | 'line' | 'area' | 'bar';

// Offset UTC timestamps so lightweight-charts (which assumes UTC) displays local time
const tzOffsetSeconds = new Date().getTimezoneOffset() * -60;
const toLocalTimestamp = (utcSeconds: number): number => utcSeconds + tzOffsetSeconds;

// Custom hook to get CSS custom properties
const useChartColors = () => {
  return useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      buyColor: root.getPropertyValue('--color-buy-chart')?.trim() || '#10b981',
      sellColor: root.getPropertyValue('--color-sell-chart')?.trim() || '#ef4444',
    };
  }, []);
};

// Visible bars on first mount, per timeframe. Chosen so the initial window
// covers a useful slice of history regardless of timeframe.
const getInitialVisibleBars = (interval: PerpsTimeframe): number => {
  switch (interval) {
    case '1m':
      return 240; // 4 hours
    case '5m':
      return 288; // 24 hours
    case '15m':
      return 192; // 48 hours
    case '1h':
      return 168; // 7 days
    case '4h':
      return 120; // 20 days
    case '1d':
      return 60; // 60 days
    default:
      return 120;
  }
};

const formatLegendTime = (utcSeconds: number, interval: PerpsTimeframe): string => {
  const d = new Date(utcSeconds * 1000);
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (interval === '1d') return `${yyyy}-${mo}-${dd}`;
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
};

const formatLegendPrice = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

interface PerpsChartComponentProps {
  data: ExtendedPerpsOHLCVData[];
  interval: PerpsTimeframe;
  chartType?: PerpsChartType;
  onLoadMoreData?: (earliestLoadedTime: number) => Promise<void>;
  isLoading?: boolean;
  isRefreshing?: boolean;
  isLoadingOlder?: boolean;
  reachedBeginningOfHistory?: boolean;
  error?: Error | null;
  selectedMarketName?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  entryPrice?: number | null;
  unrealizedPnl?: number | null;
  colors?: {
    backgroundColor?: string;
    upColor?: string;
    downColor?: string;
    textColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    gridColor?: string;
  };
  className?: string;
}

interface HoveredCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type PriceSeriesDatum = CandlestickData<Time> | { time: Time; value: number };

const getPerpsTimeScaleOptions = (interval: PerpsTimeframe): Partial<TimeScaleOptions> => {
  // Timestamps are pre-shifted by local tz offset, so use UTC methods to read them
  const formatTime: TickMarkFormatter = (time: Time) => {
    let timestamp: number;
    if (typeof time === 'number') {
      timestamp = time;
    } else if (typeof time === 'string') {
      timestamp = Math.floor(new Date(time).getTime() / 1000);
    } else {
      const { year, month, day } = time as BusinessDay;
      timestamp = Math.floor(Date.UTC(year, month - 1, day) / 1000);
    }

    const date = new Date(timestamp * 1000);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const mo = date.getUTCMonth() + 1;
    const dd = date.getUTCDate();

    switch (interval) {
      case '1m':
      case '5m':
      case '15m':
        return `${hh}:${mm}`;
      case '1h':
      case '4h':
        return `${mo}/${dd} ${hh}:00`;
      case '1d':
        return `${mo}/${dd}`;
      default:
        return `${mo}/${dd}`;
    }
  };

  return {
    timeVisible: true,
    secondsVisible: interval === '1m',
    tickMarkFormatter: formatTime,
    borderVisible: false,
  };
};

// Validate candle data
const isValidCandle = (item: ExtendedPerpsOHLCVData): boolean => {
  return (
    item.time !== undefined &&
    !isNaN(Number(item.time)) &&
    item.open !== undefined &&
    item.open > 0 && // Price must be positive
    item.high !== undefined &&
    item.high > 0 &&
    item.low !== undefined &&
    item.low > 0 &&
    item.close !== undefined &&
    item.close > 0 &&
    !isNaN(item.open) &&
    !isNaN(item.high) &&
    !isNaN(item.low) &&
    !isNaN(item.close) &&
    item.high >= item.open &&
    item.high >= item.close &&
    item.low <= item.open &&
    item.low <= item.close &&
    item.high >= item.low &&
    item.high < Number.MAX_SAFE_INTEGER
  );
};

function PerpsChartComponent({
  data,
  interval,
  chartType = 'candlestick',
  colors,
  className,
  isLoading,
  isRefreshing,
  isLoadingOlder,
  reachedBeginningOfHistory,
  error,
  selectedMarketName,
  stopLoss,
  takeProfit,
  entryPrice,
  unrealizedPnl,
  onLoadMoreData,
}: PerpsChartComponentProps) {
  const [hoveredCandle, setHoveredCandle] = useState<HoveredCandle | null>(null);
  const chartColors = useChartColors();

  const {
    backgroundColor = 'transparent',
    upColor = chartColors.buyColor,
    downColor = chartColors.sellColor,
    textColor = '#94a3b8', // Subtle text color
    wickUpColor = chartColors.buyColor,
    wickDownColor = chartColors.sellColor,
    gridColor = 'rgba(148, 163, 184, 0.1)', // Very subtle grid
  } = colors || {};

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const isInitialMountRef = useRef(true);
  const previousDataRef = useRef<PriceSeriesDatum[]>([]);
  const previousVolumeDataRef = useRef<HistogramData<Time>[]>([]);
  const isMountedRef = useRef(true);
  const lastLoadMoreEarliestRef = useRef<number | null>(null);
  const onLoadMoreDataRef = useRef(onLoadMoreData);
  const dataRef = useRef(data);
  const reachedBeginningRef = useRef(Boolean(reachedBeginningOfHistory));
  useEffect(() => {
    onLoadMoreDataRef.current = onLoadMoreData;
  }, [onLoadMoreData]);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    reachedBeginningRef.current = Boolean(reachedBeginningOfHistory);
  }, [reachedBeginningOfHistory]);
  const stopLossLineRef = useRef<ReturnType<ISeriesApi<any>['createPriceLine']> | null>(null);
  const takeProfitLineRef = useRef<ReturnType<ISeriesApi<any>['createPriceLine']> | null>(null);
  const entryPriceLineRef = useRef<ReturnType<ISeriesApi<any>['createPriceLine']> | null>(null);
  const previousValuesRef = useRef<{
    stopLoss: number | null | undefined;
    takeProfit: number | null | undefined;
    entryPrice: number | null | undefined;
    unrealizedPnl: number | null | undefined;
  }>({
    stopLoss: undefined,
    takeProfit: undefined,
    entryPrice: undefined,
    unrealizedPnl: undefined,
  });

  // Use ResizeObserver for container-specific resizing
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null
  );

  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    if (entry.contentBoxSize) {
      const size = entry.contentBoxSize[0];
      setContainerSize({
        width: size.inlineSize,
        height: size.blockSize,
      });
    } else {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    }
  }, []);

  useResizeObserver(chartContainerRef, handleResize);

  // Handle resize with ResizeObserver
  useEffect(() => {
    if (containerSize && chartRef.current && isMountedRef.current) {
      chartRef.current.applyOptions({
        width: containerSize.width,
        height: containerSize.height,
      });
    }
  }, [containerSize]);

  // Transform data helper function - optimized single-pass transformation
  const transformData = useCallback(
    (dataToTransform: ExtendedPerpsOHLCVData[]) => {
      const validData: CandlestickData<Time>[] = [];
      const volumeData: HistogramData<Time>[] = [];
      let lastTimeValue: number | null = null;
      let requiresSort = false;

      for (const item of dataToTransform) {
        // Validate and transform in one pass
        if (!isValidCandle(item)) {
          continue;
        }

        const rawTime = typeof item.time === 'number' ? item.time : Number(item.time);
        if (isNaN(rawTime)) {
          continue;
        }

        const timeValue = toLocalTimestamp(rawTime);
        const time = timeValue as Time;
        const candle: CandlestickData<Time> = {
          time,
          open: item.open!,
          high: item.high!,
          low: item.low!,
          close: item.close!,
        };

        if (typeof item.volume === 'number' && Number.isFinite(item.volume) && item.volume >= 0) {
          volumeData.push({
            time,
            value: item.volume,
            color: item.close! >= item.open! ? `${upColor}80` : `${downColor}80`,
          });
        }

        // Check if data is already sorted (most common case)
        if (lastTimeValue !== null && timeValue < lastTimeValue) {
          requiresSort = true;
          validData.push(candle);
        } else {
          // Data is sorted, add in order
          validData.push(candle);
          lastTimeValue = timeValue;
        }
      }

      if (requiresSort) {
        validData.sort((a, b) => Number(a.time) - Number(b.time));
        volumeData.sort((a, b) => Number(a.time) - Number(b.time));
      }

      return { candleData: validData, volumeData };
    },
    [downColor, upColor]
  );

  // Initialize chart (only when interval or colors change, not when data changes)
  useEffect(() => {
    isMountedRef.current = true;

    try {
      if (!chartContainerRef.current || !isMountedRef.current) return;

      // Clean up existing chart if it exists
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        volumeSeriesRef.current = null;
      }

      const { clientWidth, clientHeight } = chartContainerRef.current;

      // Chart options optimized for perps
      const chartOptions: DeepPartial<ChartOptions> = {
        layout: {
          background: { type: ColorType.Solid, color: backgroundColor },
          textColor,
          fontFamily: 'Geist Mono, sans-serif',
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        timeScale: {
          borderColor: gridColor,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 0, // Ensure we start at the right edge
          ...getPerpsTimeScaleOptions(interval),
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: {
            top: CHART_CONFIG.PRICE_SCALE_MARGIN_TOP,
            bottom: 0.3,
          },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: 'rgba(148, 163, 184, 0.4)',
            style: 3,
          },
          horzLine: {
            width: 1,
            color: 'rgba(148, 163, 184, 0.4)',
            style: 3,
          },
        },
        width: clientWidth,
        height: clientHeight,
      };

      const chart = createChart(chartContainerRef.current, chartOptions);
      chartRef.current = chart;

      // Create series based on chart type
      let series: ISeriesApi<any>;
      switch (chartType) {
        case 'line':
          series = chart.addSeries(LineSeries, {
            color: upColor,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            lastValueVisible: true,
            priceLineVisible: true,
          });
          break;
        case 'area':
          series = chart.addSeries(AreaSeries, {
            lineColor: upColor,
            topColor: `${upColor}40`,
            bottomColor: `${upColor}05`,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            lastValueVisible: true,
            priceLineVisible: true,
          });
          break;
        case 'bar':
          series = chart.addSeries(BarSeries, {
            upColor,
            downColor,
            thinBars: false,
          });
          break;
        case 'candlestick':
        default:
          series = chart.addSeries(CandlestickSeries, {
            upColor,
            downColor,
            borderVisible: false,
            wickUpColor,
            wickDownColor,
            borderUpColor: upColor,
            borderDownColor: downColor,
          });
          break;
      }

      if (!series) {
        throw new Error('Failed to create chart series');
      }

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(148, 163, 184, 0.5)',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
        borderVisible: false,
      });

      seriesRef.current = series;
      volumeSeriesRef.current = volumeSeries;
      isInitialMountRef.current = true;
      previousDataRef.current = [];
      previousVolumeDataRef.current = [];
      stopLossLineRef.current = null;
      takeProfitLineRef.current = null;
      entryPriceLineRef.current = null;
      lastLoadMoreEarliestRef.current = null;

      // Subscribe to visible-range changes so we can request more history
      // when the user scrolls past the currently loaded left edge.
      const timeScale = chart.timeScale();
      const handleVisibleLogicalRangeChange = (
        range: { from: number; to: number } | null
      ): void => {
        if (!range) return;
        if (reachedBeginningRef.current) return;
        const loadedCount = previousDataRef.current.length;
        if (loadedCount === 0) return;
        if (range.from > CHART_CONFIG.LOAD_MORE_THRESHOLD_BARS) return;

        const currentData = dataRef.current;
        if (!currentData || currentData.length === 0) return;
        const earliestTime = currentData[0]?.time;
        if (typeof earliestTime !== 'number') return;

        // Don't re-request the same boundary repeatedly — the effect would
        // otherwise fire on every scroll tick until new data arrives.
        if (lastLoadMoreEarliestRef.current === earliestTime) return;
        lastLoadMoreEarliestRef.current = earliestTime;

        const cb = onLoadMoreDataRef.current;
        if (!cb) return;
        Promise.resolve(cb(earliestTime)).catch(() => {
          /* parent surfaces errors via toast */
        });
      };
      timeScale.subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

      // Subscribe to crosshair move for the OHLC legend. When the crosshair
      // leaves the chart we fall back to the most recent candle.
      const seriesForCrosshair = seriesRef.current;
      const handleCrosshairMove = (param: MouseEventParams): void => {
        if (!isMountedRef.current) return;
        if (!param.time || !seriesForCrosshair) {
          setHoveredCandle(null);
          return;
        }
        const seriesData = param.seriesData.get(seriesForCrosshair);
        if (!seriesData) {
          setHoveredCandle(null);
          return;
        }
        const t = typeof param.time === 'number' ? (param.time as number) : Number(param.time);
        const localSeconds = t - tzOffsetSeconds;
        const candle = seriesData as Partial<CandlestickData<Time>> & { value?: number };
        const open = candle.open ?? candle.value;
        const high = candle.high ?? candle.value;
        const low = candle.low ?? candle.value;
        const close = candle.close ?? candle.value;
        if (
          typeof open !== 'number' ||
          typeof high !== 'number' ||
          typeof low !== 'number' ||
          typeof close !== 'number'
        ) {
          setHoveredCandle(null);
          return;
        }
        setHoveredCandle({ time: localSeconds, open, high, low, close });
      };
      chart.subscribeCrosshairMove(handleCrosshairMove);

      // Note: Data will be set in the separate data update effect
      // This separation prevents chart recreation on data changes
    } catch (err) {
      console.error('Error initializing chart:', err);
    }

    return () => {
      isMountedRef.current = false;
      try {
        if (chartRef.current) {
          // Clean up price lines
          if (seriesRef.current && stopLossLineRef.current) {
            seriesRef.current.removePriceLine(stopLossLineRef.current);
            stopLossLineRef.current = null;
          }
          if (seriesRef.current && takeProfitLineRef.current) {
            seriesRef.current.removePriceLine(takeProfitLineRef.current);
            takeProfitLineRef.current = null;
          }
          chartRef.current.remove();
          chartRef.current = null;
          seriesRef.current = null;
          volumeSeriesRef.current = null;
        }
      } catch (error) {
        console.error('Error cleaning up chart:', error);
      }
    };
  }, [
    interval,
    chartType,
    backgroundColor,
    upColor,
    downColor,
    textColor,
    wickUpColor,
    wickDownColor,
    gridColor,
  ]);

  // Update data separately
  useEffect(() => {
    if (
      !chartRef.current ||
      !seriesRef.current ||
      !volumeSeriesRef.current ||
      !data ||
      data.length === 0
    )
      return;

    try {
      const timeScale = chartRef.current.timeScale();

      // Transform the data
      const { candleData, volumeData } = transformData(data);

      // Only update if we have valid data
      if (candleData.length === 0) return;

      // For line/area series, convert to { time, value } format using close price
      const isLineType = chartType === 'line' || chartType === 'area';
      const validTransformedData: any[] = isLineType
        ? candleData.map(c => ({ time: c.time, value: c.close }))
        : candleData;

      // Check if this is initial mount
      const isInitialMount = isInitialMountRef.current;
      const previousData = previousDataRef.current;
      const previousVolumeData = previousVolumeDataRef.current;

      // If older candles were prepended (earliest time moved back), allow
      // subsequent loadMore requests for the new boundary.
      const newEarliest = validTransformedData[0]?.time;
      const prevEarliest = previousData[0]?.time;
      if (
        typeof newEarliest === 'number' &&
        typeof prevEarliest === 'number' &&
        newEarliest < prevEarliest
      ) {
        lastLoadMoreEarliestRef.current = null;
      }

      // Check if data actually changed (skip update if identical)
      // Optimized: Compare length and last candle only for better performance
      if (
        !isInitialMount &&
        previousData.length === validTransformedData.length &&
        previousVolumeData.length === volumeData.length
      ) {
        const lastPrevious = previousData[previousData.length - 1];
        const lastNew = validTransformedData[validTransformedData.length - 1];
        const lastPreviousVolume = previousVolumeData[previousVolumeData.length - 1];
        const lastNewVolume = volumeData[volumeData.length - 1];

        // Quick check: if last data point hasn't changed, likely no change
        const lastUnchanged = isLineType
          ? lastPrevious?.time === lastNew?.time && lastPrevious?.value === lastNew?.value
          : lastPrevious?.time === lastNew?.time &&
            lastPrevious?.open === lastNew?.open &&
            lastPrevious?.high === lastNew?.high &&
            lastPrevious?.low === lastNew?.low &&
            lastPrevious?.close === lastNew?.close;
        const lastVolumeUnchanged =
          lastPreviousVolume?.time === lastNewVolume?.time &&
          lastPreviousVolume?.value === lastNewVolume?.value &&
          lastPreviousVolume?.color === lastNewVolume?.color;

        if (lastPrevious && lastNew && lastUnchanged && lastVolumeUnchanged) {
          const dataChanged = previousData.some((prev, idx) => {
            const curr = validTransformedData[idx];
            if (!curr || prev.time !== curr.time) return true;
            if (isLineType) return prev.value !== curr.value;
            return (
              prev.open !== curr.open ||
              prev.high !== curr.high ||
              prev.low !== curr.low ||
              prev.close !== curr.close
            );
          });
          const volumeChanged = previousVolumeData.some((prev, idx) => {
            const curr = volumeData[idx];
            return (
              !curr ||
              prev.time !== curr.time ||
              prev.value !== curr.value ||
              prev.color !== curr.color
            );
          });

          if (!dataChanged && !volumeChanged) {
            return;
          }
        }
      }

      // Check scroll position - only use incremental updates if user is at the end
      // This prevents auto-scroll when user has scrolled away
      const scrollPosition = timeScale.scrollPosition();
      const isScrolledToEnd = scrollPosition === -1;

      // Determine if we can do an incremental update
      // Only use incremental updates if user is at the end to avoid auto-scroll
      const canIncrementalUpdate =
        !isInitialMount &&
        previousData.length > 0 &&
        validTransformedData.length >= previousData.length &&
        isScrolledToEnd;

      if (canIncrementalUpdate) {
        // Try to update only the last candle if it's just a price update
        const lastPrevious = previousData[previousData.length - 1];
        const lastNew = validTransformedData[validTransformedData.length - 1];

        // If same timestamp, just update the last candle
        if (lastPrevious && lastNew && lastPrevious.time === lastNew.time) {
          seriesRef.current.update(lastNew);
          if (volumeData.length > 0) {
            const lastVolume = volumeData[volumeData.length - 1];
            if (lastVolume) {
              volumeSeriesRef.current.update(lastVolume);
            }
          }
          previousDataRef.current = validTransformedData;
          previousVolumeDataRef.current = volumeData;
          return;
        }

        // Check if only new candles were added at the end
        const newCandlesCount = validTransformedData.length - previousData.length;
        if (newCandlesCount > 0 && newCandlesCount <= CHART_CONFIG.MAX_INCREMENTAL_CANDLES) {
          // Only a few new candles, add them incrementally
          const newCandles = validTransformedData.slice(-newCandlesCount);
          newCandles.forEach(candle => {
            seriesRef.current?.update(candle);
          });
          const newVolumeBars = volumeData.slice(-newCandlesCount);
          newVolumeBars.forEach(bar => {
            volumeSeriesRef.current?.update(bar);
          });
          previousDataRef.current = validTransformedData;
          previousVolumeDataRef.current = volumeData;
          return;
        }
      }

      // Full data update needed
      // Production best practice: Handle initial mount to prevent auto-fit scroll left
      if (isInitialMount && validTransformedData.length > 0) {
        // On initial mount: Set data and immediately constrain visible range
        // This prevents the chart from auto-fitting to show all historical data
        seriesRef.current.setData(validTransformedData);
        volumeSeriesRef.current.setData(volumeData);

        // Calculate visible range BEFORE the chart auto-fits. The bar count
        // is timeframe-aware so the initial zoom feels consistent across
        // intervals.
        const visibleCandles = Math.min(
          getInitialVisibleBars(interval),
          validTransformedData.length
        );
        const fromIndex = Math.max(0, validTransformedData.length - visibleCandles);
        const fromTime = validTransformedData[fromIndex].time;
        const toTime = validTransformedData[validTransformedData.length - 1].time;

        // Use double requestAnimationFrame to ensure chart has fully processed setData
        // and completed its internal layout calculations before we override with visible range
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              if (!isMountedRef.current || !chartRef.current) return;

              const timeScale = chartRef.current.timeScale();

              // Set visible range to show recent candles (overrides auto-fit scroll left)
              // This must happen after chart's internal fitContent completes
              timeScale.setVisibleRange({
                from: fromTime as Time,
                to: toTime as Time,
              });
            } catch (error) {
              console.error('Error setting initial visible range:', error);
              // Fallback: try scrolling to end
              try {
                if (chartRef.current) {
                  chartRef.current.timeScale().scrollToPosition(-1, true);
                }
              } catch (scrollError) {
                console.error('Error scrolling chart:', scrollError);
              }
            }
          });
        });

        isInitialMountRef.current = false;
      } else {
        // Subsequent updates: Just update data, preserve user's scroll position
        seriesRef.current.setData(validTransformedData);
        volumeSeriesRef.current.setData(volumeData);
      }

      // Update ref
      previousDataRef.current = validTransformedData;
      previousVolumeDataRef.current = volumeData;
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [data, chartType, transformData, interval]);

  // Update stop loss and take profit price lines
  useEffect(() => {
    if (!seriesRef.current) return;
    // Only create price lines if we have data
    if (!data || data.length === 0) return;

    // Check which specific values have changed
    const stopLossChanged = previousValuesRef.current.stopLoss !== stopLoss;
    const takeProfitChanged = previousValuesRef.current.takeProfit !== takeProfit;
    const entryPriceChanged = previousValuesRef.current.entryPrice !== entryPrice;
    const pnlChanged = previousValuesRef.current.unrealizedPnl !== unrealizedPnl;

    // Check if lines should exist based on current values
    const shouldHaveStopLoss = stopLoss !== null && stopLoss !== undefined && stopLoss > 0;
    const shouldHaveTakeProfit = takeProfit !== null && takeProfit !== undefined && takeProfit > 0;
    const shouldHaveEntryPrice = entryPrice !== null && entryPrice !== undefined && entryPrice > 0;

    // Check if we need to update anything - only recreate when price values change, not PnL
    const needsStopLossUpdate =
      stopLossChanged ||
      (shouldHaveStopLoss && stopLossLineRef.current === null) ||
      (!shouldHaveStopLoss && stopLossLineRef.current !== null);
    const needsTakeProfitUpdate =
      takeProfitChanged ||
      (shouldHaveTakeProfit && takeProfitLineRef.current === null) ||
      (!shouldHaveTakeProfit && takeProfitLineRef.current !== null);
    const needsEntryPriceUpdate =
      entryPriceChanged ||
      pnlChanged || // Recreate when PnL changes for dynamic color/label
      (shouldHaveEntryPrice && entryPriceLineRef.current === null) ||
      (!shouldHaveEntryPrice && entryPriceLineRef.current !== null);

    // If nothing needs updating, skip
    if (!needsStopLossUpdate && !needsTakeProfitUpdate && !needsEntryPriceUpdate) {
      return;
    }

    // Update previous values for change detection
    previousValuesRef.current = {
      stopLoss,
      takeProfit,
      entryPrice,
      unrealizedPnl,
    };

    // Capture update flags in closure
    const shouldUpdateStopLoss = needsStopLossUpdate;
    const shouldUpdateTakeProfit = needsTakeProfitUpdate;
    const shouldUpdateEntryPrice = needsEntryPriceUpdate;

    // Wait a bit to ensure chart is fully initialized
    const timeoutId = setTimeout(() => {
      if (!seriesRef.current) return;

      // Re-check if data exists before creating lines (data might have been cleared)
      if (!data || data.length === 0) {
        if (stopLossLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(stopLossLineRef.current);
          } catch {
            /* ignore */
          }
          stopLossLineRef.current = null;
        }
        if (takeProfitLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(takeProfitLineRef.current);
          } catch {
            /* ignore */
          }
          takeProfitLineRef.current = null;
        }
        if (entryPriceLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(entryPriceLineRef.current);
          } catch {
            /* ignore */
          }
          entryPriceLineRef.current = null;
        }
        return;
      }

      if (shouldUpdateStopLoss && stopLossLineRef.current) {
        try {
          seriesRef.current.removePriceLine(stopLossLineRef.current);
        } catch {
          /* ignore */
        }
        stopLossLineRef.current = null;
      }
      if (shouldUpdateTakeProfit && takeProfitLineRef.current) {
        try {
          seriesRef.current.removePriceLine(takeProfitLineRef.current);
        } catch {
          /* ignore */
        }
        takeProfitLineRef.current = null;
      }
      if (shouldUpdateEntryPrice && entryPriceLineRef.current) {
        try {
          seriesRef.current.removePriceLine(entryPriceLineRef.current);
        } catch {
          /* ignore */
        }
        entryPriceLineRef.current = null;
      }

      if (shouldUpdateStopLoss && stopLoss !== null && stopLoss !== undefined && stopLoss > 0) {
        try {
          stopLossLineRef.current = seriesRef.current.createPriceLine({
            price: stopLoss,
            color: chartColors.sellColor,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'SL',
          });
        } catch {
          /* ignore */
        }
      }

      if (
        shouldUpdateTakeProfit &&
        takeProfit !== null &&
        takeProfit !== undefined &&
        takeProfit > 0
      ) {
        try {
          takeProfitLineRef.current = seriesRef.current.createPriceLine({
            price: takeProfit,
            color: chartColors.buyColor,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'TP',
          });
        } catch {
          /* ignore */
        }
      }

      if (
        shouldUpdateEntryPrice &&
        entryPrice !== null &&
        entryPrice !== undefined &&
        entryPrice > 0
      ) {
        try {
          const pnlValue = unrealizedPnl ?? 0;
          const isProfit = pnlValue >= 0;
          const pnlPrefix = isProfit ? '+' : '';
          const pnlFormatted = `${pnlPrefix}${pnlValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
          const entryColor = isProfit ? chartColors.buyColor : chartColors.sellColor;
          entryPriceLineRef.current = seriesRef.current.createPriceLine({
            price: entryPrice,
            color: entryColor,
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: pnlFormatted,
          });
        } catch {
          /* ignore */
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [stopLoss, takeProfit, entryPrice, unrealizedPnl, data, chartColors]);

  const hasNoData = !data || data.length === 0;
  const showLoading = (Boolean(isLoading) || hasNoData) && !error;
  const showErrorOverlay = Boolean(error) && hasNoData;

  // The candle displayed in the OHLC legend: hovered candle, or the latest
  // when the crosshair is outside the chart.
  const legendCandle: HoveredCandle | null = useMemo(() => {
    if (hoveredCandle) return hoveredCandle;
    if (!data || data.length === 0) return null;
    for (let i = data.length - 1; i >= 0; i--) {
      const c = data[i];
      if (
        c.open !== undefined &&
        c.high !== undefined &&
        c.low !== undefined &&
        c.close !== undefined
      ) {
        return {
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        };
      }
    }
    return null;
  }, [hoveredCandle, data]);

  const legendChangePct = useMemo(() => {
    if (!legendCandle || !legendCandle.open) return null;
    const diff = legendCandle.close - legendCandle.open;
    const pct = (diff / legendCandle.open) * 100;
    return { pct, isPositive: diff >= 0 };
  }, [legendCandle]);

  const ariaLabel = selectedMarketName ? `Price chart for ${selectedMarketName}` : 'Price chart';

  return (
    <div
      ref={chartContainerRef}
      className={cn('w-full h-full relative', className)}
      style={{ minHeight: `${CHART_CONFIG.MIN_CHART_HEIGHT}px` }}
      role="img"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* OHLC legend */}
      {legendCandle && (
        <div className="pointer-events-none absolute top-2 left-2 z-20 flex flex-col gap-0.5 font-mono text-[11px] text-white/80">
          <div className="flex items-center gap-2">
            {selectedMarketName && <span className="text-white">{selectedMarketName}</span>}
            <span className="uppercase text-white/50">{interval}</span>
            <span className="text-white/40">{formatLegendTime(legendCandle.time, interval)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              <span className="text-white/40">O</span> {formatLegendPrice(legendCandle.open)}
            </span>
            <span>
              <span className="text-white/40">H</span> {formatLegendPrice(legendCandle.high)}
            </span>
            <span>
              <span className="text-white/40">L</span> {formatLegendPrice(legendCandle.low)}
            </span>
            <span>
              <span className="text-white/40">C</span> {formatLegendPrice(legendCandle.close)}
            </span>
            {legendChangePct && (
              <span
                className={cn(
                  legendChangePct.pct === 0
                    ? 'text-white/60'
                    : legendChangePct.isPositive
                      ? 'text-success'
                      : 'text-danger'
                )}
              >
                {legendChangePct.pct === 0 ? '' : legendChangePct.isPositive ? '+' : ''}
                {legendChangePct.pct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Load-older indicator (left edge) */}
      {isLoadingOlder && (
        <div
          className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/80 backdrop-blur-sm"
          aria-live="polite"
        >
          <Loader2 className="size-3 animate-spin" />
          <span>Loading earlier history…</span>
        </div>
      )}
      {reachedBeginningOfHistory && !isLoadingOlder && !hasNoData && (
        <div className="pointer-events-none absolute bottom-8 left-2 z-20 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/50 backdrop-blur-sm">
          Beginning of history
        </div>
      )}

      {isRefreshing && (
        <div className="absolute top-2 right-2 z-20">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {showErrorOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="size-6 text-destructive" />
            <span className="text-sm text-muted-foreground">
              {error?.message || 'Failed to load chart'}
            </span>
          </div>
        </div>
      )}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading chart data...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export const PerpsChart = memo(PerpsChartComponent);
