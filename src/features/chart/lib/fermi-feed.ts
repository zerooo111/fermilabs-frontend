/**
 * CandleFrame feed for a Fermi perps market.
 *
 * Fetches history from /v2/candles (same as the old lightweight-charts
 * container), pages older bars when the user pans back, and builds the
 * forming candle from live ticks the React host pushes in with `pushPrice`.
 * The tick must match the feed's price source (LTP trades for `ltp`, the SSE
 * mark for `mark`) so live and historical OHLC agree — see
 * updateCandlesWithLastTradePrice for the rationale.
 */
import type { Candle, FeedAdapter, FeedEvent, Instrument } from 'candleframe/core';
import type { HarnessMarketConversionParams } from '@/shared/lib/harness-market';
import {
  fetchPerpsCandles,
  getPerpsLoadMoreWindowSeconds,
  getPerpsTimeRangeForInterval,
  processPerpsCandleData,
  type ExtendedPerpsOHLCVData,
  type PerpsPriceSource,
  type PerpsTimeframe,
} from './perps-chart';

export const FERMI_INTERVALS: readonly PerpsTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const PRICE_SOURCE_LABEL: Record<PerpsPriceSource, string> = {
  mark: 'Mark price',
  ltp: 'Last trade',
};

const INTERVAL_MS: Record<PerpsTimeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

// Older-history pages that come back empty before we call history exhausted.
// Thin markets can have whole windows without a trade.
const EMPTY_PAGES_BEFORE_EXHAUSTED = 3;

export interface FermiFeedOptions {
  marketId: string;
  /** Chart symbol, e.g. "SOL-PERP". */
  symbol: string;
  base: string;
  quote: string;
  /** Smallest price step in UI units. */
  tickSize: number;
  conversion: HarnessMarketConversionParams;
  interval: PerpsTimeframe;
  source: PerpsPriceSource;
}

export interface FermiFeed extends FeedAdapter {
  readonly source: PerpsPriceSource;
  readonly interval: PerpsTimeframe;
  /** Extends (or opens) the forming candle with a live tick, in UI units. */
  pushPrice(price: number): void;
  /** Was connected and every connection has since been disposed. */
  readonly closed: boolean;
  /** Latest loaded candles, oldest first; for the host's 24h change readout. */
  subscribeCandles(listener: (candles: readonly Candle[]) => void): () => void;
}

const decimalsOf = (tick: number) => Math.max(0, Math.min(12, Math.ceil(-Math.log10(tick) - 1e-9)));

function toCandle(bar: ExtendedPerpsOHLCVData): Candle | null {
  const { open, high, low, close } = bar;
  if (
    open === undefined ||
    high === undefined ||
    low === undefined ||
    close === undefined ||
    ![open, high, low, close].every(n => Number.isFinite(n) && n > 0)
  ) {
    return null;
  }
  return {
    timeMs: bar.time * 1000,
    open,
    high: Math.max(high, open, close),
    low: Math.min(low, open, close),
    close,
    // CandleFrame needs a finite number.
    volume: Number.isFinite(bar.volume) && bar.volume! >= 0 ? bar.volume! : 0,
  };
}

function toCandles(bars: ExtendedPerpsOHLCVData[]): Candle[] {
  const out: Candle[] = [];
  for (const bar of bars) {
    const candle = toCandle(bar);
    if (!candle) continue;
    // Strictly ascending; a duplicate bucket keeps the later row.
    const last = out[out.length - 1];
    if (last && candle.timeMs <= last.timeMs) {
      if (candle.timeMs === last.timeMs) out[out.length - 1] = candle;
      continue;
    }
    out.push(candle);
  }
  return out;
}

