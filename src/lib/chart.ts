import axios from 'axios';
import { PublicKey } from '@solana/web3.js';

export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleParams {
  interval: TimeInterval;
  startTime: number;
  endTime: number;
  baseMint: string;
  quoteMint: string;
}

const baseUrl = 'http://localhost:3000';

export async function fetchCandles(params: CandleParams): Promise<OHLCVData[]> {
  try {
    const response = await axios.get(`${baseUrl}/candles`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching candle data:', error);
    throw error;
  }
}

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
