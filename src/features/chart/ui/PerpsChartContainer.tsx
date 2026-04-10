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
  getPerpsLoadMoreWindowSeconds,
  processPerpsCandleData,
  calculatePerpsPriceChange,
  updateCandlesWithMarkPrice,
  PerpsTimeframe,
  ExtendedPerpsOHLCVData,
} from '@/features/chart/lib/perps-chart';
import { useSelectedMarket } from '@/entities/market';
import { usePositions } from '@/shared/hooks/usePositions';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMarketStats } from '@/shared/hooks/useMarketStats';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const TIMEFRAME_STORAGE_KEY = 'perps-chart:timeframe';
const CHART_TYPE_STORAGE_KEY = 'perps-chart:chartType';
const VALID_TIMEFRAMES: PerpsTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
const VALID_CHART_TYPES: PerpsChartType[] = ['candlestick', 'line', 'area', 'bar'];
// Keyboard shortcuts 1..6 → timeframe
const TIMEFRAME_SHORTCUTS: Record<string, PerpsTimeframe> = {
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1h',
  '5': '4h',
  '6': '1d',
};

function loadStoredTimeframe(): PerpsTimeframe {
  if (typeof window === 'undefined') return '1h';
  try {
    const stored = window.localStorage.getItem(TIMEFRAME_STORAGE_KEY);
    if (stored && (VALID_TIMEFRAMES as string[]).includes(stored)) {
      return stored as PerpsTimeframe;
    }
  } catch {
    // ignore storage access errors (private mode, disabled, etc.)
  }
  return '1h';
}

function loadStoredChartType(): PerpsChartType {
  if (typeof window === 'undefined') return 'candlestick';
  try {
    const stored = window.localStorage.getItem(CHART_TYPE_STORAGE_KEY);
    if (stored && (VALID_CHART_TYPES as string[]).includes(stored)) {
      return stored as PerpsChartType;
    }
  } catch {
    // ignore storage access errors
  }
  return 'candlestick';
}

