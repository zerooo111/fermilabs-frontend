import { useQuery } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAccountAtom, marketAddressAtom } from '@/atoms/market';
import { openOrdersAccountAddressAtom } from '@/atoms/openOrdersAccount';
import { useEventHeap } from '@/hooks/useEventHeap';

interface OpenOrderItem {
  slNo: string;
  side: 0 | 1;
  price: string;
  id: string;
  finalisable: boolean;
  clientOrderId: string;
}

/**
 * Custom hook for fetching open orders account data
 * Only fetches when client, market account and wallet are available
 * @returns Query object containing open orders data, loading state, and error state
 */
export function useOpenOrdersAccount() {
  const client = useAtomValue(fermiClientAtom);
  const marketAddress = useAtomValue(marketAddressAtom);
  const marketAccount = useAtomValue(marketAccountAtom);
  const [openOrdersAccountAddress, setOpenOrdersAccountAddress] = useAtom(
    openOrdersAccountAddressAtom
  );
  const wallet = useAnchorWallet();
  const { data: eventHeapData } = useEventHeap();

  return useQuery({
    queryKey: [
      'openOrdersAccount',
      { marketAddress, walletAddress: wallet?.publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!client || !marketAccount || !wallet?.publicKey) return null;

      // Find or use existing open orders account
      const address =
        openOrdersAccountAddress ||
        (await client.findOpenOrdersForMarket(wallet.publicKey, new PublicKey(marketAddress)))?.[0];

      // Update stored address
      setOpenOrdersAccountAddress(address || null);
      if (!address) return null;

      // Deserialize the account data
      const accountData = await client.deserializeOpenOrderAccount(address);
      if (!accountData) throw new Error('Failed to deserialize open orders account');

      const openOrders: OpenOrderItem[] = accountData.openOrders
        .filter(o => o.isFree === 0)
        .map(o => {
          const order = {
            slNo: o.clientId.toString(),
            side: o.sideAndTree,
            price: o.lockedPrice.toString(),
            id: o.id.toString(),
            clientOrderId: o.clientId.toString(),
            finalisable: false,
          };

          // Check if order can be finalised
          if (eventHeapData?.fillEvents) {
            const match = eventHeapData.fillEvents.find(
              (event: any) =>
                event.makerClientOrderId.toString() === order.clientOrderId ||
                event.takerClientOrderId.toString() === order.clientOrderId
            );
            order.finalisable = !!match;
          }

          return order;
        });

      return {
        account: accountData,
        publicKey: address,
        openOrders,
      };
    },
    enabled: !!client && !!marketAccount && !!wallet?.publicKey,
    refetchInterval: 1000 * 60 * 60,
  });
}
