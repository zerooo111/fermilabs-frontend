import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { config, API_ROUTES } from '../config/constants';
import { tryCatch } from '../lib/try-catch';
import { Position } from './usePositions';
import { nativeToUiNumber } from '../lib/harness-market';
import { getDecimalsFromMint } from '../lib/token-decimals';

export interface MarginReservation {
  order_id: number;
  initial_margin_delta: number;
  maintenance_margin_delta: number;
}

export interface MarginAccount {
  owner: string;
  usdc_collateral: number;
  positions: Position[];
  reservations: MarginReservation[];
  realized_pnl_total: number;
  equity_snapshot: number;
  realized_pnl_snapshot: number;
  unrealized_pnl: number;
  funding_accrued_snapshot: number;
  initial_margin_snapshot: number;
  maintenance_margin_snapshot: number;
  free_collateral_snapshot: number;
  available_withdrawal_snapshot: number;
  per_market_delta_snapshot: any[];
  portfolio_leverage_limit_snapshot: number;
  margin_usage_fraction: number;
}

interface HarnessFullStateResponse {
  view: 'optimistic' | 'confirmed';
  data: {
    owner: string;
    optimistic_collateral?: {
      usdc_ui_balance?: number;
    };
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
    margin_summary?: {
      totals?: {
        equity_native_quote?: string;
        pnl_native_quote?: string;
        assets_native_quote?: string;
        liabs_native_quote?: string;
        init_health_native_quote?: string;
        maint_health_native_quote?: string;
        margin_usage_fraction?: number;
      };
    };
  };
}

/**
 * Hook to fetch full margin account details from the /accounts/:owner endpoint
 * @param owner - Base58-encoded user public key
 */
export function useAccount(owner: string) {
  return useQuery({
    queryKey: ['account', owner],
    queryFn: async (): Promise<MarginAccount | null> => {
      const url = `${config.devnet.gatewayUrl}${API_ROUTES.user_balances.replace('{pubkey}', owner)}?view=optimistic`;
      const { data, error } = await tryCatch<axios.AxiosResponse<HarnessFullStateResponse>>(
        axios.get(url)
      );

      if (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }

      const user = data.data.data;
      if (!user) return null;
      const quoteMint = user.optimistic_collateral?.usdc_mint || '';
      const quoteDecimals =
        getDecimalsFromMint(quoteMint) ?? Math.max(0, config.devnet.quoteDecimals || 6);
      const collateral = user.optimistic_collateral?.usdc_ui_balance ?? 0;
      const marginTotals = user.margin_summary?.totals;
      const equity = nativeToUiNumber(marginTotals?.equity_native_quote || '0', quoteDecimals);
      const unrealizedTotal = nativeToUiNumber(
        marginTotals?.pnl_native_quote || '0',
        quoteDecimals
      );
      const initHealth = nativeToUiNumber(
        marginTotals?.init_health_native_quote || '0',
        quoteDecimals
      );
      const maintHealth = nativeToUiNumber(
        marginTotals?.maint_health_native_quote || '0',
        quoteDecimals
      );
      const assets = nativeToUiNumber(marginTotals?.assets_native_quote || '0', quoteDecimals);
      const liabs = nativeToUiNumber(marginTotals?.liabs_native_quote || '0', quoteDecimals);
      const equityOrAssets = equity !== 0 ? equity : assets;
      const initialMarginUsed = Math.max(equityOrAssets - initHealth, 0);
      const maintenanceMarginUsed = Math.max(equityOrAssets - maintHealth, 0);
      const freeCollateral = Math.max(initHealth, 0);
      const marginUsageFraction =
        typeof marginTotals?.margin_usage_fraction === 'number'
          ? marginTotals.margin_usage_fraction
          : assets > 0
            ? Math.max(liabs / assets, 0)
            : 0;

      // TODO: Replace remaining placeholders with richer margin/PnL endpoints when available.
      return {
        owner,
        usdc_collateral: collateral,
        positions: [] as Position[],
        reservations: [],
        realized_pnl_total: 0,
        equity_snapshot: equity,
        realized_pnl_snapshot: 0,
        unrealized_pnl: unrealizedTotal,
        funding_accrued_snapshot: 0,
        initial_margin_snapshot: initialMarginUsed,
        maintenance_margin_snapshot: maintenanceMarginUsed,
        free_collateral_snapshot: freeCollateral,
        available_withdrawal_snapshot: freeCollateral,
        per_market_delta_snapshot: [],
        portfolio_leverage_limit_snapshot: 0,
        margin_usage_fraction: marginUsageFraction,
      };
    },
    enabled: !!owner,
    refetchInterval: 1000, // 1 second
    refetchIntervalInBackground: false,
  });
}