export function createFermiFeed(options: FermiFeedOptions): FermiFeed {
  const { marketId, interval, source, conversion } = options;
  const intervalMs = INTERVAL_MS[interval];
  const pricePrecision = decimalsOf(options.tickSize);
  const instrument: Instrument = {
    symbol: options.symbol,
    name: options.symbol,
    base: options.base,
    quote: options.quote,
    tickSize: options.tickSize,
    pricePrecision,
    quantityPrecision: 4,
  };

  // Shared across connections: the candles the chart currently shows.
  let candles: Candle[] = [];
  const emitters = new Set<(event: FeedEvent) => void>();
  const candleListeners = new Set<(candles: readonly Candle[]) => void>();
  const broadcast = (event: FeedEvent) => {
    for (const emit of [...emitters]) emit(event);
  };
  const notifyCandles = () => {
    for (const listener of [...candleListeners]) listener(candles);
  };
  // A tick that arrives before history resolves is applied once it does.
  let historyLoaded = false;
  let pendingPrice: number | null = null;
  let everConnected = false;

  const fetchRange = async (fromIso: string, toIso: string) =>
    toCandles(
      processPerpsCandleData(
        await fetchPerpsCandles({
          marketId,
          tf: interval,
          from: fromIso,
          to: toIso,
          priceSource: source,
        }),
        conversion,
        source
      )
    );

  // Folds a tick into the forming candle. Returns the changed bar, or null
  // when the tick predates the last bar (clock skew).
  const mergePrice = (price: number): Candle | null => {
    const bucket = Math.floor(Date.now() / intervalMs) * intervalMs;
    const last = candles[candles.length - 1];
    if (last && last.timeMs === bucket) {
      const next = {
        ...last,
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
      };
      candles = [...candles.slice(0, -1), next];
      return next;
    }
    if (last && last.timeMs > bucket) return null;
    // Open from the prior close so the series stays continuous.
    const open = last?.close ?? price;
    const next = {
      timeMs: bucket,
      open,
      high: Math.max(open, price),
      low: Math.min(open, price),
      close: price,
      volume: 0,
    };
    candles = [...candles, next];
    return next;
  };

  const applyPrice = (price: number) => {
    const seeding = candles.length === 0;
    const changed = mergePrice(price);
    if (!changed) return;
    // A brand-new market's first tick is its whole history.
    broadcast(seeding ? { type: 'candles.history', candles } : { type: 'candle', candle: changed });
    notifyCandles();
  };

  return {
    source,
    interval,
    get closed() {
      return everConnected && emitters.size === 0;
    },
    descriptor: {
      id: source,
      label: PRICE_SOURCE_LABEL[source],
      instrument,
      interval,
      intervalMs,
      simulated: false,
      // LTP history skips buckets without trades, and a live tick after a quiet
      // spell can open a bar several intervals later. Collapse those gaps, as
      // lightweight-charts did.
      gaps: true,
      depth: { kind: 'none', levels: 0 },
    },

    pushPrice(price) {
      if (!Number.isFinite(price) || price <= 0) return;
      if (!historyLoaded) {
        pendingPrice = price;
        return;
      }
      applyPrice(price);
    },

    subscribeCandles(listener) {
      candleListeners.add(listener);
      if (candles.length) listener(candles);
      return () => candleListeners.delete(listener);
    },

    connect(emit) {
      let disposed = false;
      let paused = false;
      let emptyPages = 0;
      const send = (event: FeedEvent) => {
        if (!disposed && !paused) emit(event);
      };
      emitters.add(send);
      everConnected = true;

      const load = async () => {
        emit({ type: 'stream.status', stream: 'candles', status: 'loading' });
        try {
          const { startTime, endTime } = getPerpsTimeRangeForInterval(interval);
          const history = await fetchRange(startTime, endTime);
          if (disposed) return;
          // Keep bars a previous connection built from live ticks.
          const lastFetched = history[history.length - 1]?.timeMs ?? -1;
          candles = [...history, ...candles.filter(c => c.timeMs > lastFetched)];
          historyLoaded = true;
          if (pendingPrice !== null) {
            mergePrice(pendingPrice);
            pendingPrice = null;
          }
          if (candles.length) {
            send({ type: 'candles.history', candles });
            notifyCandles();
          } else {
            send({
              type: 'stream.status',
              stream: 'candles',
              status: 'loading',
              message: source === 'mark' ? 'No price data yet' : 'No trades yet',
            });
          }
        } catch (error) {
          if (disposed) return;
          send({
            type: 'stream.status',
            stream: 'candles',
            status: 'error',
            message: error instanceof Error ? error.message : 'Failed to fetch chart data',
          });
        }
      };
      void load();

      return {
        setPaused(value) {
          if (disposed || paused === value) return;
          paused = value;
          if (!paused && candles.length) emit({ type: 'candles.history', candles });
        },
        // The widget's Reconnect button lands here after an error.
        requestSnapshot() {
          if (!disposed && !historyLoaded) void load();
        },
        loadOlder(beforeMs) {
          const toSec = Math.floor(beforeMs / 1000) - 1;
          const loadPage = async (endSec: number): Promise<void> => {
            const fromSec = endSec - getPerpsLoadMoreWindowSeconds(interval);
            try {
              const page = (
                await fetchRange(
                  new Date(fromSec * 1000).toISOString(),
                  new Date(endSec * 1000).toISOString()
                )
              ).filter(c => c.timeMs < beforeMs);
              if (disposed || paused) return;
              if (page.length === 0) {
                emptyPages++;
                if (emptyPages < EMPTY_PAGES_BEFORE_EXHAUSTED) return loadPage(fromSec - 1);
                send({ type: 'candles.prepend', candles: [], exhausted: true });
                return;
              }
              emptyPages = 0;
              candles = [...page, ...candles.filter(c => c.timeMs >= beforeMs)];
              send({ type: 'candles.prepend', candles: page });
              notifyCandles();
            } catch (error) {
              send({
                type: 'candles.prepend',
                candles: [],
                error: error instanceof Error ? error.message : 'Failed to load older candles',
              });
            }
          };
          void loadPage(toSec);
        },
        dispose() {
          disposed = true;
          emitters.delete(send);
        },
      };
    },
  };
}
