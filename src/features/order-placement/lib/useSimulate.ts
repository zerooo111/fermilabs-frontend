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
  const canRun =
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
