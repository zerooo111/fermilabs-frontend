import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAccountAtom } from '@/atoms/market';
import { PublicKey } from '@solana/web3.js';
import { EventHeapAccount } from '@/solana/fermiClient';

/**
 * Custom hook for fetching event heap data
 * Only fetches when both client and market account are available
 * @returns Query object containing event heap data, loading state, and error state
 */
export function useEventHeap() {
  const client = useAtomValue(fermiClientAtom);
  const marketAccount = useAtomValue(marketAccountAtom);

  return useQuery({
    queryKey: ['eventHeap', marketAccount?.eventHeap.toString()],
    queryFn: async (): Promise<EventHeapAccount | null> => {
      if (!client || !marketAccount) return null;
      return client.deserializeEventHeapAccount(new PublicKey(marketAccount.eventHeap));
    },
    enabled: !!client && !!marketAccount,
    refetchInterval: 1000, // Refetch every second for more real-time event updates
  });
}
