/**
 * useSequencerApi.tsx
 * Custom hook for making API calls to the sequencer
 * Adapts to the selected server from entities/server/model.ts
 */
import { useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { useSelectedServer } from '@/entities/server';
import { tryCatch } from '@/shared/lib/try-catch';
import { config } from '../config/constants';
import { PlaceOrderResponse } from '@/types';

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

export interface Trade {
  id: string;
  buyer_owner: string;
  seller_owner: string;
  buyer_order_id: number;
  seller_order_id: number;
  price: number;
  quantity: number;
  timestamp: number;
  market_id: string;
}

export function useSequencerApi() {
  const { selectedServer } = useSelectedServer();
  const baseUrl = selectedServer.url;
  const graphApiUrl = config.devnet.graphApiUrl;

  // Memoized API calls
  const ping = useCallback(async () => {
    const healthCheck = await axios.get(`${baseUrl}/health`);
    return healthCheck;
  }, [baseUrl]);

  const submitOrderToSequencer = useCallback(
    async (body: any) => {
      const { data, error } = await tryCatch<AxiosResponse<PlaceOrderResponse>>(
        axios.post(`${baseUrl}/orders`, body)
      );

      if (error) {
        throw error;
      }

      return data.data.data.receipt;
    },
    [baseUrl]
  );

  const submitCancelOrderToSequencer = useCallback(
    async (body: any) => {
      const { data, error } = await tryCatch<AxiosResponse<Order>>(
        axios.post(`${baseUrl}/orders/cancel`, body)
      );

      if (error) {
        throw error;
      }

      return data.data;
    },
    [baseUrl]
  );

  const fetchOrderbook = useCallback(async (marketId: string): Promise<Orderbook> => {
    const url = `${config.devnet.globalSequencerApiUrl}/markets/${marketId}/orderbook`;
    console.log('Fetching orderbook from:', url);

    const { data, error } = await tryCatch<AxiosResponse<any>>(axios.get(url));

    if (error) {
      console.error('Error fetching orderbook:', error);
      throw error;
    }

    // Extract the orderbook data from the response
    const responseData = data.data.data;
    console.log('Raw API response:', responseData);

    // Create a properly structured Orderbook object
    const orderbook: Orderbook = {
      buys: responseData.buys || [],
      sells: responseData.sells || [],
    };

    return orderbook;
  }, []);

  const fetchTrades = useCallback(
    async (owner: string, marketId: string, limit: number = 100): Promise<Trade[]> => {
      const { data, error } = await tryCatch<AxiosResponse<{ trades: Trade[] }>>(
        axios.post(`${graphApiUrl}/trades`, {
          owner,
          marketId,
          limit,
        })
      );

      console.log('data for /trades', { data, error });

      if (error) {
        throw error;
      }

      return data.data.trades || [];
    },
    [graphApiUrl]
  );

  return {
    ping,

    submitOrderToSequencer,
    fetchOrderbook,
    submitCancelOrderToSequencer,
    fetchTrades,
  };
}
