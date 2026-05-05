import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  warmSimulate,
  runSimulate,
  type SimulateRequest,
  type SimulateResponse,
} from './simulateApi';
import axios from 'axios';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface UseSimulateParams {
  owner: string | null;
  marketIndex: number | null;
  side: 'buy' | 'sell';
  quantity: number;
  price: number | null;
  orderType: 'limit' | 'market';
  enabled: boolean;
  /** Milliseconds to debounce quantity/price changes before firing. Default 500. */
  debounceMs?: number;
}

export function useSimulate({
  owner,
  marketIndex,
  side,
  quantity,
  price,
  orderType,
  enabled,
  debounceMs = 500,
}: UseSimulateParams) {
  const debouncedQuantity = useDebounce(quantity, debounceMs);
  const debouncedPrice = useDebounce(price, debounceMs);

  const isMarket = orderType === 'market';
  const canRun =
    enabled &&
    !!owner &&
    marketIndex !== null &&
    debouncedQuantity > 0 &&
    (isMarket || (debouncedPrice !== null && debouncedPrice > 0));

  return useQuery<SimulateResponse>({
    queryKey: ['simulate', owner, marketIndex, side, debouncedQuantity, debouncedPrice, orderType],
    queryFn: async () => {
      const req: SimulateRequest = {
        owner: owner!,
        trade: {
          market_index: marketIndex!,
          side,
          quantity: debouncedQuantity,
          order_type: isMarket ? 'market' : 'limit',
          ...(!isMarket && debouncedPrice !== null ? { price: debouncedPrice } : {}),
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
