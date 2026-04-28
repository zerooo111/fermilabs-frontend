import { useQuery } from '@tanstack/react-query';
import {
  warmSimulate,
  runSimulate,
  type SimulateRequest,
  type SimulateResponse,
} from './simulateApi';
import axios from 'axios';

interface UseSimulateParams {
  owner: string | null;
  marketIndex: number | null;
  side: 'buy' | 'sell';
  quantity: number;
  price: number | null;
  orderType: 'limit' | 'market';
  enabled: boolean;
}

// Re-warm ~3 s before the 15 s server TTL expires
const WARM_STALE_MS = 12_000;

export function useSimulate({
  owner,
  marketIndex,
  side,
  quantity,
  price,
  orderType,
  enabled,
}: UseSimulateParams) {
  const isMarket = orderType === 'market';

  // Warm the simulation cache proactively. TanStack Query deduplicates this
  // across both buy and sell useSimulate calls so only one request fires.
  const warmQuery = useQuery({
    queryKey: ['simulate-warm', owner],
    queryFn: () => warmSimulate(owner!),
    enabled: !!owner && enabled,
    staleTime: WARM_STALE_MS,
    gcTime: WARM_STALE_MS + 5_000,
    retry: false,
  });

  const canRun =
    warmQuery.isSuccess &&
    enabled &&
    !!owner &&
    marketIndex !== null &&
    quantity > 0 &&
    (isMarket || (price !== null && price > 0));

  return useQuery<SimulateResponse>({
    queryKey: ['simulate', owner, marketIndex, side, quantity, price, orderType],
    queryFn: async () => {
      const req: SimulateRequest = {
        owner: owner!,
        trade: {
          market_index: marketIndex!,
          side,
          quantity,
          order_type: isMarket ? 'market' : 'limit',
          ...(!isMarket && price !== null ? { price } : {}),
        },
      };

      try {
        return await runSimulate(req);
      } catch (err) {
        // Fallback: re-warm and retry once if the cache expired between intervals
        if (axios.isAxiosError(err) && err.response?.status === 425) {
          await warmSimulate(owner!);
          return await runSimulate(req);
        }
        throw err;
      }
    },
    enabled: canRun,
    staleTime: 2_000,
    placeholderData: prev => prev,
    retry: false,
  });
}
