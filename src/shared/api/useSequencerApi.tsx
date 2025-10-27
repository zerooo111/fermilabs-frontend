/**
 * useSequencerApi.tsx
 * Custom hook for making API calls to the sequencer
 * Adapts to the selected server from entities/server/model.ts
 */
import { useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { useSelectedServer } from '@/entities/server';
import { tryCatch } from '@/shared/lib/try-catch';
import { config, API_ROUTES } from '../config/constants';

export interface Market {
  uuid: string;
  base_mint: string;
  quote_mint: string;
  name: string;
  created_at: number;
  kind: 'spot' | 'perp' | 'Perpetual';
  perp_config: {
    funding_interval_seconds: number;
    funding_interest_rate_bps: number;
    funding_oracle: string | null;
    funding_premium_cap_bps: number;
    funding_rate_cap_bps: number;
    initial_margin: number;
    liquidation_penalty: number;
    maintenance_margin: number;
    // New simplified structure
    max_leverage?: number;
    initial_margin_bps?: number;
    maintenance_margin_bps?: number;
    // Old structure with tiers
    max_leverage_tiers?: Array<{
      notional: number;
      max_leverage: number;
    }>;
  } | null;
  perp_state: {
    // New structure
    funding_rate_bps?: number;
    last_funding_update?: number;
    mark_price?: number;
    index_price?: number;
    // Old structure
    last_funding_rate_bps?: number | null;
    last_funding_timestamp?: number | null;
    last_premium_rate_bps?: number | null;
    mark_price_timestamp?: number | null;
    index_price_timestamp?: number | null;
    next_funding_timestamp?: number | null;
  } | null;
  base_decimals: number;
  quote_decimals: number;
  price_decimals: number | null;
  base_lot_size: number;
  quote_lot_size: number;
}

export interface OrderbookOrder {
  order_id: number;
  owner: string;
  price: number;
  quantity: number;
  side: 'Buy' | 'Sell';
  expiry: number;
  base_mint: string;
  quote_mint: string;
  market_id: string;
}

export interface Orderbook {
  buys: OrderbookOrder[];
  sells: OrderbookOrder[];
}

export interface OrderbookSummary {
  market_id: string;
  bid_count: number;
  ask_count: number;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
  total_bid_volume: string;
  total_ask_volume: string;
}

export interface OrderbookDepth {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity] pairs
  asks: [string, string][]; // [price, quantity] pairs
}

export interface Order {
  order_id: number;
  market_id: string;
  market_name: string;
  owner: string;
  side: 'Buy' | 'Sell';
  price: number;
  quantity: number;
  expiry: number;
  timestamp: number;
  base_mint: string;
  quote_mint: string;
}

export interface Trade {
  buyer_owner: string;
  seller_owner: string;
  price: number;
  quantity: number;
  timestamp: number;
  base_mint: string;
  quote_mint: string;
}

export interface TokenBalance {
  available: string;
  reserved: string;
}

export interface UserBalancesResponse {
  [mint: string]: TokenBalance;
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
    const url = `${apiBaseUrl}${API_ROUTES.market_orderbook_summary.replace('{marketId}', marketId)}`;

    const { data, error } = await tryCatch<AxiosResponse<OrderbookSummary>>(axios.get(url));

    if (error) {
      throw error;
    }

    // Return the orderbook data directly from the response
    return data.data;
  }, []);

  const fetchOrderbookDepth = useCallback(async (marketId: string): Promise<OrderbookDepth> => {
    const apiBaseUrl = config.devnet.apiBaseUrl;
    const url = `${apiBaseUrl}${API_ROUTES.market_orderbook_depth.replace('{marketId}', marketId)}`;

    const { data, error } = await tryCatch<AxiosResponse<OrderbookDepth>>(axios.get(url));

    if (error) {
      throw error;
    }

    return data.data;
  }, []);

  const fetchUserOrders = useCallback(async (pubkey: string): Promise<Order[]> => {
    const apiBaseUrl = config.devnet.apiBaseUrl;
    const url = `${apiBaseUrl}${API_ROUTES.user_orders.replace('{pubkey}', pubkey)}`;

    const { data, error } = await tryCatch<AxiosResponse<Order[]>>(axios.get(url));

    if (error) {
      throw error;
    }

    return data.data || [];
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
    const url = `${apiBaseUrl}${API_ROUTES.user_balances.replace('{pubkey}', pubkey)}`;

    const { data, error } = await tryCatch<AxiosResponse<UserBalancesResponse>>(axios.get(url));

    if (error) {
      throw error;
    }

    return data.data;
  }, []);

  return {
    ping,
    fetchOrderbook,
    fetchOrderbookDepth,
    fetchUserOrders,
    submitCancelOrderToSequencer,
    fetchTrades,
    fetchUserBalances,
  };
}
