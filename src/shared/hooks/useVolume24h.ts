import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { API_ROUTES, API_ROUTES_V2, config } from '@/shared/config/constants';

interface Volume24hResponse {
  total_volume_quote_lots: string;
}

/**
 * v2 `/v2/stats/volume/24h` response:
 *   { total_volume_native_base: "<u128>", per_market: [{market, volume_native_base}], window_ms }
 * Legacy callers consume `total_volume_quote_lots`. We rename so downstream
 * code doesn't change; the underlying value is the cross-market 24h base volume
 * sum from Redis.
 */
interface V2VolumeResponse {
  total_volume_native_base: string;
  per_market: Array<{ market: string; volume_native_base: string }>;
  window_ms: number;
}

export function useVolume24h(market?: string) {
  return useQuery({
    queryKey: ['volume24h', market],
    queryFn: async () => {
      if (config.devnet.useV2ReadLayer) {
        const { data } = await axios.get<V2VolumeResponse>(
          `${config.devnet.gatewayUrl}${API_ROUTES_V2.stats_volume_24h}`
        );
        const total = market
          ? (data.per_market.find(m => m.market === market)?.volume_native_base ?? '0')
          : data.total_volume_native_base;
        return { total_volume_quote_lots: total } satisfies Volume24hResponse;
      }
      const params = market ? { market } : undefined;
      const { data } = await axios.get<Volume24hResponse>(
        `${config.devnet.gatewayUrl}${API_ROUTES.volume_24h}`,
        { params }
      );
      return data;
    },
    refetchInterval: 3_000,
  });
}
