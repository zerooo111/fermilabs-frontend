/**
 * Perps chart library
 * Handles perps-specific candle data fetching and processing
 * Uses the new Binance-style compact array format: [timestamp_ms, open, high, low, close]
 */
import axios from 'axios';
import { config, API_ROUTES } from '@/shared/config/constants';

// Compact array format: [timestamp_ms, open, high, low, close]
export type Candle = [number, number, number, number, number];

export interface PerpsCandleParams {
  marketId: string;
  tf?: string; // Timeframe: 1m, 5m, 15m, 1h, 4h, 1d
  from?: string; // Start date in RFC3339 format
  to?: string; // End date in RFC3339 format
  limit?: number; // Maximum number of candles (1-1000, default: 500)
}

export type PerpsTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface ExtendedPerpsOHLCVData {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

/**
 * Fetch perps candle data from the API
 * Returns data in compact array format: [[timestamp_ms, open, high, low, close], ...]
 */
export async function fetchPerpsCandles(params: PerpsCandleParams): Promise<Candle[]> {
  const { marketId, tf = '1h', from, to, limit } = params;

  const queryParams = new URLSearchParams({ tf });
  if (from) queryParams.append('from', from);
  if (to) queryParams.append('to', to);
  if (limit) queryParams.append('limit', limit.toString());

  try {
    const baseRoute = API_ROUTES.market_candles.split('?')[0].replace('{marketId}', marketId);
    const response = await axios.get<Candle[]>(
      `${config.devnet.apiBaseUrl}${baseRoute}?${queryParams}`
    );

    // Validate response is an array
    if (!Array.isArray(response.data)) {
      throw new Error('Invalid response format: expected an array');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle error response format: { data: null, statusCode: number, error: string }
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error(error.message || 'Failed to fetch candle data');
    }
    throw new Error('Unknown error occurred while fetching candle data');
  }
}

/**
 * Get time range for a given timeframe
 * Respects the 30-day API limit for date ranges
 */
export function getPerpsTimeRangeForInterval(timeframe: PerpsTimeframe): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  let startTime: Date;
  const maxDays = 30; // API limit: 30 days maximum

  switch (timeframe) {
    case '1m':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours
      break;
    case '5m':
      startTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days
      break;
    case '15m':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
      break;
    case '1h':
      startTime = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000); // 30 days (API limit)
      break;
    case '4h':
      startTime = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000); // 30 days (API limit)
      break;
    case '1d':
      startTime = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000); // 30 days (API limit)
      break;
    default:
      startTime = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000); // Default to 30 days
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}

/**
 * Convert perps candle data from compact array format to the format expected by TradingView charts
 * Input format: [timestamp_ms, open, high, low, close]
 */
export function processPerpsCandleData(candleData: Candle[]): ExtendedPerpsOHLCVData[] {
  return candleData.map(([timestampMs, open, high, low, close]) => {
    try {
      // Convert milliseconds timestamp to Unix timestamp (seconds)
      const time = Math.floor(timestampMs / 1000);

      return {
        time,
        open,
        high,
        low,
        close,
        volume: 0, // API doesn't provide volume, set to 0
      };
    } catch (error) {
      console.log(error);
      // Return a minimal valid item with just the time to avoid breaking the map function
      return { time: Math.floor(Date.now() / 1000) };
    }
  });
}

/**
 * Calculate latest price and price change for perps data
 */
export function calculatePerpsPriceChange(data: ExtendedPerpsOHLCVData[]) {
  if (!data || data.length === 0) return null;

  // Find the last valid candle with price data
  let lastValidCandle: ExtendedPerpsOHLCVData | null = null;
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
}

/**
 * Get the current candle timestamp for a given timeframe
 * Returns the start timestamp (in seconds) of the current candle period
 */
export function getCurrentCandleTimestamp(timeframe: PerpsTimeframe): number {
  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  let intervalSeconds: number;
  switch (timeframe) {
    case '1m':
      intervalSeconds = 60;
      break;
    case '5m':
      intervalSeconds = 5 * 60;
      break;
    case '15m':
      intervalSeconds = 15 * 60;
      break;
    case '1h':
      intervalSeconds = 60 * 60;
      break;
    case '4h':
      intervalSeconds = 4 * 60 * 60;
      break;
    case '1d':
      intervalSeconds = 24 * 60 * 60;
      break;
    default:
      intervalSeconds = 60 * 60;
  }

  // Round down to the start of the current interval
  return Math.floor(nowSeconds / intervalSeconds) * intervalSeconds;
}

/**
 * Update candles array with a new mark price
 * Intelligently updates the current candle or creates a new one if needed
 */
export function updateCandlesWithMarkPrice(
  candles: ExtendedPerpsOHLCVData[],
  markPrice: number,
  timeframe: PerpsTimeframe
): ExtendedPerpsOHLCVData[] {
  if (!candles || candles.length === 0 || !markPrice || markPrice <= 0) {
    return candles;
  }

  const currentCandleTimestamp = getCurrentCandleTimestamp(timeframe);
  const candlesCopy = [...candles];

  // Find the last candle
  const lastCandle = candlesCopy[candlesCopy.length - 1];

  if (!lastCandle) {
    // No candles exist, create a new one
    candlesCopy.push({
      time: currentCandleTimestamp,
      open: markPrice,
      high: markPrice,
      low: markPrice,
      close: markPrice,
    });
    return candlesCopy;
  }

  // Check if the last candle is for the current period
  if (lastCandle.time === currentCandleTimestamp) {
    // Update existing current candle
    const updatedCandle: ExtendedPerpsOHLCVData = {
      ...lastCandle,
      close: markPrice,
      high: Math.max(lastCandle.high ?? markPrice, markPrice),
      low: Math.min(lastCandle.low ?? markPrice, markPrice),
      // Ensure open is set if it wasn't before
      open: lastCandle.open ?? markPrice,
    };
    candlesCopy[candlesCopy.length - 1] = updatedCandle;
  } else if (lastCandle.time < currentCandleTimestamp) {
    // New candle period has started
    // Close the previous candle if it doesn't have a close price
    if (lastCandle.close === undefined && lastCandle.open !== undefined) {
      candlesCopy[candlesCopy.length - 1] = {
        ...lastCandle,
        close: lastCandle.open,
      };
    }

    // Create a new candle for the current period
    candlesCopy.push({
      time: currentCandleTimestamp,
      open: markPrice,
      high: markPrice,
      low: markPrice,
      close: markPrice,
    });
  }
  // If lastCandle.time > currentCandleTimestamp, something is wrong (future candle)
  // Just update the last candle in this case

  return candlesCopy;
}
