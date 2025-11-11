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
