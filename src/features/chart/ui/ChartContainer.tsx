/**
 * Chart container component
 * Optimized with memoization for better performance
 * Updated to use the Graph API according to documentation
 */
import { useState, useCallback, memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CandlestickChart } from '@/features/chart/ui/CandlestickChart';
import { MarketSelector } from '@/features/market-selector';
import {
  fetchCandles,
  getTimeRangeForInterval,
  TimeInterval,
  intervalToApiFormat,
  ExtendedOHLCVData,
} from '@/features/chart/lib/chart';
import { BN } from '@coral-xyz/anchor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Button } from '@/shared/ui/button';
import { useAtomValue } from 'jotai';
import { selectedMarketAtom, useSelectedMarket } from '@/entities/market';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
  const { selectMarket, selectedMarketId, loadMarkets } = useSelectedMarket();
  const [isLoading, setIsLoading] = useState(false);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>(INTERVALS[0].value);

  // Memoize the interval change handler
  const handleIntervalChange = useCallback((value: string) => {
    setTimeInterval(value as TimeInterval);
  }, []);

  // Memoize the market selection handler
  const handleMarketSelect = useCallback(
    (marketId: string) => {
      selectMarket(marketId);
    },
    [selectMarket]
  );

  const { data, error, refetch } = useQuery<ExtendedOHLCVData[]>({
    queryKey: ['candlesticks', timeInterval, selectedMarket?.uuid],
    queryFn: async () => {
      try {
        if (!selectedMarket?.uuid) {
          throw new Error('No market selected');
        }

        const { startTime, endTime } = getTimeRangeForInterval(timeInterval);

        // Use the API format for interval as per documentation
        const candleData = await fetchCandles(
          {
            interval: intervalToApiFormat[timeInterval], // Convert to API format (e.g., '1 hour')
            startTime,
            endTime,
            marketId: selectedMarket.uuid,
          },
          true // Enable fallback to larger timeframes if needed
        );

        // Process the data
        const processedData = candleData.map(item => {
          try {
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

            // Check for gap-filled candles (all OHLC values are the same and volume is 0)
            const isGapFilled =
              item.isGapFilled ||
              (item.open === item.high &&
                item.high === item.low &&
                item.low === item.close &&
                item.volume === 0);

            return {
              time,
              open: new BN(item.open).toNumber(),
              high: new BN(item.high).toNumber(),
              low: new BN(item.low).toNumber(),
              close: new BN(item.close).toNumber(),
              volume: new BN(item.volume).toNumber(),
              isGapFilled,
              gapFillMethod: item.gapFillMethod,
            };
          } catch (itemError) {
            console.error('Error processing candle item:', itemError, item);
            // Return a minimal valid item with just the time to avoid breaking the map function
            return { time: item.time };
          }
        });

        return processedData;
      } catch (error) {
        console.error('Error in chart data query function:', error);
        throw error; // Re-throw to let React Query handle the error state
      }
    },
    refetchInterval: 500, // Refetch every 30 seconds
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
      price: lastValidCandle.close,
      isPositive,
      change: Math.abs(priceChange),
      percentChange: ((Math.abs(priceChange) / lastValidCandle.open) * 100).toFixed(1),
    };
  }, [data]);

  // Handle loading more historical data
  const handleLoadMoreData = useCallback(
    async (startTime: number, endTime: number) => {
      if (!selectedMarket?.uuid) return;

      try {
        console.log('Loading more historical data:', { startTime, endTime });
        // Trigger refetch with the new time range
        // In a real implementation, you would pass the custom time range to the query
        // For now, we're just logging the parameters and doing a simple refetch
        await refetch();
      } catch (err) {
        console.error('Failed to load historical data:', err);
        // Show a toast or notification to the user
        toast.error('Failed to load historical data. Please try again.');
      }
    },
    [selectedMarket?.uuid, refetch]
  );

  // Function to render the chart header with interval selector
  const renderChartHeader = () => (
    <div className="flex items-center justify-between p-3 ">
      <div className="flex items-center gap-4">
        <MarketSelector
          isLoading={isLoading}
          selectedMarketId={selectedMarketId}
          onMarketSelect={handleMarketSelect}
        />
        {latestPrice && (
          <div className="flex items-center font-semibold text-xl gap-2">
            <span className={latestPrice.isPositive ? 'text-emerald-500' : 'text-red-600'}>
              ${latestPrice.price}
            </span>
            <span
              className={`text-sm font-normal ${latestPrice.isPositive ? 'text-emerald-500' : 'text-red-600'}`}
            >
              {latestPrice.isPositive ? '+' : '-'}${latestPrice.change} ({latestPrice.percentChange}
              %)
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
  );

  // Handle error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col glass-panel">
        {renderChartHeader()}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-500 mb-1">Failed to fetch chart data</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
          <Button onClick={() => refetch()} className="flex items-center gap-2" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col glass-panel rounded-lg overflow-hidden">
      {renderChartHeader()}

      <div className="flex-1 relative min-h-[400px] overflow-hidden glass-panel border-none bg-white/50">
        <CandlestickChart
          className="h-full"
          data={data || []}
          interval={timeInterval}
          onLoadMoreData={handleLoadMoreData}
        />
      </div>
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export const ChartContainer = memo(ChartContainerComponent);
