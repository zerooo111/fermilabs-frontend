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
    async (transactionData: {
      tx_id: string;
      payload: string;
      signature: string;
      public_key: string;
      nonce: string;
      timestamp: string;
    }) => {
      const body = {
        transaction: transactionData,
      };

      const { data, error } = await tryCatch<
        AxiosResponse<{
          sequence_number: string;
          expected_tick: string;
          tx_hash: string;
        }>
      >(
        axios.post(`http://localhost:3001/api/v1/tx`, body, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        })
      );

      if (error) {
        // Handle specific error responses from new API
        if (axios.isAxiosError(error) && error.response) {
          const errorData = error.response.data;
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            throw new Error(`API Error (${error.response.status}): ${errorData.error}`);
          }
        }
        throw error;
      }

      return data.data;
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

    const { data, error } = await tryCatch<AxiosResponse<any>>(axios.get(url));

    if (error) {
      console.error('Error fetching orderbook:', error);
      throw error;
    }

    // Extract the orderbook data from the response
    const responseData = data.data;

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
