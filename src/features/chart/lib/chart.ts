/**
 * Chart utilities
 * Updated to match the graph API documentation
 */
import { config } from '@/shared/config/constants';
import axios from 'axios';

// Time intervals as defined in the API documentation
export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

// Map API interval values to human-readable format required by the API
export const intervalToApiFormat = {
  '1m': '1 minute',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '1d': '1 day',
};

// OHLCV data structure
export interface OHLCVData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isGapFilled?: boolean;
  gapFillMethod?: string;
}

// Extended OHLCV data that allows for partial data
export interface ExtendedOHLCVData {
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  isGapFilled?: boolean;
  gapFillMethod?: string;
}

// Parameters for fetching candle data
export interface CandleParams {
  interval: string; // Using the API format (e.g., '1 hour', '15 minutes')
  startTime: number; // Unix timestamp in seconds
  endTime: number; // Unix timestamp in seconds
  marketId: string; // Market identifier
}

/**
 * Fetch candle data from the Graph API
 * @param params Parameters for the API request
 * @returns Array of OHLCV data
 */
/**
 * Fetch candle data with fallback to larger timeframes if needed
 * @param params Parameters for the API request
 * @param attemptFallback Whether to attempt fallback to larger timeframes
 * @returns Array of OHLCV data
 */
export async function fetchCandles(params: CandleParams): Promise<OHLCVData[]> {
  try {
    const response = await axios.get(`${config.devnet.gatewayUrl}/candles`, { params });

    // Validate the response data
    if (!Array.isArray(response.data)) {
      // Silent error handling
      throw new Error('Invalid response data format: expected an array');
    }

    return response.data;
  } catch (error: any) {
    // Type assertion for better error handling
    // Silent error handling

    // Add more detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // Silent error handling
    } else if (error.request) {
      // The request was made but no response was received
      // Silent error handling
    } else {
      // Something happened in setting up the request that triggered an Error
      // Silent error handling
    }

    // Create a more user-friendly error message
    const errorMessage =
      error.response?.data?.message || error.message || 'Failed to fetch chart data';
    throw new Error(`Chart data error: ${errorMessage}`);
  }
}

/**
 * Calculate the appropriate time range for a given interval
 * @param interval The time interval
 * @returns Object containing startTime and endTime in Unix seconds
 */
export function getTimeRangeForInterval(interval: TimeInterval): {
  startTime: number;
  endTime: number;
} {
  const endTime = Math.floor(Date.now() / 1000);
  let startTime: number;

  switch (interval) {
    case '1m':
      startTime = endTime - 60 * 60 * 6; // 6 hours
      break;
    case '5m':
      startTime = endTime - 60 * 60 * 24; // 24 hours
      break;
    case '15m':
      startTime = endTime - 60 * 60 * 24 * 2; // 2 days
      break;
    case '1h':
      startTime = endTime - 60 * 60 * 24 * 7; // 7 days
      break;
    case '4h':
      startTime = endTime - 60 * 60 * 24 * 30; // 30 days
      break;
    case '1d':
      startTime = endTime - 60 * 60 * 24 * 90; // 90 days
      break;
    default:
      startTime = endTime - 60 * 60 * 24; // Default to 24 hours
  }

  return { startTime, endTime };
}
