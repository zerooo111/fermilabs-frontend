import { useAtomValue } from 'jotai';
import { userPositionsAtom } from '@/shared/api/sse-atoms';

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
  stop_loss_price?: string;
  take_profit_price?: string;
  base_decimals?: number;
  quote_decimals?: number;
  base_mint?: string;
  quote_mint?: string;
}

interface UsePositionsParams {
  owner?: string;
  marketId?: string;
  enabled?: boolean;
}

export function usePositions(params: UsePositionsParams = {}) {
  const { marketId, enabled = true } = params;
  const allPositions = useAtomValue(userPositionsAtom);

  if (!enabled) {
    return { data: [] as Position[], isLoading: false, isError: false, error: null };
  }

  const data = marketId ? allPositions.filter(p => p.market_id === marketId) : allPositions;

  return { data, isLoading: false, isError: false, error: null };
}

export function useUserPositions(userPubKey: string) {
  return usePositions({ owner: userPubKey });
}

export function useMarketPositions(marketId: string) {
  return usePositions({ marketId });
}
