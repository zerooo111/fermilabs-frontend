/**
 * useSequencerApi.tsx
 * Custom hook for making API calls to the sequencer
 * Adapts to the selected server from entities/server/model.ts
 */
import { useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { useSelectedServer } from '@/entities/server';
import { tryCatch } from '@/shared/lib/try-catch';

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

export function useSequencerApi() {
  const { selectedServer } = useSelectedServer();
  const baseUrl = selectedServer.url;

  // Memoized API calls
  const ping = useCallback(async () => {
    const healthCheck = await axios.get(`${baseUrl}/health`);
    return healthCheck;
  }, [baseUrl]);

  const getMarkets = useCallback(async (): Promise<Market[]> => {
    const { data, error } = await tryCatch<AxiosResponse<any>>(axios.get(`${baseUrl}/markets`));

    if (error) {
      throw error;
    }

    // Extract and return the array of markets
    return data.data.data || [];
  }, [baseUrl]);

  const submitOrderToSequencer = useCallback(
    async (body: any) => {
      const { data, error } = await tryCatch(axios.post(`${baseUrl}/orders`, body));

      if (error) {
        throw error;
      }

      return data.data;
    },
    [baseUrl]
  );

  const fetchOrderbook = useCallback(
    async (marketId: string): Promise<Orderbook> => {
      const { data, error } = await tryCatch<AxiosResponse<any>>(
        axios.get(`${baseUrl}/markets/${marketId}/orderbook`)
      );

      if (error) {
        throw error;
      }

      // Extract the orderbook data from the response
      const responseData = data.data.data;

      // Create a properly structured Orderbook object
      const orderbook: Orderbook = {
        buys: responseData.buys || [],
        sells: responseData.sells || [],
      };

      return orderbook;
    },
    [baseUrl]
  );

  const submitCancelOrderToSequencer = useCallback(
    async (body: any) => {
      const { data, error } = await tryCatch<AxiosResponse<Order>>(
        axios.post(`${baseUrl}/cancel_order`, body)
      );

      if (error) {
        throw error;
      }

      return data.data;
    },
    [baseUrl]
  );

  return {
    ping,
    getMarkets,
    submitOrderToSequencer,
    fetchOrderbook,
    submitCancelOrderToSequencer,
  };
}
