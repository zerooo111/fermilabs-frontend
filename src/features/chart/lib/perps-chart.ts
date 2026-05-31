/**
 * Perps chart library
 * Handles perps-specific candle data fetching and processing.
 * Uses /v2/candles/:market (Redis-derived Binance klines shape). Falls back
 * to the legacy /ohlc/:market only if the v2 feature flag is off.
 */
import axios from 'axios';
import { config, API_ROUTES_V2 } from '@/shared/config/constants';
import {
  HarnessMarketConversionParams,
  lotsPriceToUiWithMarket,
} from '@/shared/lib/harness-market';

// Compact array format: [timestamp_ms, open, high, low, close, volume]
export type Candle = [number, number, number, number, number, number];

export interface PerpsCandleParams {
  marketId: string;
  tf?: string;
  from?: string;
  to?: string;
  limit?: number;
  /** Price source; defaults to 'ltp' (the server default). */
  priceSource?: PerpsPriceSource;
}

export type PerpsTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * Price source for the candles:
 * - 'ltp'  — last traded price, derived from our trades hypertable (default).
 * - 'mark' — Pyth index price. On a thin new venue the LTP chart is sparse,
 *            so we offer a smoother mark series. Mark prices arrive already in
 *            native USD (the server has no lot config to convert), so the
 *            lots→UI conversion is skipped for mark candles.
 */
export type PerpsPriceSource = 'ltp' | 'mark';

export interface ExtendedPerpsOHLCVData {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

// Raw kline from the /ohlc endpoint (Binance format, index-based array)
type RawKline = [
  number, // 0: open time (ms)
  string, // 1: open price (lots)
  string, // 2: high price (lots)
  string, // 3: low price (lots)
  string, // 4: close price (lots)
  string, // 5: volume (base lots)
  number, // 6: close time (ms)
  string, // 7: quote volume
  number, // 8: trade count
];

/**
 * Fetch perps candle data from the /ohlc/:market endpoint.
 * Returns data in compact array format: [[timestamp_ms, open_lots, high_lots, low_lots, close_lots], ...]
 */
const MAX_OHLC_LIMIT = 1500;

export async function fetchPerpsCandles(params: PerpsCandleParams): Promise<Candle[]> {
  const { marketId, tf = '1h', limit, from, to, priceSource = 'ltp' } = params;

  const path = config.devnet.useV2ReadLayer
    ? API_ROUTES_V2.candles.replace('{marketId}', encodeURIComponent(marketId))
    : `/ohlc/${encodeURIComponent(marketId)}`;
  const url = new URL(`${config.devnet.gatewayUrl}${path}`);
  url.searchParams.set('tf', tf);
  // Only send price=mark; omitting it preserves the legacy/default ltp behavior
  // (and the legacy /ohlc endpoint, which doesn't know the param).
  if (priceSource === 'mark') {
    url.searchParams.set('price', 'mark');
  }

  // The endpoint expects from/to as Unix seconds.
  // The caller passes ISO strings — convert them.
  if (from) {
    const parsed = Date.parse(from);
    if (Number.isFinite(parsed)) {
      url.searchParams.set('from', String(Math.floor(parsed / 1000)));
    }
  }
  if (to) {
    const parsed = Date.parse(to);
    if (Number.isFinite(parsed)) {
      url.searchParams.set('to', String(Math.floor(parsed / 1000)));
    }
  }
  // Server default limit is 500 with ORDER BY bucket ASC, which silently
  // truncates wide windows to the oldest 500 buckets and hides the latest
  // candle. Always request the max so the window end stays visible.
  url.searchParams.set('limit', String(Math.min(limit ?? MAX_OHLC_LIMIT, MAX_OHLC_LIMIT)));

  const response = await axios.get<RawKline[]>(url.toString());
  const klines = response.data;

  if (!Array.isArray(klines)) return [];

  return klines.map(k => [
    Number(k[0]), // open time (ms)
    Number(k[1]), // open price (lots)
    Number(k[2]), // high price (lots)
    Number(k[3]), // low price (lots)
    Number(k[4]), // close price (lots)
    Number(k[5]), // volume (base lots)
  ]);
}

/**
 * Get time range for a given timeframe.
 */
export function getPerpsTimeRangeForInterval(timeframe: PerpsTimeframe): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  let startMs: number;
  const DAY_MS = 24 * 60 * 60 * 1000;

