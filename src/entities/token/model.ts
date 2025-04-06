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
import * as spl from '@solana/spl-token';

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
    name: 'SOL',
    decimals: 9,
  },
  {
    publicKey: quoteMint,
    name: 'USDC',
    decimals: 6, // USDC uses 6 decimals
  },
];

// Token hooks
export const useTokenBalance = (token: Token) => {
  const { publicKey, connected, connection } = useWallet();

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connected || !connection) return 0;

    try {
      const balance = await fetchTokenBalance(publicKey, token.publicKey, connection);
      console.log(`Raw balance for ${token.name}:`, balance);

      // Convert string to number safely
      const numericBalance = parseFloat(balance);
      console.log(`Numeric balance for ${token.name}:`, numericBalance);

      // Check if we have a valid number
      if (isNaN(numericBalance)) {
        console.warn('Invalid balance value received:', balance);
        return 0;
      }

      // Calculate the decimal balance
      const decimalBalance = numericBalance / Math.pow(10, token.decimals);
      console.log(
        `Decimal balance for ${token.name}:`,
        decimalBalance,
        `(divided by 10^${token.decimals})`
      );

      // Return 0 if the result is NaN or infinite
      if (isNaN(decimalBalance) || !isFinite(decimalBalance)) {
        console.warn(`Invalid decimal balance for ${token.name}:`, decimalBalance);
        return 0;
      }

      return decimalBalance;
    } catch (error) {
      // Only log unexpected errors
      if (!(error instanceof spl.TokenAccountNotFoundError)) {
        console.error('Error fetching token balance:', error);
      }
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
