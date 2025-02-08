import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAccountAtom } from '@/atoms/market';
import { PublicKey } from '@solana/web3.js';
import { parseEventHeap } from '@/solana/parsers';

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
    queryFn: async () => {
      if (!client || !marketAccount) return null;
      const eventHeap = await client.deserializeEventHeapAccount(
        new PublicKey(marketAccount.eventHeap)
      );
      if (!eventHeap) throw new Error('Failed to deserialize event heap account');
      const parsed = parseEventHeap(client, eventHeap);
      return parsed;
    },
    enabled: !!client && !!marketAccount,
    refetchInterval: 1000 * 10000, // Refetch every second for more real-time event updates
  });
}
