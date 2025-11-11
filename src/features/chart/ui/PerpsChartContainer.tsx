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
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { CHART_CONFIG } from '@/features/chart/lib/chart-constants';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

function PerpsChartContainerComponent() {
  const [timeInterval, setTimeInterval] = useState<PerpsTimeframe>('1h');
  const { selectedMarket, selectMarket } = useSelectedMarket();

  // Memoize the interval change handler
  const handleIntervalChange = useCallback((value: string) => {
    setTimeInterval(value as PerpsTimeframe);
  }, []);

  const { data, refetch, isLoading, isFetching, error } = useQuery<ExtendedPerpsOHLCVData[]>({
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

      // Process the data for TradingView charts
      return processPerpsCandleData(candleData);
    },
    refetchInterval: CHART_CONFIG.REFETCH_INTERVAL_MS,
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

  // Handle error state
  if (error) {
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
        <ErrorBoundary>
          <PerpsChart
            className="h-full"
            data={data || []}
            interval={timeInterval}
            onLoadMoreData={handleLoadMoreData}
            isLoading={isLoading}
            isRefreshing={isFetching && !isLoading}
            error={error}
            selectedMarketName={selectedMarket?.name}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export const PerpsChartContainer = memo(PerpsChartContainerComponent);
