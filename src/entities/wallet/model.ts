/**
 * Wallet entity model
 * Exports hooks and utilities for wallet interaction
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback } from 'react';
import { toast } from 'sonner';

export { useWallet } from '@solana/wallet-adapter-react';

/**
 * Hook that provides wallet functionality with error handling
 */
export const useWalletWithErrorHandling = () => {
  const wallet = useWallet();

  const connectWithErrorHandling = useCallback(async () => {
    if (wallet.wallet && !wallet.connected) {
      try {
        await wallet.connect();
      } catch {
        toast.error('Failed to connect wallet');
      }
    }
  }, [wallet]);

  const disconnectWithErrorHandling = useCallback(async () => {
    if (wallet.connected) {
      try {
        await wallet.disconnect();
      } catch {
        toast.error('Failed to disconnect wallet');
      }
    }
  }, [wallet]);

  return {
    ...wallet,
    connectWithErrorHandling,
    disconnectWithErrorHandling,
  };
};

export const WalletModel = {
  useWallet,
  useWalletWithErrorHandling,
};
