/**
 * The connected wallet's SOL, for the fee nudges that have to render before
 * anything is signed (shared/lib/solana/gas.ts). Same shape as the one-click
 * session balance: one getBalance, cached for a minute, refetched when a form
 * that depends on it opens.
 */
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { config } from '@/shared/config/constants';
import { solFromLamports } from '@/shared/lib/solana/gas';

export function useSolBalance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const query = useQuery({
    queryKey: ['sol-balance', publicKey?.toBase58()],
    queryFn: () => connection.getBalance(publicKey!, config.devnet.commitment),
    enabled: !!publicKey,
    staleTime: 60_000,
  });

  return {
    /** null until it's known; a failed read never blocks an action. */
    lamports: query.data ?? null,
    sol: query.data === undefined ? null : solFromLamports(query.data),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
