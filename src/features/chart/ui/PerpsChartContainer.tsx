/**
 * Perps chart container component
 * Handles data fetching and state management for perps charts
 */
import { useState, useCallback, memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PerpsChart } from '@/features/chart/ui/PerpsChart';
import { ChartHeader } from '@/features/chart/ui/ChartHeader';
import {
  fetchPerpsCandles,
  getPerpsTimeRangeForInterval,
  processPerpsCandleData,
  calculatePerpsPriceChange,
  PerpsTimeframe,
  ExtendedPerpsOHLCVData,
} from '@/features/chart/lib/perps-chart';
import { useSelectedMarket, MarketKind } from '@/entities/market';
import { toast } from 'sonner';

function PerpsChartContainerComponent() {
  const [timeInterval, setTimeInterval] = useState<PerpsTimeframe>('1h');
  const { selectedMarket, selectMarket } = useSelectedMarket();

  // Memoize the interval change handler
  const handleIntervalChange = useCallback((value: string) => {
    setTimeInterval(value as PerpsTimeframe);
  }, []);

  const { data, refetch } = useQuery<ExtendedPerpsOHLCVData[]>({
    queryKey: ['perps-candlesticks', timeInterval, selectedMarket?.uuid],
    queryFn: async () => {
      if (!selectedMarket?.uuid) {
        throw new Error('No market selected');
      }

      const { startTime, endTime } = getPerpsTimeRangeForInterval(timeInterval);

      // Fetch perps candle data
      const candleData = await fetchPerpsCandles({
        marketId: selectedMarket.uuid,
        tf: timeInterval,
        from: startTime,
        to: endTime,
      });

      // Use quote decimals from the selected market as source of truth
      const quoteDecimals = selectedMarket.quote_decimals;

      // Process the data for TradingView charts
      return processPerpsCandleData(candleData, quoteDecimals);
    },
    refetchInterval: 5000, // Refetch every 5 seconds for perps
    enabled: !!selectedMarket?.uuid,
    retry: 2,
  });

  // Calculate latest price and price change
  const latestPrice = useMemo(() => {
    return calculatePerpsPriceChange(data || []);
  }, [data]);

  // Handle loading more historical data
  const handleLoadMoreData = useCallback(async () => {
    if (!selectedMarket?.uuid) return;

    try {
      await refetch();
    } catch {
      toast.error('Failed to load historical data. Please try again.');
    }
  }, [selectedMarket?.uuid, refetch]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ChartHeader
        selectedMarketId={selectedMarket?.uuid}
        onMarketSelect={selectMarket}
        marketKind={'perp' as MarketKind}
        timeInterval={timeInterval}
        onIntervalChange={handleIntervalChange}
        latestPrice={latestPrice}
      />

      <div className="flex-1 relative min-h-[250px] md:min-h-[350px] lg:min-h-[400px] overflow-hidden">
        <PerpsChart
          className="h-full"
          data={data || []}
          interval={timeInterval}
          onLoadMoreData={handleLoadMoreData}
        />
      </div>
    </div>
  );
}

export const PerpsChartContainer = memo(PerpsChartContainerComponent);
