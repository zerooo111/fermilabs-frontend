import {
  createChart,
  CandlestickSeries,
  UTCTimestamp,
  ChartOptions,
  DeepPartial,
  IChartApi,
  ColorType,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { useResizeObserver } from '@/hooks/useResizeObserver';

interface CandlestickData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartProps {
  data: CandlestickData[];
  colors?: {
    backgroundColor?: string;
    textColor?: string;
    upColor?: string;
    downColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
  };
}

export const CandlestickChart = ({
  data,
  colors = {
    backgroundColor: 'white',
    textColor: 'black',
    upColor: '#26a69a',
    downColor: '#ef5350',
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  },
}: ChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Use resize observer to track container size changes
  useResizeObserver(chartContainerRef, entry => {
    const { width, height } = entry.contentRect;
    setDimensions({ width, height });
  });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        textColor: colors.textColor,
        background: {
          type: ColorType.Solid,
          color: colors.backgroundColor,
        },
      },
      width: dimensions.width,
      height: dimensions.height,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    };

    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    const candlestickSeries = chartRef.current.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderVisible: false,
      wickUpColor: colors.wickUpColor,
      wickDownColor: colors.wickDownColor,
    });

    candlestickSeries.setData(data);
    chartRef.current.timeScale().fitContent();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [colors, data]);

  // Update chart dimensions when container size changes
  useEffect(() => {
    if (chartRef.current && dimensions.width > 0 && dimensions.height > 0) {
      chartRef.current.applyOptions({
        width: dimensions.width,
        height: dimensions.height,
      });
      chartRef.current.timeScale().fitContent();
    }
  }, [dimensions]);

  return <div className="w-full h-full" ref={chartContainerRef} style={{ minHeight: '300px' }} />;
};
