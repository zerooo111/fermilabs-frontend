import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAccountAtom, marketAddressAtom } from '@/atoms/market';

/**
 * Custom hook for fetching open orders account data
 * Only fetches when client, market account and wallet are available
 * @returns Query object containing open orders data, loading state, and error state
 */
export function useOpenOrdersAccount() {
  const client = useAtomValue(fermiClientAtom);
  const marketAddress = useAtomValue(marketAddressAtom);
  const marketAccount = useAtomValue(marketAccountAtom);
  const wallet = useAnchorWallet();

  return useQuery({
    queryKey: [
      'openOrdersAccount',
      { marketAddress, walletAddress: wallet?.publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!client || !marketAccount || !wallet?.publicKey) return null;

      const openOrdersAccounts = await client.findOpenOrdersForMarket(
        wallet.publicKey,
        new PublicKey(marketAddress)
      );

      if (!openOrdersAccounts.length) return null;

      const accountData = await client.deserializeOpenOrderAccount(openOrdersAccounts[0]);
      if (!accountData) throw new Error('Failed to deserialize open orders account');

      return accountData;
    },
    enabled: !!client && !!marketAccount && !!wallet?.publicKey,
    refetchInterval: 100000, // Refetch every 10 seconds
  });
}
