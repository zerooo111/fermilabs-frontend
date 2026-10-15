/**
 * Perps chart container component
 * The market header plus the CandleFrame chart. The chart fetches its own
 * history (see fermi-feed.ts); this container supplies the market, live ticks
 * and the open position with its SL/TP legs.
 */
import { useState, useCallback, memo, useMemo, useEffect } from 'react';
import type { Candle } from 'candleframe/core';
import { ChartHeader } from '@/features/chart/ui/ChartHeader';
import { CandleFrameChart, type CandleFrameMarket } from '@/features/chart/ui/CandleFrameChart';
import {
  calculatePerpsPriceChange,
  PerpsTimeframe,
  PerpsPriceSource,
} from '@/features/chart/lib/perps-chart';
import { useSelectedMarket } from '@/entities/market';
import { usePositions } from '@/shared/hooks/usePositions';
import {
  legsForPosition,
  useTriggerOrders,
  useTriggerOrdersEnabled,
} from '@/features/trigger-orders/model/useTriggerOrders';
import { legTriggerPrice } from '@/features/trigger-orders/lib/display';
import { priceLotsToUi } from '@/features/trigger-orders/lib/triggerLegs';
import { useReplaceTriggerLegs } from '@/features/order-placement/lib/useReplaceTriggerLegs';
import type { ChartPosition, TriggerKind } from '@/features/chart/ui/PositionLines';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { recentMarketTradesAtom, marketMetricsAtom } from '@/shared/api/sse-atoms';
import { nativeToUiNumber } from '@/shared/lib/harness-market';
import { QUOTE_DECIMALS } from '@/shared/config/constants';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const TIMEFRAME_STORAGE_KEY = 'perps-chart:timeframe';
const PRICE_SOURCE_STORAGE_KEY = 'perps-chart:priceSource';
const VALID_TIMEFRAMES: PerpsTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
const VALID_PRICE_SOURCES: PerpsPriceSource[] = ['ltp', 'mark'];

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

// Default to 'mark': on a thin new venue the Pyth-index chart is smoother and
// more representative than the sparse LTP chart. A user's explicit toggle is
// persisted, so anyone who picks LTP keeps it.
function loadStoredPriceSource(): PerpsPriceSource {
  if (typeof window === 'undefined') return 'mark';
  try {
    const stored = window.localStorage.getItem(PRICE_SOURCE_STORAGE_KEY);
    if (stored && (VALID_PRICE_SOURCES as string[]).includes(stored)) {
      return stored as PerpsPriceSource;
    }
  } catch {
    // ignore storage access errors
  }
  return 'mark';
}

