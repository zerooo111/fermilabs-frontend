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
import { useEffect, useRef, memo, useMemo } from 'react';
import { ExtendedPerpsOHLCVData, PerpsTimeframe } from '@/features/chart/lib/perps-chart';

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

function PerpsChartComponent({ data, interval, colors, className }: PerpsChartComponentProps) {
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
          ...getPerpsTimeScaleOptions(interval),
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
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

      // Create candlestick series for perps
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

      // Transform data to match candlestick format
      const transformedData: CandlestickData<Time>[] = [];

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

        // Ensure time is properly formatted for lightweight-charts
        const timeValue = typeof item.time === 'number' ? item.time : Number(item.time);

        // Validate that time is a valid number
        if (isNaN(timeValue)) {
          return; // Skip this item
        }

        // Cast to Time type as required by lightweight-charts
        const time = timeValue as Time;

        // Add candlestick data
        transformedData.push({
          time,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        });
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

      // Sort data by time to ensure it's in chronological order
      validTransformedData.sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : Number(a.time);
        const timeB = typeof b.time === 'number' ? b.time : Number(b.time);
        return timeA - timeB;
      });

      try {
        // Set the data with error handling
        candlestickSeries.setData(validTransformedData);
      } catch {
        // Silent error handling
      }

      return () => {
        try {
          if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
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
export const PerpsChart = memo(PerpsChartComponent);
