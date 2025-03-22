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
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { OHLCVData, TimeInterval } from '@/lib/chart';

interface ChartComponentProps {
  data: OHLCVData[];
  interval: TimeInterval;
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

export default function CandlestickChart({
  data,
  interval,
  colors: {
    backgroundColor = 'transparent',
    upColor = '#22c55e', // Modern green
    downColor = '#ef4444', // Modern red
    textColor = '#94a3b8', // Subtle text color
    wickUpColor = '#22c55e',
    wickDownColor = '#ef4444',
    gridColor = 'rgba(148, 163, 184, 0.1)', // Very subtle grid
  } = {},
  className,
}: ChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const { clientWidth, clientHeight } = chartContainerRef.current;
        chartRef.current.applyOptions({
          width: clientWidth,
          height: clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create and update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const { clientWidth, clientHeight } = chartContainerRef.current;

    const chart = createChart(chartContainerRef.current, {
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
    });

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

    // Transform data to match candlestick format
    const transformedData: CandlestickData<Time>[] = data.map(item => ({
      time: item.time as Time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));

    candlestickSeries.setData(transformedData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
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
