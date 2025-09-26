/**
 * useMarketTokenBalances.ts
 * Custom hook to fetch token balances for the selected market's base and quote tokens
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { useSelectedMarket } from '@/entities/market';
import { useCallback } from 'react';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { getTokenDecimals } from '@/shared/lib/token-decimals';

export function useMarketTokenBalances() {
  const { publicKey, connected } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const { fetchUserBalances } = useSequencerApi();

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected || !selectedMarket) {
      return {
        baseBalance: '0',
        quoteBalance: '0',
        baseMint: '',
        quoteMint: '',
      };
    }

    try {
      const balancesResponse = await fetchUserBalances(publicKey.toString());

      // Find balances by mint address instead of token name
      const balances = balancesResponse.balances;
      const baseTokenBalance = Object.values(balances).find(
        (balance: any) => balance.mint === selectedMarket.base_mint
      ) as any;
      const quoteTokenBalance = Object.values(balances).find(
        (balance: any) => balance.mint === selectedMarket.quote_mint
      ) as any;

      // Convert to human-readable format using dynamic decimals based on token name
      const baseDecimals = getTokenDecimals(selectedMarket?.baseTokenName);
      const quoteDecimals = getTokenDecimals(selectedMarket?.quoteTokenName);

      const baseBalance = baseTokenBalance
        ? (Number(baseTokenBalance.available) / Math.pow(10, baseDecimals)).toString()
        : '0';

      const quoteBalance = quoteTokenBalance
        ? (Number(quoteTokenBalance.available) / Math.pow(10, quoteDecimals)).toString()
        : '0';

      // Get mint addresses (should match the market mints if found)
      const baseMint = baseTokenBalance?.mint || selectedMarket.base_mint || '';
      const quoteMint = quoteTokenBalance?.mint || selectedMarket.quote_mint || '';

      return {
        baseBalance,
        quoteBalance,
        baseMint,
        quoteMint,
      };
    } catch {
      // Silent error handling
      return {
        baseBalance: '0',
        quoteBalance: '0',
        baseMint: '',
        quoteMint: '',
      };
    }
  }, [publicKey, connected, selectedMarket, fetchUserBalances]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'marketTokenBalances',
      publicKey?.toString(),
      selectedMarket?.base_mint,
      selectedMarket?.quote_mint,
    ],
    queryFn: fetchBalances,
    enabled: !!publicKey && connected && !!selectedMarket,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  return {
    balances: data || {
      baseBalance: '0',
      quoteBalance: '0',
      baseMint: '',
      quoteMint: '',
    },
    isLoading,
    error,
    refetch,
  };
}
