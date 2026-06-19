/**
 * useSequencerApi.tsx
 * Harness-backed API adapter for dashboard reads.
 */
import { useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { tryCatch } from '@/shared/lib/try-catch';
import { config, quoteMint, baseMint, API_ROUTES, API_ROUTES_V2 } from '../config/constants';
import { lotsQuoteToNative } from '@/shared/lib/harness-market';
import { mapV2AccountBalances, type V2AccountEvent } from './v2-adapter';

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
  /**
   * The viewing wallet's own side ("buy"/"sell") for this trade, when known.
   * Set only for per-wallet ("my trades") rows, where the server resolves it
   * from the wallet's full identity set. Prefer this over comparing owners to
   * the wallet pubkey — trades are keyed by mango-account address, so the
   * pubkey comparison never matches and would mislabel every row.
   */
  wallet_side?: 'buy' | 'sell';
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

  const fetchUserBalances = useCallback(
    async (pubkey: string): Promise<UserBalancesResponse> => {
      // v2 path: /v2/snapshot/account/:owner carries `tokens` + `totals`
      // under the Redis mirror. Mapper produces the same
      // { [mint]: { available, reserved } } shape consumers expect.
      if (config.devnet.useV2ReadLayer) {
        const v2Url = `${harnessUrl}${API_ROUTES_V2.snapshot_account.replace('{owner}', pubkey)}`;
        const { data: v2Data, error: v2Err } = await tryCatch<AxiosResponse<V2AccountEvent>>(
          axios.get(v2Url)
        );
        if (v2Err) throw v2Err;
        return mapV2AccountBalances(v2Data.data, {
          baseMint: baseMint.toBase58(),
          baseDecimals: config.devnet.baseDecimals ?? 9,
          quoteMint: quoteMint.toBase58(),
          quoteDecimals: config.devnet.quoteDecimals ?? 6,
        });
      }
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
    fetchUserBalances,
    requestAirdrop,
    requestAirdropDeposit,
  };
}
