import { useQuery } from '@tanstack/react-query';
import axios, { AxiosResponse } from 'axios';
import { config, API_ROUTES } from '../config/constants';
import { tryCatch } from '../lib/try-catch';

export interface Position {
  owner: string;
  market_id: string;
  market_name: string;
  base_position: string;
  average_entry_price: string;
  mark_price: string;
  realized_pnl: string;
  unrealized_pnl: string;
  cumulative_funding: string;
  // Market metadata (if available from backend)
  base_decimals?: number;
  quote_decimals?: number;
  base_mint?: string;
  quote_mint?: string;
}

interface UsePositionsParams {
  owner?: string;
  marketId?: string;
}

/**
 * Hook to fetch positions from the /positions endpoint
 * @param params - Query parameters for filtering positions
 * @param params.owner - Base58-encoded pubkey to filter by account owner (optional)
 * @param params.marketId - UUID to filter by specific market (optional)
 */
export function usePositions(params: UsePositionsParams = {}) {
  const { owner, marketId } = params;

  return useQuery({
    queryKey: ['positions', owner, marketId],
    queryFn: async (): Promise<Position[]> => {
      const apiBaseUrl = config.devnet.apiBaseUrl;

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (owner) queryParams.append('owner', owner);
      if (marketId) queryParams.append('market_id', marketId);

      const queryString = queryParams.toString();
      const url = `${apiBaseUrl}${API_ROUTES.positions}${queryString ? `?${queryString}` : ''}`;

      const { data, error } = await tryCatch<AxiosResponse<Position[]>>(axios.get(url));

      if (error) {
        throw error;
      }

      return data.data || [];
    },
    enabled: !!owner || !!marketId, // Only fetch if at least one parameter is provided
    refetchInterval: 1000, // 5 seconds
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to fetch positions for a specific user
 * @param userPubKey - Base58-encoded user public key
 */
export function useUserPositions(userPubKey: string) {
  return usePositions({ owner: userPubKey });
}

/**
 * Hook to fetch positions for a specific market
 * @param marketId - Market UUID
 */
export function useMarketPositions(marketId: string) {
  return usePositions({ marketId });
}