function PerpsChartContainerComponent() {
  const [timeInterval, setTimeInterval] = useState<PerpsTimeframe>(loadStoredTimeframe);
  const [priceSource, setPriceSource] = useState<PerpsPriceSource>(loadStoredPriceSource);
  const { selectedMarket, selectMarket } = useSelectedMarket();
  const { publicKey } = useWallet();

  // Fetch user positions to get SL/TP values (only if user is logged in)
  const { data: positions } = usePositions({
    owner: publicKey?.toBase58(),
    marketId: selectedMarket?.uuid,
    enabled: !!publicKey, // Only fetch if user is logged in
  });

  // Active SL/TP legs from the trigger-orders keeper
  const { data: triggerOrders } = useTriggerOrders();
  const sltpAvailable = useTriggerOrdersEnabled();
  const replaceTriggerLegs = useReplaceTriggerLegs();

  // The open position in the selected market, with its SL/TP legs, as the
  // chart draws it (UI units).
  const chartPosition = useMemo(() => {
    if (!positions || !selectedMarket) return null;
    const position = positions.find(p => p.market_id === selectedMarket.uuid);
    if (!position) return null;
    const basePosition = parseFloat(position.base_position);
    if (!basePosition) return null;

    const quoteDecimals = selectedMarket.quote_decimals ?? QUOTE_DECIMALS;
    const baseDecimals = selectedMarket.base_decimals;
    const toUi = (native: string | null | undefined, decimals: number) =>
      native ? parseFloat(native) / 10 ** decimals : null;

    const side: 'long' | 'short' = basePosition >= 0 ? 'long' : 'short';
    const marketIndex = parseInt(position.market_id, 10);
    const legMarket = {
      baseDecimals,
      quoteDecimals,
      baseLotSize: selectedMarket.base_lot_size,
      quoteLotSize: selectedMarket.quote_lot_size,
    };
    // SL/TP are keeper-held trigger legs on the position's closing side
    const legs = legsForPosition(triggerOrders, marketIndex, side);
    const legPrice = (kind: TriggerKind) => {
      const leg = legs.find(l => l.kind === kind);
      return leg ? legTriggerPrice(leg, legMarket) : null;
    };

    const view: ChartPosition = {
      side,
      size: Math.abs(basePosition) / 10 ** baseDecimals,
      entryPrice: toUi(position.avg_entry_price, quoteDecimals) ?? 0,
      unrealizedPnl: toUi(position.unrealized_pnl, quoteDecimals),
      markPrice: toUi(position.mark_price, quoteDecimals),
      stopLoss: legPrice('stop_loss'),
      takeProfit: legPrice('take_profit'),
      tick: priceLotsToUi(1, legMarket),
      baseUnit: selectedMarket.baseTokenName,
      quoteUnit: selectedMarket.quoteTokenName || 'USDC',
    };
    return { view, marketIndex, legs };
  }, [positions, selectedMarket, triggerOrders]);

  // Dragging a line re-places the position's legs with the moved price, keeping
  // the other leg where it is (one OCO bracket, same as the TP/SL editor).
  const handleTriggerChange = useCallback(
    async (kind: TriggerKind, price: number | null) => {
      if (!chartPosition) return false;
      const { view, marketIndex, legs } = chartPosition;
      const decimals = Math.max(0, Math.ceil(-Math.log10(view.tick) - 1e-9));
      const asString = (p: number | null) => (p === null ? undefined : p.toFixed(decimals));
      return replaceTriggerLegs({
        marketIndex,
        position: view.side,
        legs,
        stopLoss: asString(kind === 'stop_loss' ? price : view.stopLoss),
        takeProfit: asString(kind === 'take_profit' ? price : view.takeProfit),
      });
    },
    [chartPosition, replaceTriggerLegs]
  );

  const handleSelectionChange = useCallback(
    (nextInterval: PerpsTimeframe, nextSource: PerpsPriceSource) => {
      setTimeInterval(nextInterval);
      setPriceSource(nextSource);
      try {
        window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, nextInterval);
        window.localStorage.setItem(PRICE_SOURCE_STORAGE_KEY, nextSource);
      } catch {
        // ignore storage write errors
      }
    },
    []
  );

  // Live ticks for the forming candle, one per price source, so each feed
  // extends its series with the matching stream and live and historical OHLC
  // stay consistent:
  //   • ltp  → last traded price from the trades stream (native → UI scale).
  //            /v2/candles?price=ltp is also trade-derived, so no snap on
  //            refresh and no oracle ghost wicks during quiet periods.
  //   • mark → mark/oracle tick from the SSE `meta` stream (already UI scale),
  //            matching the Pyth-index history from /v2/candles?price=mark.
  // Both atoms are reset/rescoped by useSSEStream on market change.
  const recentTrades = useAtomValue(recentMarketTradesAtom);
  const liveMetrics = useAtomValue(marketMetricsAtom);
  const markPrice = useMemo(() => {
    if (!selectedMarket?.uuid) return null;
    if (!liveMetrics || liveMetrics.market !== selectedMarket.uuid) return null;
    const mark = liveMetrics.mark_price_ui;
    return Number.isFinite(mark) && mark > 0 ? mark : null;
  }, [liveMetrics, selectedMarket?.uuid]);
  const lastTradePrice = useMemo(() => {
    if (!selectedMarket?.uuid) return null;
    if (!recentTrades || recentTrades.length === 0) return null;
    // recentMarketTradesAtom is sorted desc by timestamp by mergeRecentTrades.
    const latest = recentTrades[0];
    if (!latest || !Number.isFinite(latest.price) || latest.price <= 0) return null;
    const quoteDecimals = selectedMarket.quote_decimals ?? QUOTE_DECIMALS;
    return nativeToUiNumber(latest.price, quoteDecimals);
  }, [recentTrades, selectedMarket?.uuid, selectedMarket?.quote_decimals]);
  const livePrices = useMemo(
    () => ({ ltp: lastTradePrice, mark: markPrice }),
    [lastTradePrice, markPrice]
  );

  // The chart's market description; a new one remounts the chart.
  const chartMarket = useMemo<CandleFrameMarket | null>(() => {
    if (!selectedMarket?.uuid) return null;
    const conversion = {
      base_mint: selectedMarket.base_mint,
      quote_mint: selectedMarket.quote_mint,
      base_decimals: selectedMarket.base_decimals,
      quote_decimals: selectedMarket.quote_decimals,
      base_lot_size: selectedMarket.base_lot_size,
      quote_lot_size: selectedMarket.quote_lot_size,
    };
    const tickSize = priceLotsToUi(1, {
      baseDecimals: selectedMarket.base_decimals,
      quoteDecimals: selectedMarket.quote_decimals ?? QUOTE_DECIMALS,
      baseLotSize: selectedMarket.base_lot_size,
      quoteLotSize: selectedMarket.quote_lot_size,
    });
    return {
      uuid: selectedMarket.uuid,
      symbol: selectedMarket.name || selectedMarket.baseTokenName,
      base: selectedMarket.baseTokenName,
      quote: selectedMarket.quoteTokenName || 'USDC',
      tickSize: Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.01,
      conversion,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket?.uuid]);

  // Price and rolling 24h change for the header, from the chart's candles.
  // Candles update on every tick; only re-render when the readout changes.
  const [latestPrice, setLatestPrice] = useState<ReturnType<
    typeof calculatePerpsPriceChange
  > | null>(null);
  const handleCandles = useCallback((candles: readonly Candle[]) => {
    const next = calculatePerpsPriceChange(
      candles.map(c => ({ time: c.timeMs / 1000, open: c.open, close: c.close }))
    );
    setLatestPrice(prev =>
      prev?.price === next?.price && prev?.percentChange === next?.percentChange ? prev : next
    );
  }, []);
  useEffect(() => setLatestPrice(null), [selectedMarket?.uuid]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ChartHeader
        selectedMarketId={selectedMarket?.uuid}
        onMarketSelect={selectMarket}
        latestPrice={latestPrice}
      />
      <div className="flex-1 relative min-h-[200px] overflow-hidden">
        <ErrorBoundary>
          {chartMarket ? (
            <CandleFrameChart
              key={chartMarket.uuid}
              market={chartMarket}
              interval={timeInterval}
              priceSource={priceSource}
              onSelectionChange={handleSelectionChange}
              livePrices={livePrices}
              onCandles={handleCandles}
              position={chartPosition?.view ?? null}
              onTriggerChange={sltpAvailable ? handleTriggerChange : undefined}
            />
          ) : null}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export const PerpsChartContainer = memo(PerpsChartContainerComponent);
