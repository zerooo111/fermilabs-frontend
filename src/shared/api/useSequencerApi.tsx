/**
 * useSequencerApi.tsx
 * Harness-backed API adapter for dashboard reads.
 */
import { useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { tryCatch } from '@/shared/lib/try-catch';
import { config, quoteMint, API_ROUTES } from '../config/constants';
import {
  lotsBaseToNative,
  lotsPriceToNative,
  lotsQuoteToNative,
} from '@/shared/lib/harness-market';

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
  order_id: string;
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
  order_id: string;
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
  id?: string;
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

interface HarnessMarketStateResponse {
  view: 'optimistic' | 'confirmed';
  data: {
    market: string;
    bids: Array<{ price_lots: string; base_lots: string }>;
    asks: Array<{ price_lots: string; base_lots: string }>;
    open_orders: Array<{
      order_id: string;
      owner: string;
      mango_account: string;
      market: string;
      side: 'bid' | 'ask';
      price_lots: string;
      base_lots: string;
      quote_lots: string;
      client_order_id: string;
      sequence: string;
      status: 'open';
    }>;
  };
}

interface HarnessOrdersResponse {
  view: 'optimistic' | 'confirmed';
  market: string;
  owner: string | null;
  data: HarnessMarketStateResponse['data']['open_orders'];
}

interface HarnessTradesResponse {
  view: 'optimistic' | 'confirmed';
  market: string;
  data: Array<{
    trade_id: string;
    market: string;
    price_lots: string;
    base_lots: string;
    quote_lots: string;
    taker_side: 'bid' | 'ask';
    maker_owner: string;
    taker_owner: string;
    ts_ms: number;
  }>;
}

interface HarnessBalancesResponse {
  view: 'optimistic' | 'confirmed';
  data: {
    owner: string;
    mango_accounts?: string[];
    per_market: Array<{
      market: string;
      open_order_base_lots_bid: string;
      open_order_base_lots_ask: string;
      quote_reserved_lots: string;
      base_position_lots: string;
      quote_position_native: string;
    }>;
    totals: {
      total_open_order_base_lots_bid: string;
      total_open_order_base_lots_ask: string;
      total_quote_reserved_lots: string;
    };
    optimistic_collateral?: {
      source?: string;
      usdc_mint?: string;
      usdc_ui_balance?: number;
      tokens?: Array<{
        token_index: number;
        mint: string;
        ui_balance: number;
        ui_deposits: number;
        ui_borrows: number;
      }>;
    };
  };
}

function marketIdOrDefault(marketId?: string): string {
  return marketId || config.devnet.defaultHarnessMarketId;
}

function uiToNativeString(uiAmount: number, decimals: number): string {
  if (!Number.isFinite(uiAmount)) return '0';
  const scaled = uiAmount * Math.pow(10, Math.max(0, decimals));
  if (!Number.isFinite(scaled)) return '0';
  return Math.round(scaled).toString();
}

export function useSequencerApi() {
  const harnessUrl = config.devnet.gatewayUrl;

  const ping = useCallback(async () => {
    const healthCheck = await axios.get(`${harnessUrl}${API_ROUTES.health}`);
    return healthCheck;
  }, [harnessUrl]);

  const submitCancelOrderToSequencer = useCallback(async () => {
    throw new Error('Cancel endpoint moved to relay bridge intent flow');
  }, []);

  const fetchOrderbook = useCallback(
    async (
      marketId: string,
      market?: Pick<Market, 'base_decimals' | 'quote_decimals' | 'base_lot_size' | 'quote_lot_size'>
    ): Promise<OrderbookSummary> => {
      const resolvedMarket = marketIdOrDefault(marketId);
      const url = `${harnessUrl}${API_ROUTES.market_orderbook_summary.replace('{marketId}', resolvedMarket)}?view=optimistic`;

      const { data, error } = await tryCatch<AxiosResponse<HarnessMarketStateResponse>>(
        axios.get(url)
      );

      if (error) {
        throw error;
      }

      const bids = data.data.data.bids;
      const asks = data.data.data.asks;
      const bestBid = bids.length > 0 ? lotsPriceToNative(bids[0].price_lots, market) : null;
      const bestAsk = asks.length > 0 ? lotsPriceToNative(asks[0].price_lots, market) : null;

      return {
        market_id: resolvedMarket,
        bid_count: bids.length,
        ask_count: asks.length,
        best_bid: bestBid,
        best_ask: bestAsk,
        spread: bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null,
        total_bid_volume: bids
          .reduce((acc, b) => acc + BigInt(lotsBaseToNative(b.base_lots, market)), 0n)
          .toString(),
        total_ask_volume: asks
          .reduce((acc, a) => acc + BigInt(lotsBaseToNative(a.base_lots, market)), 0n)
          .toString(),
      };
    },
    [harnessUrl]
  );

  const fetchOrderbookDepth = useCallback(
    async (
      marketId: string,
      market?: Pick<Market, 'base_decimals' | 'quote_decimals' | 'base_lot_size' | 'quote_lot_size'>
    ): Promise<OrderbookDepth> => {
      const resolvedMarket = marketIdOrDefault(marketId);
      const url = `${harnessUrl}${API_ROUTES.market_orderbook_depth.replace('{marketId}', resolvedMarket)}?view=optimistic`;

      const { data, error } = await tryCatch<AxiosResponse<HarnessMarketStateResponse>>(
        axios.get(url)
      );

      if (error) {
        throw error;
      }

      const bids = data.data.data.bids.map(
        b =>
          [
            String(lotsPriceToNative(b.price_lots, market)),
            String(lotsBaseToNative(b.base_lots, market)),
          ] as [string, string]
      );
      const asks = data.data.data.asks.map(
        a =>
          [
            String(lotsPriceToNative(a.price_lots, market)),
            String(lotsBaseToNative(a.base_lots, market)),
          ] as [string, string]
      );

      return {
        lastUpdateId: Date.now(),
        bids,
        asks,
      };
    },
    [harnessUrl]
  );

  const fetchUserOrders = useCallback(
    async (
      pubkey: string,
      marketId?: string,
      market?: Pick<
        Market,
        | 'name'
        | 'base_mint'
        | 'quote_mint'
        | 'base_decimals'
        | 'quote_decimals'
        | 'base_lot_size'
        | 'quote_lot_size'
      >
    ): Promise<Order[]> => {
      const resolvedMarket = marketIdOrDefault(marketId);
      const url = `${harnessUrl}${API_ROUTES.user_orders.replace('{marketId}', resolvedMarket)}?owner=${encodeURIComponent(pubkey)}&view=optimistic`;

      const { data, error } = await tryCatch<AxiosResponse<HarnessOrdersResponse>>(axios.get(url));

      if (error) {
        throw error;
      }

      return (data.data.data || []).map(order => ({
        order_id: order.order_id,
        market_id: order.market,
        market_name: market?.name || `Market ${order.market}`,
        owner: order.owner,
        side: order.side === 'bid' ? 'Buy' : 'Sell',
        price: lotsPriceToNative(order.price_lots, market),
        quantity: lotsBaseToNative(order.base_lots, market),
        expiry: 0,
        timestamp: Number(order.sequence),
        base_mint: market?.base_mint || '',
        quote_mint: market?.quote_mint || '',
      }));
    },
    [harnessUrl]
  );

  const fetchTrades = useCallback(
    async (
      owner: string,
      marketId: string,
      limit: number = 100,
      market?: Pick<
        Market,
        | 'base_mint'
        | 'quote_mint'
        | 'base_decimals'
        | 'quote_decimals'
        | 'base_lot_size'
        | 'quote_lot_size'
      >
    ): Promise<Trade[]> => {
      const resolvedMarket = marketIdOrDefault(marketId);
      const url = `${harnessUrl}${API_ROUTES.market_trades.replace('{marketId}', resolvedMarket)}?view=optimistic&limit=${encodeURIComponent(limit)}`;
      const { data, error } = await tryCatch<AxiosResponse<HarnessTradesResponse>>(axios.get(url));

      if (error) {
        throw error;
      }

      return (data.data.data || [])
        .filter(trade => trade.maker_owner === owner || trade.taker_owner === owner)
        .map(trade => ({
          id: trade.trade_id,
          buyer_owner: trade.taker_side === 'bid' ? trade.taker_owner : trade.maker_owner,
          seller_owner: trade.taker_side === 'ask' ? trade.taker_owner : trade.maker_owner,
          price: lotsPriceToNative(trade.price_lots, market),
          quantity: lotsBaseToNative(trade.base_lots, market),
          timestamp: Math.floor(trade.ts_ms / 1000),
          base_mint: market?.base_mint || '',
          quote_mint: market?.quote_mint || '',
        }));
    },
    [harnessUrl]
  );

  const fetchUserBalances = useCallback(
    async (pubkey: string): Promise<UserBalancesResponse> => {
      const url = `${harnessUrl}${API_ROUTES.user_balances.replace('{pubkey}', pubkey)}?view=optimistic`;
      const { data, error } = await tryCatch<AxiosResponse<HarnessBalancesResponse>>(
        axios.get(url)
      );

      if (error) {
        throw error;
      }

      const payload = data.data.data;
      const balances: UserBalancesResponse = {};
      const addBalance = (mint: string, availableDelta: bigint, reservedDelta: bigint) => {
        const current = balances[mint] || { available: '0', reserved: '0' };
        const available = BigInt(current.available || '0') + availableDelta;
        const reserved = BigInt(current.reserved || '0') + reservedDelta;
        balances[mint] = {
          available: available.toString(),
          reserved: reserved.toString(),
        };
      };

      // New harness shape: optimistic collateral snapshot carries token balances by mint.
      if (payload.optimistic_collateral?.tokens?.length) {
        const usdcMint = payload.optimistic_collateral.usdc_mint || '';
        for (const token of payload.optimistic_collateral.tokens) {
          const decimals =
            token.mint === usdcMint
              ? 6
              : token.mint === quoteMint.toBase58()
                ? Math.max(0, config.devnet.quoteDecimals || 6)
                : token.mint === baseMint.toBase58()
                  ? Math.max(0, config.devnet.baseDecimals || 9)
                  : 9;
          const availableNative = BigInt(uiToNativeString(token.ui_balance, decimals));
          addBalance(token.mint, availableNative, 0n);
          // Preserve compatibility with frontend configs that still use a placeholder quote mint.
          if (token.mint === usdcMint && usdcMint && usdcMint !== quoteMint.toBase58()) {
            addBalance(quoteMint.toBase58(), availableNative, 0n);
          }
        }
      }

      const quoteReservedNative = BigInt(
        lotsQuoteToNative(payload.totals.total_quote_reserved_lots || '0')
      );
      const quoteMintFromHarness = payload.optimistic_collateral?.usdc_mint || quoteMint.toBase58();
      addBalance(quoteMintFromHarness, 0n, quoteReservedNative);
      if (quoteMintFromHarness !== quoteMint.toBase58()) {
        addBalance(quoteMint.toBase58(), 0n, quoteReservedNative);
      }

      return balances;
    },
    [harnessUrl]
  );

  const requestAirdrop = useCallback(
    async (owner: string, uiAmount?: number) => {
      const payload: Record<string, unknown> = { owner };
      if (uiAmount !== undefined) {
        payload.ui_amount = uiAmount;
      }
      const response = await axios.post(`${harnessUrl}${API_ROUTES.airdrop}`, payload);
      return response.data;
    },
    [harnessUrl]
  );

  const requestAirdropDeposit = useCallback(
    async (owner: string, mangoAccount?: string) => {
      const payload: Record<string, unknown> = { owner };
      if (mangoAccount) {
        payload.mango_account = mangoAccount;
      }
      const response = await axios.post(`${harnessUrl}${API_ROUTES.airdrop_deposit}`, payload);
      return response.data;
    },
    [harnessUrl]
  );

  return {
    ping,
    fetchOrderbook,
    fetchOrderbookDepth,
    fetchUserOrders,
    submitCancelOrderToSequencer,
    fetchTrades,
    fetchUserBalances,
    requestAirdrop,
    requestAirdropDeposit,
  };
}
