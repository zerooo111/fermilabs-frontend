import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_ROUTES, config } from '@/shared/config/constants';

interface Volume24hResponse {
  total_volume_quote_lots: string;
}

export function useVolume24h(market?: string) {
  return useQuery({
    queryKey: ['volume24h', market],
    queryFn: async () => {
      const params = market ? { market } : undefined;
      const { data } = await axios.get<Volume24hResponse>(
        `${config.devnet.gatewayUrl}${API_ROUTES.volume_24h}`,
        { params }
      );
      return data;
    },
    refetchInterval: 10_000,
  });
}
