/**
 * Sequencer API client
 */
import axios, { AxiosResponse } from 'axios';
import { config } from '../config/constants';
import { tryCatch } from '../lib/try-catch';

const baseUrl = config.devnet.sequencerApiUrl;

export interface Market {
  uuid: string;
  name: string;
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: number;
  quote_lot_size: number;
  [key: string]: any;
}

export interface OrderbookItem {
  market_id: string;
  base_mint: string;
  quote_mint: string;
  price: number;
  size: number;
  [key: string]: any;
}

export interface Orderbook {
  buys: OrderbookItem[];
  sells: OrderbookItem[];
}

export interface Order {
  id: string;
  market_id: string;
  price: number;
  size: number;
  side: string;
  status: string;
  [key: string]: any;
}

interface GetMarketsResponse {
  data: {
    data: Market[];
  };
}

interface GetOrderbookResponse {
  data: {
    data: Orderbook;
  };
}

export async function ping() {
  const healthCheck = await axios.get(`${baseUrl}/health`);
  return healthCheck;
}

export async function getMarkets() {
  const { data, error } = await tryCatch<AxiosResponse<GetMarketsResponse>>(
    axios.get(`${baseUrl}/markets`)
  );

  if (error) {
    throw error;
  }

  return data.data.data;
}

export async function submitOrderToSequencer(body: any) {
  const { data, error } = await tryCatch(axios.post(`${baseUrl}/orders`, body));

  if (error) {
    throw error;
  }

  return data.data;
}

export async function fetchOrderbook(marketId: string) {
  const { data, error } = await tryCatch<AxiosResponse<GetOrderbookResponse>>(
    axios.get(`${baseUrl}/markets/${marketId}/orderbook`)
  );

  if (error) {
    throw error;
  }

  return data.data.data;
}

export async function submitCancelOrderToSequencer(body: any) {
  const { data, error } = await tryCatch<AxiosResponse<Order>>(
    axios.post(`${baseUrl}/cancel_order`, body)
  );

  if (error) {
    throw error;
  }

  return data.data;
}
