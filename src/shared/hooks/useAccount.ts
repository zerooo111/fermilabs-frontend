import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { config, API_ROUTES } from '../config/constants';
import { tryCatch } from '../lib/try-catch';
import { Position } from './usePositions';

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
  unrealized_pnl_snapshot: number;
  funding_accrued_snapshot: number;
  initial_margin_snapshot: number;
  maintenance_margin_snapshot: number;
  free_collateral_snapshot: number;
  available_withdrawal_snapshot: number;
  per_market_delta_snapshot: any[];
  covariance_snapshot: any[];
  portfolio_leverage_limit_snapshot: number;
}

/**
 * Hook to fetch full margin account details from the /accounts/:owner endpoint
 * @param owner - Base58-encoded user public key
 */
export function useAccount(owner: string) {
  return useQuery({
    queryKey: ['account', owner],
    queryFn: async (): Promise<MarginAccount> => {
      const apiBaseUrl = config.devnet.apiBaseUrl;
      const url = `${apiBaseUrl}${API_ROUTES.user_accounts.replace('{pubkey}', owner)}`;

      const { data, error } = await tryCatch<axios.AxiosResponse<MarginAccount>>(axios.get(url));

      if (error) {
        throw error;
      }

      return data.data;
    },
    enabled: !!owner,
    refetchInterval: 5000, // 5 seconds
    refetchIntervalInBackground: false,
  });
}