function PerpsChartContainerComponent() {
  const [timeInterval, setTimeInterval] = useState<PerpsTimeframe>(loadStoredTimeframe);
  const [chartType, setChartType] = useState<PerpsChartType>(loadStoredChartType);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [reachedBeginningOfHistory, setReachedBeginningOfHistory] = useState(false);
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

    return { stopLoss, takeProfit, entryPrice, unrealizedPnl };
  }, [positions, selectedMarket]);

  // State to hold candles with real-time updates
  const [candles, setCandles] = useState<ExtendedPerpsOHLCVData[]>([]);
  const candlesRef = useRef<ExtendedPerpsOHLCVData[]>([]);
  const previousMarkPriceRef = useRef<number | null>(null);
  const latestMarkPriceRef = useRef<number | null>(null);
  // Older candles fetched via scroll-back pagination, kept separate so
  // background refetches of historicalData don't discard them.
  const olderCandlesRef = useRef<ExtendedPerpsOHLCVData[]>([]);
  const loadMoreInFlightRef = useRef(false);
  const oldestAvailableTimeRef = useRef<number | null>(null);

  // Clear candles when market changes to prevent stale data leaking across markets
  const previousMarketRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (selectedMarket?.uuid !== previousMarketRef.current) {
      if (previousMarketRef.current !== undefined) {
        // Market changed — clear all candle state immediately
        setCandles([]);
        candlesRef.current = [];
        olderCandlesRef.current = [];
        previousMarkPriceRef.current = null;
        latestMarkPriceRef.current = null;
        oldestAvailableTimeRef.current = null;
        loadMoreInFlightRef.current = false;
        setIsLoadingOlder(false);
        setReachedBeginningOfHistory(false);
      }
      previousMarketRef.current = selectedMarket?.uuid;
    }
  }, [selectedMarket?.uuid]);

  // Memoize the interval change handler
  const handleIntervalChange = useCallback((value: PerpsTimeframe) => {
    // Clear candles immediately to avoid flashing old timeframe data
    setCandles([]);
    candlesRef.current = [];
    olderCandlesRef.current = [];
    previousMarkPriceRef.current = null;
    latestMarkPriceRef.current = null;
    oldestAvailableTimeRef.current = null;
    loadMoreInFlightRef.current = false;
    setIsLoadingOlder(false);
    setReachedBeginningOfHistory(false);
    setTimeInterval(value);
    try {
      window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, value);
    } catch {
      // ignore storage write errors
    }
  }, []);

  const handleChartTypeChange = useCallback((next: PerpsChartType) => {
    setChartType(next);
    try {
      window.localStorage.setItem(CHART_TYPE_STORAGE_KEY, next);
    } catch {
      // ignore storage write errors
    }
  }, []);

  // Keyboard shortcuts: 1..6 switch timeframe. Ignore when user is typing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      const next = TIMEFRAME_SHORTCUTS[e.key];
      if (next) {
        e.preventDefault();
        handleIntervalChange(next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleIntervalChange]);

  // Fetch historical candle data (only when market/interval changes, no polling)
  const {
    data: historicalData,
    refetch,
    isLoading,
    isFetching,
    isSuccess,
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
    staleTime: 30_000, // Refetch if data is older than 30s (e.g. switching back to a timeframe)
    placeholderData: undefined, // Don't show stale data from a different queryKey
  });

  // Read market stats (mark price, funding, open interest). useMarketStats
  // is backed by the SSE-populated markets atom — no HTTP polling happens
  // here despite the legacy options shape.
  const { data: marketsData } = useMarketStats({
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

  // Keep the latest mark price accessible without re-triggering the
  // historicalData effect below.
  useEffect(() => {
    latestMarkPriceRef.current = markPrice;
  }, [markPrice]);

  // Update candles when historical data is fetched.
  // Merge the current mark price synchronously so a background refetch
  // doesn't briefly show an un-merged last candle on screen, and keep any
  // older candles fetched via scroll-back pagination. Empty historical
  // responses are still processed — they represent brand new markets, and
  // the first mark-price tick will seed candle 0.
  useEffect(() => {
    if (historicalData === undefined) return;
    const livePrice = latestMarkPriceRef.current;

    if (historicalData.length === 0) {
      // No server history. Start from an empty base and let the mark-price
      // effect create the first candle.
      olderCandlesRef.current = [];
      const seeded =
        livePrice !== null && livePrice > 0
          ? updateCandlesWithMarkPrice([], livePrice, timeInterval)
          : [];
      setCandles(seeded);
      candlesRef.current = seeded;
      previousMarkPriceRef.current = livePrice ?? null;
      return;
    }

    const histMinTime = historicalData[0].time;
    const preservedOlder = olderCandlesRef.current.filter(c => c.time < histMinTime);
    olderCandlesRef.current = preservedOlder;
    const combined = [...preservedOlder, ...historicalData];
    const merged =
      livePrice !== null && livePrice > 0
        ? updateCandlesWithMarkPrice(combined, livePrice, timeInterval)
        : combined;
    setCandles(merged);
    candlesRef.current = merged;
    previousMarkPriceRef.current = livePrice ?? null;
  }, [historicalData, timeInterval]);

  // Update candles in real-time with mark_price.
  // Uses candlesRef to avoid circular dependency (effect sets candles,
  // depends on candles). We intentionally allow this to run when the list
  // is empty — for markets with no historical candles, the first tick
  // seeds candle 0. We still wait for the initial fetch to resolve so a
  // tick doesn't beat the historical payload to the screen.
  useEffect(() => {
    if (markPrice === null || markPrice <= 0) return;
    if (!isSuccess) return;

    // Skip if mark_price hasn't changed (avoid unnecessary updates)
    if (previousMarkPriceRef.current === markPrice) return;

    const updatedCandles = updateCandlesWithMarkPrice(candlesRef.current, markPrice, timeInterval);
    candlesRef.current = updatedCandles;
    setCandles(updatedCandles);
    previousMarkPriceRef.current = markPrice;
  }, [markPrice, timeInterval, isSuccess]);

  // Calculate latest price and price change from updated candles
  const latestPrice = useMemo(() => {
    return calculatePerpsPriceChange(candles);
  }, [candles]);

  // Handle loading more historical data (scroll-back pagination).
  // Fetches candles older than the current earliest and prepends them.
  const handleLoadMoreData = useCallback(
    async (earliestLoadedTime: number) => {
      if (!selectedMarket?.uuid) return;
      if (loadMoreInFlightRef.current) return;
      // If we've already hit the beginning of available history, stop.
      if (
        oldestAvailableTimeRef.current !== null &&
        oldestAvailableTimeRef.current >= earliestLoadedTime
      ) {
        return;
      }

      loadMoreInFlightRef.current = true;
      setIsLoadingOlder(true);
      try {
        const windowSeconds = getPerpsLoadMoreWindowSeconds(timeInterval);
        const toSec = earliestLoadedTime - 1;
        const fromSec = toSec - windowSeconds;

        const rawCandles = await fetchPerpsCandles({
          marketId: selectedMarket.uuid,
          tf: timeInterval,
          from: new Date(fromSec * 1000).toISOString(),
          to: new Date(toSec * 1000).toISOString(),
        });

        const processed = processPerpsCandleData(rawCandles, {
          base_mint: selectedMarket.base_mint,
          quote_mint: selectedMarket.quote_mint,
          base_decimals: selectedMarket.base_decimals,
          quote_decimals: selectedMarket.quote_decimals,
          base_lot_size: selectedMarket.base_lot_size,
          quote_lot_size: selectedMarket.quote_lot_size,
        });

        const newOlder = processed
          .filter(c => c.time < earliestLoadedTime)
          .sort((a, b) => a.time - b.time);

        if (newOlder.length === 0) {
          // Server returned nothing older — mark this as the floor so we
          // don't keep asking.
          oldestAvailableTimeRef.current = earliestLoadedTime;
          setReachedBeginningOfHistory(true);
          return;
        }

        olderCandlesRef.current = [...newOlder, ...olderCandlesRef.current];
        const combined = [...newOlder, ...candlesRef.current];
        const livePrice = latestMarkPriceRef.current;
        const merged =
          livePrice !== null && livePrice > 0
            ? updateCandlesWithMarkPrice(combined, livePrice, timeInterval)
            : combined;
        candlesRef.current = merged;
        setCandles(merged);
      } catch {
        toast.error('Failed to load historical data. Please try again.');
      } finally {
        loadMoreInFlightRef.current = false;
        setIsLoadingOlder(false);
      }
    },
    [selectedMarket, timeInterval]
  );

  // Refetch errors that happen while we already have data should be
  // non-blocking: toast once per error instead of covering the chart.
  const lastToastedErrorRef = useRef<Error | null>(null);
  useEffect(() => {
    if (!error) {
      lastToastedErrorRef.current = null;
      return;
    }
    if (candlesRef.current.length > 0 && lastToastedErrorRef.current !== error) {
      lastToastedErrorRef.current = error as Error;
      toast.error(
        error instanceof Error ? error.message : 'Chart refresh failed. Showing cached data.'
      );
    }
  }, [error]);

  // First-load failure (no data + error) shows the full error screen.
  // Transient refetch errors after we have data are surfaced via toast and
  // the chart keeps showing cached data.
  const hasNoCandles = candles.length === 0;
  if (error && hasNoCandles) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <ChartHeader
          selectedMarketId={selectedMarket?.uuid}
          onMarketSelect={selectMarket}
          latestPrice={latestPrice}
        />
        <ChartToolbar
          timeInterval={timeInterval}
          onIntervalChange={handleIntervalChange}
          chartType={chartType}
          onChartTypeChange={handleChartTypeChange}
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

  // Show the spinner only while we're still waiting on the initial fetch
  // (query not yet resolved for the current market). Once the server has
  // responded — even with an empty array — we either have candles or we
  // wait for the first mark-price tick to seed candle 0.
  const showChartLoading = hasNoCandles && !error && !isSuccess;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ChartHeader
        selectedMarketId={selectedMarket?.uuid}
        onMarketSelect={selectMarket}
        latestPrice={latestPrice}
      />
      <ChartToolbar
        timeInterval={timeInterval}
        onIntervalChange={handleIntervalChange}
        chartType={chartType}
        onChartTypeChange={handleChartTypeChange}
        isRefreshing={isFetching && !isLoading}
      />

      <div className="flex-1 relative min-h-[250px] md:min-h-[350px] lg:min-h-[400px] overflow-hidden">
        <ErrorBoundary>
          <PerpsChart
            key={selectedMarket?.uuid}
            className="h-full"
            data={candles}
            interval={timeInterval}
            chartType={chartType}
            onLoadMoreData={handleLoadMoreData}
            isLoading={showChartLoading}
            isRefreshing={isFetching && !isLoading && !hasNoCandles}
            isLoadingOlder={isLoadingOlder}
            reachedBeginningOfHistory={reachedBeginningOfHistory}
            error={hasNoCandles ? (error as Error | null) : null}
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