  switch (timeframe) {
    case '1m':
      startMs = now.getTime() - 1 * DAY_MS;
      break;
    case '5m':
      startMs = now.getTime() - 3 * DAY_MS;
      break;
    case '15m':
      startMs = now.getTime() - 7 * DAY_MS;
      break;
    case '1h':
    case '4h':
    case '1d':
    default:
      startMs = now.getTime() - 30 * DAY_MS;
      break;
  }

  return { startTime: new Date(startMs).toISOString(), endTime };
}

/**
 * Span (in seconds) to request per loadMore call. Matches the span used for
 * the initial fetch for the same timeframe.
 */
export function getPerpsLoadMoreWindowSeconds(timeframe: PerpsTimeframe): number {
  const DAY = 24 * 60 * 60;
  switch (timeframe) {
    case '1m':
      return 1 * DAY;
    case '5m':
      return 3 * DAY;
    case '15m':
      return 7 * DAY;
    case '1h':
    case '4h':
    case '1d':
    default:
      return 30 * DAY;
  }
}

/**
 * Convert perps candle data from compact array format to the format expected by TradingView charts.
 * Input format: [timestamp_ms, open_lots, high_lots, low_lots, close_lots]
 */
export function processPerpsCandleData(
  candleData: Candle[],
  market?: HarnessMarketConversionParams | null,
  priceSource: PerpsPriceSource = 'ltp'
): ExtendedPerpsOHLCVData[] {
  // Mark candles already arrive in native UI price (USD) from Pyth — the
  // server has no lot config to convert them to price_lots, so we must NOT
  // apply the lots→UI conversion that LTP candles need.
  const toUi =
    priceSource === 'mark'
      ? (price: number) => price
      : (price: number) => lotsPriceToUiWithMarket(price, market);
  return candleData.map(([timestampMs, open, high, low, close, volume]) => {
    try {
      return {
        time: Math.floor(timestampMs / 1000),
        open: toUi(open),
        high: toUi(high),
        low: toUi(low),
        close: toUi(close),
        // Pyth mark candles have no volume — leave it undefined so the chart's
        // volume histogram draws nothing instead of a flat zero baseline.
        volume: priceSource === 'mark' ? undefined : volume,
      };
    } catch {
      return { time: Math.floor(Date.now() / 1000) };
    }
  });
}

/**
 * Calculate latest price and the rolling 24h change for perps data.
 * Reference price is the close of the candle whose bucket is closest to
 * (latestTime - 24h); falls back to the oldest available candle if 24h of
 * history isn't present yet.
 */
const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

export function calculatePerpsPriceChange(data: ExtendedPerpsOHLCVData[]) {
  if (!data || data.length === 0) return null;

  let latest: ExtendedPerpsOHLCVData | null = null;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].close !== undefined && data[i].open !== undefined) {
      latest = data[i];
      break;
    }
  }
  if (!latest?.close) return null;

  const targetTime = latest.time - TWENTY_FOUR_HOURS_SECONDS;
  let reference: ExtendedPerpsOHLCVData | null = null;
  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    if (candle.close === undefined) continue;
    if (candle.time >= targetTime) {
      reference = candle;
      break;
    }
  }
  // No candle within the 24h window — fall back to the oldest available.
  if (!reference) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].close !== undefined) {
        reference = data[i];
        break;
      }
    }
  }
  if (!reference?.close || reference === latest) {
    return {
      price: latest.close,
      isPositive: true,
      change: 0,
      percentChange: '0.0',
    };
  }

  const referencePrice = reference.close;
  const priceChange = latest.close - referencePrice;
  return {
    price: latest.close,
    isPositive: priceChange >= 0,
    change: Math.abs(priceChange),
    percentChange: referencePrice
      ? ((Math.abs(priceChange) / referencePrice) * 100).toFixed(1)
      : '0.0',
  };
}

