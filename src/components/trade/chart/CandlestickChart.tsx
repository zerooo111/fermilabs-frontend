import {
  createChart,
  ColorType,
  ISeriesApi,
  IChartApi,
  Time,
  CandlestickData,
  CandlestickSeries,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { OHLCVData } from '@/lib/chart';

interface ChartComponentProps {
  data: OHLCVData[];
  colors?: {
    backgroundColor?: string;
    upColor?: string;
    downColor?: string;
    textColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
  };
  className?: string;
}

export default function CandlestickChart({
  data,
  colors: {
    backgroundColor = 'transparent',
    upColor = '#26a69a',
    downColor = '#ef5350',
    textColor = '#d1d5db',
    wickUpColor = '#26a69a',
    wickDownColor = '#ef5350',
  } = {},
  className,
}: ChartComponentProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });
    chartRef.current = chart;

    // Create candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor,
      wickDownColor,
    }) as ISeriesApi<'Candlestick'>;

    seriesRef.current = candlestickSeries;

    // Transform data to match candlestick format
    const transformedData: CandlestickData<Time>[] = data.map(item => ({
      time: item.time as Time,
      open: parseFloat(item.open),
      high: item.high,
      low: item.low,
      close: item.close,
    }));

    candlestickSeries.setData(transformedData);
    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data, backgroundColor, upColor, downColor, textColor, wickUpColor, wickDownColor]);

  return <div ref={chartContainerRef} className={className} />;
}
