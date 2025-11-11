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
  onLoadMoreData?: (startTime: number, endTime: number) => Promise<void>;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error | null;
  selectedMarketName?: string;
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
  const formatTime: TickMarkFormatter = (time: Time) => {
    let timestamp: number;
    if (typeof time === 'number') {
      timestamp = time;
    } else if (typeof time === 'string') {
      timestamp = Math.floor(new Date(time).getTime() / 1000);
    } else {
      // Handle BusinessDay format
      const { year, month, day } = time as BusinessDay;
      timestamp = Math.floor(new Date(year, month - 1, day).getTime() / 1000);
    }

    const date = new Date(timestamp * 1000);

    switch (interval) {
      case '1m':
      case '5m':
      case '15m':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '1h':
      case '4h':
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
      case '1d':
        return `${date.getMonth() + 1}/${date.getDate()}`;
      default:
        return date.toLocaleDateString();
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
  colors,
  className,
  isLoading,
  isRefreshing,
  error,
  selectedMarketName,
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
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isInitialMountRef = useRef(true);
  const previousDataRef = useRef<CandlestickData<Time>[]>([]);
  const isMountedRef = useRef(true);

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

        const timeValue = typeof item.time === 'number' ? item.time : Number(item.time);
        if (isNaN(timeValue)) {
          continue;
        }

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

      // Create candlestick series for perps with type safety
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        borderVisible: false,
        wickUpColor,
        wickDownColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
      });

      if (!candlestickSeries) {
        throw new Error('Failed to create candlestick series');
      }

      seriesRef.current = candlestickSeries as ISeriesApi<'Candlestick'>;
      isInitialMountRef.current = true;
      previousDataRef.current = [];

      // Note: Data will be set in the separate data update effect
      // This separation prevents chart recreation on data changes
    } catch (error) {
      console.error('Error initializing chart:', error);
    }

    return () => {
      isMountedRef.current = false;
      try {
        if (chartRef.current) {
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
      const validTransformedData = transformData(data);

      // Only update if we have valid data
      if (validTransformedData.length === 0) return;

      // Check if this is initial mount
      const isInitialMount = isInitialMountRef.current;
      const previousData = previousDataRef.current;

      // Check if data actually changed (skip update if identical)
      // Optimized: Compare length and last candle only for better performance
      if (!isInitialMount && previousData.length === validTransformedData.length) {
        const lastPrevious = previousData[previousData.length - 1];
        const lastNew = validTransformedData[validTransformedData.length - 1];

        // Quick check: if last candle hasn't changed, likely no change
        if (
          lastPrevious &&
          lastNew &&
          lastPrevious.time === lastNew.time &&
          lastPrevious.open === lastNew.open &&
          lastPrevious.high === lastNew.high &&
          lastPrevious.low === lastNew.low &&
          lastPrevious.close === lastNew.close
        ) {
          // Last candle unchanged, check if any other candle changed
          const dataChanged = previousData.some((prev, idx) => {
            const curr = validTransformedData[idx];
            return (
              !curr ||
              prev.time !== curr.time ||
              prev.open !== curr.open ||
              prev.high !== curr.high ||
              prev.low !== curr.low ||
              prev.close !== curr.close
            );
          });

          if (!dataChanged) {
            // Data hasn't changed, skip update
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
  }, [data, transformData]);

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