/**
 * Get the current candle timestamp for a given timeframe.
 * Returns the start timestamp (in seconds) of the current candle period.
 */
export function getCurrentCandleTimestamp(timeframe: PerpsTimeframe): number {
  const nowSeconds = Math.floor(Date.now() / 1000);

  let intervalSeconds: number;
  switch (timeframe) {
    case '1m':
      intervalSeconds = 60;
      break;
    case '5m':
      intervalSeconds = 300;
      break;
    case '15m':
      intervalSeconds = 900;
      break;
    case '1h':
      intervalSeconds = 3600;
      break;
    case '4h':
      intervalSeconds = 14400;
      break;
    case '1d':
      intervalSeconds = 86400;
      break;
    default:
      intervalSeconds = 3600;
  }

  return Math.floor(nowSeconds / intervalSeconds) * intervalSeconds;
}

/**
 * Update candles array with a new live price, extending the forming candle.
 *
 * Source-agnostic: the caller passes whichever tick matches the active
 * historical series, so live and historical OHLC stay consistent —
 *   • ltp mode  → last traded price (matches the trade-derived /v2/candles).
 *   • mark mode → mark/oracle tick (matches /v2/candles?price=mark).
 * Passing the wrong source (e.g. an LTP trade price onto a mark chart) would
 * paint wicks that diverge from the historical endpoint on every refresh.
 */
export function updateCandlesWithLastTradePrice(
  candles: ExtendedPerpsOHLCVData[],
  lastTradePrice: number,
  timeframe: PerpsTimeframe
): ExtendedPerpsOHLCVData[] {
  if (!lastTradePrice || lastTradePrice <= 0) {
    return candles;
  }

  const currentCandleTimestamp = getCurrentCandleTimestamp(timeframe);
  // Starting from an empty list is a valid state — new markets with no
  // history start here, and the first trade tick seeds candle 0.
  const candlesCopy = candles ? [...candles] : [];
  const lastCandle = candlesCopy[candlesCopy.length - 1];

  if (!lastCandle) {
    candlesCopy.push({
      time: currentCandleTimestamp,
      open: lastTradePrice,
      high: lastTradePrice,
      low: lastTradePrice,
      close: lastTradePrice,
    });
    return candlesCopy;
  }

  if (lastCandle.time === currentCandleTimestamp) {
    candlesCopy[candlesCopy.length - 1] = {
      ...lastCandle,
      close: lastTradePrice,
      high: Math.max(lastCandle.high ?? lastTradePrice, lastTradePrice),
      low: Math.min(lastCandle.low ?? lastTradePrice, lastTradePrice),
      open: lastCandle.open ?? lastTradePrice,
    };
  } else if (lastCandle.time < currentCandleTimestamp) {
    if (lastCandle.close === undefined && lastCandle.open !== undefined) {
      candlesCopy[candlesCopy.length - 1] = { ...lastCandle, close: lastCandle.open };
    }
    // Seed the new bucket's open with the prior close so the line stays
    // continuous instead of opening as a flat dot at the new trade price.
    const priorClose = candlesCopy[candlesCopy.length - 1]?.close ?? lastTradePrice;
    candlesCopy.push({
      time: currentCandleTimestamp,
      open: priorClose,
      high: Math.max(priorClose, lastTradePrice),
      low: Math.min(priorClose, lastTradePrice),
      close: lastTradePrice,
    });
  }

  return candlesCopy;
}
