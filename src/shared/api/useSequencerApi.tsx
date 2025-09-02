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
  order_count: number;
  price: number;
  total_quantity: number;
}

export interface OrderbookSummary {
  asks: OrderbookItem[];
  bids: OrderbookItem[];
  last_trade_price: number;
  timestamp: number;
}

export interface Orderbook {
  buys: OrderbookItem[];
  sells: OrderbookItem[];
}

export interface Order {
  base_mint: string;
  expiry: number;
  market_id: string;
  order_id: number;
  price: number;
  quantity: number;
  quote_mint: string;
  side: string;
  timestamp: number;
}

export interface UserOrdersResponse {
  orders: Order[];
  owner: string;
  total_orders: number;
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
    []
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
    const apiBaseUrl = config.devnet.apiBaseUrl;
    const url = `${apiBaseUrl}/me/markets/${marketId}/orderbook/summary`;

    const { data, error } = await tryCatch<AxiosResponse<OrderbookSummary>>(axios.get(url));

    if (error) {
      throw error;
    }

    // Extract the orderbook data from the response
    const responseData = data.data;

    // Transform the API response to match our internal structure
    const orderbook: Orderbook = {
      buys:
        responseData.bids.map(bid => ({
          order_count: bid.order_count,
          price: bid.price,
          quantity: bid.total_quantity,
          total_quantity: bid.total_quantity,
        })) || [],
      sells:
        responseData.asks.map(ask => ({
          order_count: ask.order_count,
          price: ask.price,
          quantity: ask.total_quantity,
          total_quantity: ask.total_quantity,
        })) || [],
    };

    return orderbook;
  }, []);

  const fetchUserOrders = useCallback(async (pubkey: string): Promise<Order[]> => {
    const apiBaseUrl = config.devnet.apiBaseUrl;
    const url = `${apiBaseUrl}/me/orders/user/${pubkey}`;

    const { data, error } = await tryCatch<AxiosResponse<UserOrdersResponse>>(axios.get(url));

    if (error) {
      throw error;
    }

    return data.data.orders || [];
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
    fetchUserOrders,
    submitCancelOrderToSequencer,
    fetchTrades,
  };
}
