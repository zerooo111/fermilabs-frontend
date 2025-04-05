/**
 * Token entity model
 * Defines token-related state and operations
 */
import { PublicKey } from '@solana/web3.js';
import { baseMint, quoteMint } from '../../shared/config/constants';
import { fetchTokenBalance } from '../../shared/lib/solana/helpers';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

// Token types
export interface Token {
  publicKey: PublicKey;
  name: string;
  decimals: number;
}

// Default tokens
export const tokens: Token[] = [
  {
    publicKey: baseMint,
    name: 'USDC',
    decimals: 9,
  },
  {
    publicKey: quoteMint,
    name: 'SOL',
    decimals: 9,
  },
];

// Token hooks
export const useTokenBalance = (token: Token) => {
  const { publicKey, connected, connection } = useWallet();

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connected || !connection) return 0;

    try {
      const balance = await fetchTokenBalance(publicKey, token.publicKey, connection);
      return balance / Math.pow(10, token.decimals);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return 0;
    }
  }, [publicKey, connected, connection, token]);

  const useTokenBalanceQuery = () => {
    return useQuery({
      queryKey: ['tokenBalance', token.publicKey.toString(), publicKey?.toString()],
      queryFn: fetchBalance,
      enabled: !!publicKey && connected,
      refetchInterval: 30000, // Refetch every 30 seconds
    });
  };

  return {
    fetchBalance,
    useTokenBalanceQuery,
  };
};

// Export token model
export const TokenModel = {
  tokens,
  useTokenBalance,
};
