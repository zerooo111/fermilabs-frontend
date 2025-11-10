/**
 * Chart container component
 * Optimized with memoization for better performance
 * Updated to use the Graph API according to documentation
 */
import { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CandlestickChart } from '@/features/chart/ui/CandlestickChart';
import { ChartHeader } from '@/features/chart/ui/ChartHeader';
import {
  fetchCandles,
  getTimeRangeForInterval,
  TimeInterval,
  intervalToApiFormat,
  ExtendedOHLCVData,
} from '@/features/chart/lib/chart';
import { BN } from '@coral-xyz/anchor';
import { Button } from '@/shared/ui/button';
import { useAtomValue } from 'jotai';
import { selectedMarketAtom, useSelectedMarket, MarketKind, marketsAtom } from '@/entities/market';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function ChartContainerComponent() {
  // Remove all this complex market selection logic
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const allMarkets = useAtomValue(marketsAtom);
  const { selectMarket, selectedMarketId } = useSelectedMarket();
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('1m');

  // ChartContainer is now only used for spot markets
  const marketKind: MarketKind = 'spot';

  // Filter markets by kind (only spot markets)
  const filteredMarkets = useMemo(() => {
    return allMarkets.filter(market => market.kind === marketKind);
  }, [allMarkets, marketKind]);

  // Auto-select first market when filtered markets change and no market is selected,
  // or when the currently selected market is not in the filtered markets
  useEffect(() => {
    if (filteredMarkets.length > 0) {
      const isCurrentMarketInFiltered = filteredMarkets.some(
        market => market.uuid === selectedMarketId
      );
      if (!selectedMarketId || !isCurrentMarketInFiltered) {
        selectMarket(filteredMarkets[0].uuid);
      }
    }
  }, [filteredMarkets, selectedMarketId, selectMarket]);

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
        } catch {
          // Silent error handling
          // Return a minimal valid item with just the time to avoid breaking the map function
          return { time: item.time };
        }
      });

      return processedData;
    },
    refetchInterval: 1000, // Refetch every 1 second
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
  const handleLoadMoreData = useCallback(async () => {
    if (!selectedMarket?.uuid) return;

    try {
      // Loading more historical data
      // Trigger refetch with the new time range
      // In a real implementation, you would pass the custom time range to the query
      // For now, we're just doing a simple refetch
      await refetch();
    } catch {
      // Silent error handling
      // Show a toast or notification to the user
      toast.error('Failed to load historical data. Please try again.');
    }
  }, [selectedMarket?.uuid, refetch]);

  // Handle error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-coll">
        <ChartHeader
          selectedMarketId={selectedMarketId}
          onMarketSelect={handleMarketSelect}
          marketKind={marketKind}
          timeInterval={timeInterval}
          onIntervalChange={handleIntervalChange}
          latestPrice={latestPrice}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-500 mb-1">Failed to fetch chart data</h3>
            <p className="text-sm text-zinc-500 max-w-md mb-4">
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
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ChartHeader
        selectedMarketId={selectedMarketId}
        onMarketSelect={handleMarketSelect}
        marketKind={marketKind}
        timeInterval={timeInterval}
        onIntervalChange={handleIntervalChange}
        latestPrice={latestPrice}
      />

      <div className="flex-1 relative min-h-[400px] overflow-hidden">
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
