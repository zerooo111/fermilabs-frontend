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

export interface TokenBalance {
  available: number;
  locked: number;
  mint: string;
  total: number;
}

export interface UserBalancesResponse {
  balances: Record<string, TokenBalance>;
  margin_metrics: {
    available_withdrawal: string;
    equity: string;
    free_collateral: string;
    initial_margin: string;
    maintenance_margin: string;
    realized_pnl: string;
    reserved_margin: string;
    unrealized_pnl: string;
  };
  user: string;
}

export interface AirdropResponse {
  message: string;
  success: boolean;
  transaction_hash?: string;
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

  const fetchOrderbook = useCallback(async (marketId: string): Promise<OrderbookSummary> => {
    const apiBaseUrl = config.devnet.apiBaseUrl;
    const url = `${apiBaseUrl}/me/markets/${marketId}/orderbook/summary`;

    const { data, error } = await tryCatch<AxiosResponse<OrderbookSummary>>(axios.get(url));

    if (error) {
      throw error;
    }

    // Return the orderbook data directly from the response
    return data.data;
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

  const fetchUserBalances = useCallback(async (pubkey: string): Promise<UserBalancesResponse> => {
    const apiBaseUrl = config.devnet.apiBaseUrl;
    const url = `${apiBaseUrl}/me/balances/${pubkey}`;

    const { data, error } = await tryCatch<
      AxiosResponse<{ code: number; data: UserBalancesResponse; message: string }>
    >(axios.get(url));

    if (error) {
      throw error;
    }

    return data.data.data;
  }, []);

  const requestAirdrop = useCallback(
    async (receiverPubKey: string, tokenName: string): Promise<AirdropResponse> => {
      const apiBaseUrl = config.devnet.apiBaseUrl;
      const url = `${apiBaseUrl}/me/airdrop/${receiverPubKey}/${tokenName}`;

      const { data, error } = await tryCatch<AxiosResponse<AirdropResponse>>(
        axios.post(
          url,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }
        )
      );

      if (error) {
        if (axios.isAxiosError(error) && error.response) {
          const errorData = error.response.data;
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            throw new Error(`Airdrop failed: ${errorData.error}`);
          }
        }
        throw error;
      }

      return data.data;
    },
    []
  );

  return {
    ping,

    submitOrderToSequencer,
    fetchOrderbook,
    fetchUserOrders,
    submitCancelOrderToSequencer,
    fetchTrades,
    fetchUserBalances,
    requestAirdrop,
  };
}
