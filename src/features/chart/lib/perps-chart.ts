/**
 * Perps chart library
 * Handles perps-specific candle data fetching and processing
 */
import axios from 'axios';
import { config, API_ROUTES } from '@/shared/config/constants';

export interface PerpsCandleData {
  t: string; // Timestamp in RFC3339 format
  o: number; // Open price
  h: number; // High price
  l: number; // Low price
  c: number; // Close price
}

export interface PerpsCandlesResponse {
  data: PerpsCandleData[];
  statusCode: number;
  error?: string;
}

export interface PerpsCandleParams {
  marketId: string;
  tf?: string; // Timeframe: 1m, 5m, 15m, 1h, 4h, 1d
  from?: string; // Start date in RFC3339 format
  to?: string; // End date in RFC3339 format
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
 */
export async function fetchPerpsCandles(params: PerpsCandleParams): Promise<PerpsCandleData[]> {
  const { marketId, tf = '1h', from, to } = params;

  const queryParams = new URLSearchParams({ tf });
  if (from) queryParams.append('from', from);
  if (to) queryParams.append('to', to);

  try {
    const baseRoute = API_ROUTES.market_candles.split('?')[0].replace('{marketId}', marketId);
    const response = await axios.get<PerpsCandlesResponse>(
      `${config.devnet.apiBaseUrl}${baseRoute}?${queryParams}`
    );

    const result = response.data;

    if (result.statusCode !== 200) {
      throw new Error(result.error || 'Failed to fetch candle data');
    }

    return result.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.error || error.message;
      throw new Error(errorMessage);
    }
    throw new Error('Unknown error occurred while fetching candle data');
  }
}

/**
 * Get time range for a given timeframe
 */
export function getPerpsTimeRangeForInterval(timeframe: PerpsTimeframe): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  let startTime: Date;

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
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
      break;
    case '4h':
      startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
      break;
    case '1d':
      startTime = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
      break;
    default:
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}

/**
 * Convert perps candle data to the format expected by TradingView charts
 */
export function processPerpsCandleData(
  candleData: PerpsCandleData[],
  quoteDecimals: number
): ExtendedPerpsOHLCVData[] {
  return candleData.map(item => {
    try {
      // Convert RFC3339 timestamp to Unix timestamp (seconds)
      const time = Math.floor(new Date(item.t).getTime() / 1000);

      return {
        time,
        open: item.o / Math.pow(10, quoteDecimals),
        high: item.h / Math.pow(10, quoteDecimals),
        low: item.l / Math.pow(10, quoteDecimals),
        close: item.c / Math.pow(10, quoteDecimals),
        volume: 0, // Perps API doesn't provide volume, set to 0
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
