/**
 * Chart container component
 * Optimized with memoization for better performance
 * Updated to use the Graph API according to documentation
 */
import { useState, useCallback, memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CandlestickChart } from '@/features/chart/ui/CandlestickChart';
import {
  fetchCandles,
  getTimeRangeForInterval,
  TimeInterval,
  intervalToApiFormat,
  ExtendedOHLCVData,
} from '@/features/chart/lib/chart';
import { BN } from '@coral-xyz/anchor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useAtomValue } from 'jotai';
import { selectedMarketAtom } from '@/entities/market';
import { AlertCircle } from 'lucide-react';

const INTERVALS: { label: string; value: TimeInterval }[] = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
];

function ChartContainerComponent() {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('1d');

  // Memoize the interval change handler
  const handleIntervalChange = useCallback((value: string) => {
    setTimeInterval(value as TimeInterval);
  }, []);

  // Memoize market name parts for display
  const marketDisplay = useMemo(() => {
    if (!selectedMarket) return { baseToken: 'BASE', quoteToken: 'QUOTE' };
    return {
      baseToken: selectedMarket.baseTokenName || 'BASE',
      quoteToken: selectedMarket.quoteTokenName || 'QUOTE',
    };
  }, [selectedMarket]);

  const { data, isLoading, error } = useQuery<ExtendedOHLCVData[]>({
    queryKey: ['candlesticks', timeInterval, selectedMarket?.uuid],
    queryFn: async () => {
      if (!selectedMarket?.uuid) {
        throw new Error('No market selected');
      }

      const { startTime, endTime } = getTimeRangeForInterval(timeInterval);

      // Use the API format for interval as per documentation
      const candleData = await fetchCandles({
        interval: intervalToApiFormat[timeInterval], // Convert to API format (e.g., '1 hour')
        startTime,
        endTime,
        marketId: selectedMarket.uuid,
      });

      // Process the data
      return candleData.map(item => {
        const time = item.time;

        // Skip empty candles
        if (
          item.high === 0 &&
          item.low === 0 &&
          item.close === 0 &&
          item.volume === 0 &&
          item.open === 0
        ) {
          return { time };
        }

        // Convert values based on token decimals
        const baseDecimals = selectedMarket.base_decimals || 9;
        const divisor = new BN(10 ** baseDecimals);

        const open = new BN(item.open).div(divisor).toNumber();
        const high = new BN(item.high).div(divisor).toNumber();
        const low = new BN(item.low).div(divisor).toNumber();
        const close = new BN(item.close).div(divisor).toNumber();
        const volume = new BN(item.volume).div(divisor).toNumber();

        return {
          time,
          open,
          high,
          low,
          close,
          volume,
        };
      });
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!selectedMarket?.uuid,
    retry: 2,
  });

  // Calculate latest price and price change
  const latestPrice = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Find the last valid candle with price data
    let lastValidCandle: ExtendedOHLCVData | null = null;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].close !== undefined && data[i].open !== undefined) {
        lastValidCandle = data[i];
        break;
      }
    }

    if (
      !lastValidCandle ||
      !lastValidCandle.open ||
      !lastValidCandle.close ||
      lastValidCandle.open === 0
    ) {
      return null;
    }

    const priceChange = lastValidCandle.close - lastValidCandle.open;
    const isPositive = priceChange >= 0;

    return {
      price: lastValidCandle.close.toFixed(2),
      isPositive,
      change: Math.abs(priceChange).toFixed(2),
      percentChange: ((Math.abs(priceChange) / lastValidCandle.open) * 100).toFixed(1),
    };
  }, [data]);

  // Handle error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <span className="text-red-500">Failed to fetch chart data</span>
        <span className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-medium text-foreground">
            {marketDisplay.baseToken} / {marketDisplay.quoteToken}
          </h2>
          {latestPrice && (
            <div className="flex items-center gap-2">
              <span className={latestPrice.isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                ${latestPrice.price}
              </span>
              <span
                className={`text-xs ${latestPrice.isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
              >
                {latestPrice.isPositive ? '+' : '-'}${latestPrice.change} (
                {latestPrice.percentChange}%)
              </span>
            </div>
          )}
        </div>
        <Select value={timeInterval} onValueChange={handleIntervalChange}>
          <SelectTrigger className="w-[80px] h-7">
            <SelectValue placeholder="Interval" />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map(({ label, value }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <span className="text-muted-foreground">Loading chart data...</span>
          </div>
        )}
        <CandlestickChart className="h-full" data={data || []} interval={timeInterval} />
      </div>
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export const ChartContainer = memo(ChartContainerComponent);
