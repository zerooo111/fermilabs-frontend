import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { config } from '../config/constants';
import { tryCatch } from '../lib/try-catch';

export interface Position {
  average_entry_price: number;
  base_position: number;
  cumulative_funding: string;
  last_fill_price: number;
  mark_price: number;
  market_id: string;
  market_name: string;
  realized_pnl: string;
  total_pnl: string;
  unrealized_pnl: string;
}

export interface PNLResponse {
  margin_metrics: {
    available_withdrawal: string;
    equity: string;
    free_collateral: string;
    funding_accrued: string;
    initial_margin: string;
    maintenance_margin: string;
    realized_pnl: string;
    reserved_margin: string;
    unrealized_pnl: string;
  };
  owner: string;
  positions: Position[];
  total_pnl: string;
  total_realized_pnl: string;
  total_unrealized_pnl: string;
}

export function usePNL(userPubKey: string) {
  return useQuery({
    queryKey: ['pnl', userPubKey],
    queryFn: async (): Promise<PNLResponse> => {
      const apiBaseUrl = config.devnet.apiBaseUrl;
      const url = `${apiBaseUrl}/me/users/${userPubKey}/pnl`;

      const { data, error } = await tryCatch<
        import('axios').AxiosResponse<{
          code: number;
          data: PNLResponse;
          message: string;
        }>
      >(axios.get(url));

      if (error) {
        throw error;
      }

      return data.data.data;
    },
    enabled: !!userPubKey,
    refetchInterval: 5000, // 5 seconds
    refetchIntervalInBackground: false,
  });
}
