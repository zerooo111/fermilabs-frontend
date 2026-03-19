/**
 * Perps chart container component
 * Handles data fetching and state management for perps charts
 * Optimized to fetch historical data once and update in real-time with mark_price
 */
import { useState, useCallback, memo, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PerpsChart, PerpsChartType } from '@/features/chart/ui/PerpsChart';
import { ChartHeader } from '@/features/chart/ui/ChartHeader';
import { ChartToolbar } from '@/features/chart/ui/ChartToolbar';
import {
  fetchPerpsCandles,
  getPerpsTimeRangeForInterval,
  processPerpsCandleData,
  calculatePerpsPriceChange,
  updateCandlesWithMarkPrice,
  PerpsTimeframe,
  ExtendedPerpsOHLCVData,
} from '@/features/chart/lib/perps-chart';
import { useSelectedMarket, MarketKind } from '@/entities/market';
import { usePositions } from '@/shared/hooks/usePositions';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMarketStats } from '@/shared/hooks/useMarketStats';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

function PerpsChartContainerComponent() {
  const [timeInterval, setTimeInterval] = useState<PerpsTimeframe>('1h');
  const [chartType, setChartType] = useState<PerpsChartType>('candlestick');
  const { selectedMarket, selectMarket } = useSelectedMarket();
  const { publicKey } = useWallet();

  // Fetch user positions to get SL/TP values (only if user is logged in)
  const { data: positions } = usePositions({
    owner: publicKey?.toBase58(),
    marketId: selectedMarket?.uuid,
    enabled: !!publicKey, // Only fetch if user is logged in
  });

  // Extract SL/TP and entry price values from positions for the selected market
  const positionData = useMemo(() => {
    if (!positions || !selectedMarket || positions.length === 0) {
      return { stopLoss: null, takeProfit: null, entryPrice: null, unrealizedPnl: null };
    }

    // Find position for the selected market
    const position = positions.find(p => p.market_id === selectedMarket.uuid);
    if (!position) {
      return { stopLoss: null, takeProfit: null, entryPrice: null, unrealizedPnl: null };
    }

    // Normalize all values by dividing by 10^quoteDecimals
    const quoteDecimals = selectedMarket.quote_decimals ?? 6;
    const divisor = Math.pow(10, quoteDecimals);

    const stopLoss = position.stop_loss_price
      ? parseFloat(position.stop_loss_price) / divisor
      : null;
    const takeProfit = position.take_profit_price
      ? parseFloat(position.take_profit_price) / divisor
      : null;
    const entryPrice = position.average_entry_price
      ? parseFloat(position.average_entry_price) / divisor
      : null;
    const unrealizedPnl = position.unrealized_pnl
      ? parseFloat(position.unrealized_pnl) / divisor
      : null;

    console.log('[PerpsChartContainer] Position data:', {
      stopLoss,
      takeProfit,
      entryPrice,
      unrealizedPnl,
      raw: {
        stop_loss_price: position.stop_loss_price,
        take_profit_price: position.take_profit_price,
        average_entry_price: position.average_entry_price,
        unrealized_pnl: position.unrealized_pnl,
      },
    });

    return { stopLoss, takeProfit, entryPrice, unrealizedPnl };
  }, [positions, selectedMarket]);

  // State to hold candles with real-time updates
  const [candles, setCandles] = useState<ExtendedPerpsOHLCVData[]>([]);
  const previousMarkPriceRef = useRef<number | null>(null);

  // Memoize the interval change handler
  const handleIntervalChange = useCallback((value: string) => {
    setTimeInterval(value as PerpsTimeframe);
  }, []);

  // Fetch historical candle data (only when market/interval changes, no polling)
  const {
    data: historicalData,
    refetch,
    isLoading,
    isFetching,
    error,
  } = useQuery<ExtendedPerpsOHLCVData[]>({
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
      return processPerpsCandleData(candleData, {
        base_mint: selectedMarket.base_mint,
        quote_mint: selectedMarket.quote_mint,
        base_decimals: selectedMarket.base_decimals,
        quote_decimals: selectedMarket.quote_decimals,
        base_lot_size: selectedMarket.base_lot_size,
        quote_lot_size: selectedMarket.quote_lot_size,
      });
    },
    // Remove refetchInterval - only fetch when market/interval changes
    enabled: !!selectedMarket?.uuid,
    retry: 2,
    staleTime: Infinity, // Historical data doesn't become stale
  });

  // Fetch market stats for real-time mark_price updates
  const { data: marketsData } = useMarketStats({
    refetchInterval: 1000, // Poll mark_price every 5 seconds
    enabled: !!selectedMarket?.uuid,
  });

  // Extract mark_price for the selected market and normalize it
  const markPrice = useMemo(() => {
    if (!selectedMarket?.uuid || !marketsData) return null;

    const currentMarketData = marketsData.find(m => m.uuid === selectedMarket.uuid);
    if (!currentMarketData || currentMarketData.kind !== 'perp' || !currentMarketData.perp_state) {
      return null;
    }

    const rawMarkPrice = currentMarketData.perp_state.mark_price;
    if (rawMarkPrice === null || rawMarkPrice === undefined || rawMarkPrice <= 0) {
      return null;
    }

    // Normalize mark_price by dividing by 10^quoteDecimals
    // mark_price comes from API as raw/scaled integer, but candles are normalized
    const quoteDecimals = selectedMarket.quoteDecimals ?? 6; // Default to 6 for USDC
    return rawMarkPrice / Math.pow(10, quoteDecimals);
  }, [selectedMarket?.uuid, selectedMarket?.quoteDecimals, marketsData]);

  // Update candles when historical data is fetched
  useEffect(() => {
    if (historicalData && historicalData.length > 0) {
      setCandles(historicalData);
      previousMarkPriceRef.current = null; // Reset to allow first mark_price update
    }
  }, [historicalData]);

  // Update candles in real-time with mark_price
  useEffect(() => {
    if (markPrice === null || markPrice <= 0 || candles.length === 0) {
      return;
    }

    // Skip if mark_price hasn't changed (avoid unnecessary updates)
    if (previousMarkPriceRef.current === markPrice) {
      return;
    }

    // Update candles with the new mark_price
    const updatedCandles = updateCandlesWithMarkPrice(candles, markPrice, timeInterval);
    setCandles(updatedCandles);
    previousMarkPriceRef.current = markPrice;
  }, [markPrice, timeInterval, candles]);

  // Calculate latest price and price change from updated candles
  const latestPrice = useMemo(() => {
    return calculatePerpsPriceChange(candles);
  }, [candles]);

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
          latestPrice={latestPrice}
        />
        <ChartToolbar
          timeInterval={timeInterval}
          onIntervalChange={handleIntervalChange}
          chartType={chartType}
          onChartTypeChange={setChartType}
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
        latestPrice={latestPrice}
      />
      <ChartToolbar
        timeInterval={timeInterval}
        onIntervalChange={handleIntervalChange}
        chartType={chartType}
        onChartTypeChange={setChartType}
      />

      <div className="flex-1 relative min-h-[250px] md:min-h-[350px] lg:min-h-[400px] overflow-hidden">
        <ErrorBoundary>
          <PerpsChart
            className="h-full"
            data={candles}
            interval={timeInterval}
            chartType={chartType}
            onLoadMoreData={handleLoadMoreData}
            isLoading={isLoading}
            isRefreshing={isFetching && !isLoading}
            error={error}
            selectedMarketName={selectedMarket?.name}
            stopLoss={positionData.stopLoss}
            takeProfit={positionData.takeProfit}
            entryPrice={positionData.entryPrice}
            unrealizedPnl={positionData.unrealizedPnl}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export const PerpsChartContainer = memo(PerpsChartContainerComponent);
