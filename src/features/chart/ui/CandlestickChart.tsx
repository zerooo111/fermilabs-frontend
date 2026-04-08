/**
 * Candlestick chart component
 * Optimized with memoization for better performance
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
  HistogramData,
  HistogramSeries,
  DeepPartial,
  ChartOptions,
} from 'lightweight-charts';
import { useEffect, useRef, memo, useMemo } from 'react';
import { ExtendedOHLCVData, TimeInterval } from '@/features/chart/lib/chart';

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

interface ChartComponentProps {
  data: ExtendedOHLCVData[];
  interval: TimeInterval;
  onLoadMoreData?: (startTime: number, endTime: number) => Promise<void>;
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

const getTimeScaleOptions = (interval: TimeInterval): Partial<TimeScaleOptions> => {
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

function CandlestickChartComponent({ data, interval, colors, className }: ChartComponentProps) {
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
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Memoize the resize handler for better performance
  const handleResize = useMemo(
    () => () => {
      if (chartContainerRef.current && chartRef.current) {
        const { clientWidth, clientHeight } = chartContainerRef.current;
        chartRef.current.applyOptions({
          width: clientWidth,
          height: clientHeight,
        });
      }
    },
    []
  );

  // Handle resize
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Create and update chart
  useEffect(() => {
    try {
      if (!chartContainerRef.current) return;

      const { clientWidth, clientHeight } = chartContainerRef.current;

      // Chart options with volume panel
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
          ...getTimeScaleOptions(interval),
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: {
            top: 0.1,
            bottom: 0.3, // Leave space for volume chart at bottom
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

      // Create candlestick series
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        borderVisible: false,
        wickUpColor,
        wickDownColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
      }) as ISeriesApi<'Candlestick'>;

      seriesRef.current = candlestickSeries;

      // Create volume histogram series with separate scale
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(148, 163, 184, 0.5)',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume', // Separate scale for volume
      }) as ISeriesApi<'Histogram'>;

      // Configure volume price scale
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8, // Position volume at the bottom 20% of the chart
          bottom: 0,
        },
        borderVisible: false,
      });

      volumeSeriesRef.current = volumeSeries;

      // Transform data to match candlestick format
      const transformedData: CandlestickData<Time>[] = [];
      const volumeData: HistogramData<Time>[] = [];

      data.forEach(item => {
        // Skip items without complete data
        if (
          item.open === undefined ||
          item.high === undefined ||
          item.low === undefined ||
          item.close === undefined
        ) {
          return;
        }

        const rawTime = typeof item.time === 'number' ? item.time : Number(item.time);

        if (isNaN(rawTime)) {
          return;
        }

        const time = toLocalTimestamp(rawTime) as Time;

        // Handle gap-filled candles differently
        if (item.isGapFilled) {
          // For gap-filled candles, we'll use a special appearance
          // We'll make them more transparent and use a neutral color
          transformedData.push({
            time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          });

          // Skip adding volume for gap-filled candles
          return;
        }

        // Add regular candlestick data
        transformedData.push({
          time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        });

        // Add volume data with color based on price movement
        if (item.volume !== undefined) {
          const isUp = (item.close || 0) >= (item.open || 0);
          volumeData.push({
            time,
            value: item.volume,
            color: isUp ? upColor + '80' : downColor + '80', // Add transparency
          });
        }
      });

      // Filter out any invalid data points (NaN, undefined, etc.)
      const validTransformedData = transformedData.filter(item => {
        // Check if all required properties are valid numbers
        return (
          item.time !== undefined &&
          !isNaN(Number(item.time)) &&
          item.open !== undefined &&
          !isNaN(item.open) &&
          item.high !== undefined &&
          !isNaN(item.high) &&
          item.low !== undefined &&
          !isNaN(item.low) &&
          item.close !== undefined &&
          !isNaN(item.close) &&
          // Ensure high is the highest value
          item.high >= Math.max(item.open, item.close, item.low) &&
          // Ensure low is the lowest value
          item.low <= Math.min(item.open, item.close, item.high)
        );
      });

      const validVolumeData = volumeData.filter(item => {
        return (
          item.time !== undefined &&
          !isNaN(Number(item.time)) &&
          item.value !== undefined &&
          !isNaN(item.value)
        );
      });

      // Sort data by time to ensure it's in chronological order
      validTransformedData.sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : Number(a.time);
        const timeB = typeof b.time === 'number' ? b.time : Number(b.time);
        return timeA - timeB;
      });

      validVolumeData.sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : Number(a.time);
        const timeB = typeof b.time === 'number' ? b.time : Number(b.time);
        return timeA - timeB;
      });

      // Silent handling of filtered out data points
      if (transformedData.length !== validTransformedData.length) {
        // Silent error handling
      }

      if (volumeData.length !== validVolumeData.length) {
        // Silent error handling
      }

      try {
        // Set the data with error handling
        candlestickSeries.setData(validTransformedData);
        volumeSeries.setData(validVolumeData);
      } catch {
        // Silent error handling
      }

      return () => {
        try {
          if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
            volumeSeriesRef.current = null;
          }
        } catch {
          // Silent error handling
        }
      };
    } catch {
      // Silent error handling
    }
  }, [
    data,
    interval,
    backgroundColor,
    upColor,
    downColor,
    textColor,
    wickUpColor,
    wickDownColor,
    gridColor,
  ]);

  return <div ref={chartContainerRef} className={`w-full h-full min-h-[400px] ${className}`} />;
}

// Export a memoized version of the component to prevent unnecessary re-renders
export const CandlestickChart = memo(CandlestickChartComponent);
