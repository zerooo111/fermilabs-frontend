/**
 * useMarketTokenBalances.ts
 * Custom hook to fetch token balances for the selected market's base and quote tokens
 */
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { fetchTokenBalance } from '@/shared/lib/solana/helpers';
import { useSelectedMarket } from '@/entities/market';
import { useCallback } from 'react';
import { BN } from '@coral-xyz/anchor';

export function useMarketTokenBalances() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { selectedMarket } = useSelectedMarket();

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected || !connection || !selectedMarket) {
      return { baseBalance: '0', quoteBalance: '0' };
    }

    try {
      // Convert string mints to PublicKey objects
      const baseMintPubkey = new PublicKey(selectedMarket.base_mint);
      const quoteMintPubkey = new PublicKey(selectedMarket.quote_mint);

      // Fetch balances in parallel
      const [baseBalanceStr, quoteBalanceStr] = await Promise.all([
        fetchTokenBalance(publicKey, baseMintPubkey, connection),
        fetchTokenBalance(publicKey, quoteMintPubkey, connection),
      ]);

      // Convert to human-readable format using the market's decimals
      const baseBalance = new BN(baseBalanceStr)
        .div(new BN(10).pow(new BN(selectedMarket.base_decimals)))
        .toString();
      const quoteBalance = new BN(quoteBalanceStr)
        .div(new BN(10).pow(new BN(selectedMarket.quote_decimals)))
        .toString();

      return { baseBalance, quoteBalance };
    } catch {
      // Silent error handling
      return { baseBalance: '0', quoteBalance: '0' };
    }
  }, [publicKey, connected, connection, selectedMarket]);

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
    balances: data || { baseBalance: '0', quoteBalance: '0' },
    isLoading,
    error,
    refetch,
  };
}
