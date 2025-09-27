import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { config } from '../config/constants';
import { tryCatch } from '../lib/try-catch';

export function useMarketStats(marketId: string) {
  return useQuery({
    queryKey: ['marketStats', marketId],
    queryFn: async () => {
      const apiBaseUrl = config.devnet.apiBaseUrl;
      const url = `${apiBaseUrl}/me/markets/${marketId}/stats`;

      const { data, error } = await tryCatch<
        import('axios').AxiosResponse<{
          code: number;
          data: {
            base_mint: string;
            funding_rate: number;
            mark_price: number;
            market_id: string;
            market_name: string;
            market_type: string;
            open_interest: number;
            quote_mint: string;
          };
          message: string;
        }>
      >(axios.get(url));

      if (error) {
        throw error;
      }

      return data.data.data;
    },
    enabled: !!marketId,
    refetchInterval: 1000, // 1 second
    refetchIntervalInBackground: false,
  });
}
