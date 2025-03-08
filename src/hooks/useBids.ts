import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAccountAtom } from '@/atoms/market';
import { PublicKey } from '@solana/web3.js';
import { BookSideAccount } from '@/solana/fermiClient';
import { parseBookSideAccount } from '@/solana/parsers';

/**
 * Custom hook for fetching bids from the orderbook
 * Only fetches when both client and market account are available
 * @returns Query object containing bids data, loading state, and error state
 */
export function useBids() {
  const client = useAtomValue(fermiClientAtom);
  const marketAccount = useAtomValue(marketAccountAtom);

  return useQuery({
    queryKey: ['bids', marketAccount?.bids.toString()],
    queryFn: async () => {
      if (!client || !marketAccount) return null;
      const bookSideAccount = await client.deserializeBookSide(new PublicKey(marketAccount.bids));
      if (!bookSideAccount) throw new Error('Book side account not found');
      return parseBookSideAccount(client, bookSideAccount as BookSideAccount);
    },
    enabled: !!client && !!marketAccount,
    refetchInterval: 10000 * 10000, // Refetch every 10 seconds
  });
}
