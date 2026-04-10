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
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  TimeScaleOptions,
  TickMarkFormatter,
  BusinessDay,
  DeepPartial,
  ChartOptions,
} from 'lightweight-charts';
import { useEffect, useRef, memo, useMemo, useCallback, useState } from 'react';
import { ExtendedPerpsOHLCVData, PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import { Loader2, AlertCircle } from 'lucide-react';
import { CHART_CONFIG } from '@/features/chart/lib/chart-constants';
import { useResizeObserver } from '@/shared/hooks/useResizeObserver';

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

interface PerpsChartComponentProps {
  data: ExtendedPerpsOHLCVData[];
  interval: PerpsTimeframe;
  chartType?: PerpsChartType;
  onLoadMoreData?: (earliestLoadedTime: number) => Promise<void>;
  isLoading?: boolean;
  isRefreshing?: boolean;
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
  error,
  selectedMarketName,
  stopLoss,
  takeProfit,
  entryPrice,
  unrealizedPnl,
  onLoadMoreData,
}: PerpsChartComponentProps) {
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
  const isInitialMountRef = useRef(true);
  const previousDataRef = useRef<CandlestickData<Time>[]>([]);
  const isMountedRef = useRef(true);
  const loadMoreInFlightRef = useRef(false);
  const lastLoadMoreEarliestRef = useRef<number | null>(null);
  const onLoadMoreDataRef = useRef(onLoadMoreData);
  const dataRef = useRef(data);
  useEffect(() => {
    onLoadMoreDataRef.current = onLoadMoreData;
  }, [onLoadMoreData]);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
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
    (dataToTransform: ExtendedPerpsOHLCVData[]): CandlestickData<Time>[] => {
      const validData: CandlestickData<Time>[] = [];
      let lastTimeValue: number | null = null;

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

        // Check if data is already sorted (most common case)
        if (lastTimeValue !== null && timeValue < lastTimeValue) {
          // Data is not sorted, we'll need to sort later
          validData.push(candle);
        } else {
          // Data is sorted, add in order
          validData.push(candle);
          lastTimeValue = timeValue;
        }
      }

      // Only sort if needed (data might already be sorted)
      if (validData.length > 1) {
        const isSorted = validData.every(
          (val, idx) => idx === 0 || Number(val.time) >= Number(validData[idx - 1].time)
        );
        if (!isSorted) {
          validData.sort((a, b) => Number(a.time) - Number(b.time));
        }
      }

      return validData;
    },
    []
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
            bottom: CHART_CONFIG.PRICE_SCALE_MARGIN_BOTTOM,
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

      seriesRef.current = series;
      isInitialMountRef.current = true;
      previousDataRef.current = [];
      stopLossLineRef.current = null;
      takeProfitLineRef.current = null;
      entryPriceLineRef.current = null;
      lastLoadMoreEarliestRef.current = null;
      loadMoreInFlightRef.current = false;

      // Subscribe to visible-range changes so we can request more history
      // when the user scrolls past the currently loaded left edge.
      const timeScale = chart.timeScale();
      const handleVisibleLogicalRangeChange = (
        range: { from: number; to: number } | null
      ): void => {
        if (!range || loadMoreInFlightRef.current) return;
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

        loadMoreInFlightRef.current = true;
        Promise.resolve(cb(earliestTime)).finally(() => {
          loadMoreInFlightRef.current = false;
        });
      };
      timeScale.subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

      // Note: Data will be set in the separate data update effect
      // This separation prevents chart recreation on data changes
    } catch (error) {
      console.error('Error initializing chart:', error);
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
    if (!chartRef.current || !seriesRef.current || !data || data.length === 0) return;

    try {
      const timeScale = chartRef.current.timeScale();

      // Transform the data
      const candleData = transformData(data);

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
      if (!isInitialMount && previousData.length === validTransformedData.length) {
        const lastPrevious = previousData[previousData.length - 1];
        const lastNew = validTransformedData[validTransformedData.length - 1];

        // Quick check: if last data point hasn't changed, likely no change
        const lastUnchanged = isLineType
          ? lastPrevious?.time === lastNew?.time && lastPrevious?.value === lastNew?.value
          : lastPrevious?.time === lastNew?.time &&
            lastPrevious?.open === lastNew?.open &&
            lastPrevious?.high === lastNew?.high &&
            lastPrevious?.low === lastNew?.low &&
            lastPrevious?.close === lastNew?.close;

        if (lastPrevious && lastNew && lastUnchanged) {
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

          if (!dataChanged) {
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
          previousDataRef.current = validTransformedData;
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
          previousDataRef.current = validTransformedData;
          return;
        }
      }

      // Full data update needed
      // Production best practice: Handle initial mount to prevent auto-fit scroll left
      if (isInitialMount && validTransformedData.length > 0) {
        // On initial mount: Set data and immediately constrain visible range
        // This prevents the chart from auto-fitting to show all historical data
        seriesRef.current.setData(validTransformedData);

        // Calculate visible range BEFORE the chart auto-fits
        // Show last 100 candles (or all if less than 100) to keep latest candle visible
        const visibleCandles = Math.min(100, validTransformedData.length);
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
      }

      // Update ref
      previousDataRef.current = validTransformedData;
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [data, chartType, transformData]);

  // Update stop loss and take profit price lines
  useEffect(() => {
    if (!seriesRef.current) {
      console.log('[PerpsChart] No series available for price lines');
      return;
    }

    // Only create price lines if we have data
    if (!data || data.length === 0) {
      console.log('[PerpsChart] No data available, skipping price lines');
      return;
    }

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
        console.log('[PerpsChart] No data available in timeout, skipping price lines');
        // Remove any existing lines if data was cleared
        if (stopLossLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(stopLossLineRef.current);
            stopLossLineRef.current = null;
          } catch (error) {
            console.error('[PerpsChart] Error removing stop loss line:', error);
          }
        }
        if (takeProfitLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(takeProfitLineRef.current);
            takeProfitLineRef.current = null;
          } catch (error) {
            console.error('[PerpsChart] Error removing take profit line:', error);
          }
        }
        if (entryPriceLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(entryPriceLineRef.current);
            entryPriceLineRef.current = null;
          } catch (error) {
            console.error('[PerpsChart] Error removing entry price line:', error);
          }
        }
        return;
      }

      console.log('[PerpsChart] Updating price lines:', {
        stopLoss,
        takeProfit,
        entryPrice,
        hasData: data.length > 0,
      });

      // Remove and recreate stop loss line only if it changed
      if (shouldUpdateStopLoss) {
        if (stopLossLineRef.current) {
          try {
            seriesRef.current.removePriceLine(stopLossLineRef.current);
          } catch (error) {
            console.error('[PerpsChart] Error removing stop loss line:', error);
          }
          stopLossLineRef.current = null;
        }
      }

      // Remove and recreate take profit line only if it changed
      if (shouldUpdateTakeProfit) {
        if (takeProfitLineRef.current) {
          try {
            seriesRef.current.removePriceLine(takeProfitLineRef.current);
          } catch (error) {
            console.error('[PerpsChart] Error removing take profit line:', error);
          }
          takeProfitLineRef.current = null;
        }
      }

      // Remove and recreate entry price line only if entry price changed (not PnL)
      if (shouldUpdateEntryPrice) {
        if (entryPriceLineRef.current) {
          try {
            seriesRef.current.removePriceLine(entryPriceLineRef.current);
          } catch (error) {
            console.error('[PerpsChart] Error removing entry price line:', error);
          }
          entryPriceLineRef.current = null;
        }
      }

      // Add stop loss line if value is provided and needs update
      if (shouldUpdateStopLoss && stopLoss !== null && stopLoss !== undefined && stopLoss > 0) {
        try {
          console.log('[PerpsChart] Creating stop loss line at price:', stopLoss);
          stopLossLineRef.current = seriesRef.current.createPriceLine({
            price: stopLoss,
            color: '#ef4444', // Red color for stop loss
            lineWidth: 1,
            lineStyle: 2, // Dashed line
            axisLabelVisible: true,
            title: 'SL',
          });
          console.log('[PerpsChart] Stop loss line created:', stopLossLineRef.current);
        } catch (error) {
          console.error('[PerpsChart] Error creating stop loss line:', error);
        }
      }

      // Add take profit line if value is provided and needs update
      if (
        shouldUpdateTakeProfit &&
        takeProfit !== null &&
        takeProfit !== undefined &&
        takeProfit > 0
      ) {
        try {
          console.log('[PerpsChart] Creating take profit line at price:', takeProfit);
          takeProfitLineRef.current = seriesRef.current.createPriceLine({
            price: takeProfit,
            color: '#10b981', // Green color for take profit
            lineWidth: 1,
            lineStyle: 2, // Dashed line (consistent with SL)
            axisLabelVisible: true,
            title: 'TP',
          });
          console.log('[PerpsChart] Take profit line created:', takeProfitLineRef.current);
        } catch (error) {
          console.error('[PerpsChart] Error creating take profit line:', error);
        }
      }

      // Add entry price line if value is provided and needs update
      if (
        shouldUpdateEntryPrice &&
        entryPrice !== null &&
        entryPrice !== undefined &&
        entryPrice > 0
      ) {
        try {
          // Calculate PnL display with +/- prefix
          const pnlValue = unrealizedPnl ?? 0;
          const isProfit = pnlValue >= 0;
          const pnlPrefix = isProfit ? '+' : '';
          const pnlFormatted = `${pnlPrefix}${pnlValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;

          // Dynamic color based on PnL (green for profit, red for loss)
          const entryColor = isProfit ? '#10b981' : '#ef4444';

          console.log(
            '[PerpsChart] Creating entry price line at price:',
            entryPrice,
            'PnL:',
            pnlValue
          );
          entryPriceLineRef.current = seriesRef.current.createPriceLine({
            price: entryPrice,
            color: entryColor,
            lineWidth: 1,
            lineStyle: 0, // Solid line (distinguishes from TP/SL)
            axisLabelVisible: true,
            title: pnlFormatted,
          });
          console.log('[PerpsChart] Entry price line created:', entryPriceLineRef.current);
        } catch (error) {
          console.error('[PerpsChart] Error creating entry price line:', error);
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [stopLoss, takeProfit, entryPrice, unrealizedPnl, data]);

  const hasNoData = !data || data.length === 0;
  const showLoading = isLoading && hasNoData;

  const ariaLabel = selectedMarketName ? `Price chart for ${selectedMarketName}` : 'Price chart';

  return (
    <div
      ref={chartContainerRef}
      className={`w-full h-full relative ${className}`}
      style={{ minHeight: `${CHART_CONFIG.MIN_CHART_HEIGHT}px` }}
      role="img"
      aria-label={ariaLabel}
      aria-live="polite"
      tabIndex={0}
    >
      {isRefreshing && (
        <div className="absolute top-2 right-2 z-20">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="size-6 text-destructive" />
            <span className="text-sm text-muted-foreground">
              {error.message || 'Failed to load chart'}
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
      {!isLoading && !error && hasNoData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm text-muted-foreground">No data available</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export const PerpsChart = memo(PerpsChartComponent);
