/**
 * Wallet entity model
 * Exports hooks and utilities for wallet interaction
 */
import { usePrivy } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { privyWalletAdapter } from './PrivyWalletAdapter';
import { privyAppId } from './privyConfig';

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

/**
 * Opens Privy's login modal (email, Google, X, or an external Solana wallet).
 * If a Privy session already exists but its wallet isn't connected (e.g. a
 * locked extension after reload), reconnects instead of re-logging in.
 */
const usePrivyWalletLogin = () => {
  const { ready, authenticated, login, connectWallet } = usePrivy();
  const { connect } = useWallet();

  const openLogin = useCallback(() => {
    if (!ready) return;
    if (!authenticated) {
      login();
    } else if (privyWalletAdapter.canConnect) {
      connect().catch(err => console.error('Wallet connect failed:', err));
    } else {
      connectWallet();
    }
  }, [ready, authenticated, login, connectWallet, connect]);

  return { openLogin, ready };
};

/**
 * Details about the wallet behind the Privy adapter: its real name (e.g.
 * "Phantom") and whether it is a Privy embedded wallet that can be exported.
 */
const usePrivyActiveWalletInfo = () => {
  const { connected, publicKey } = useWallet();
  const { exportWallet } = useExportWallet();
  const signer = connected ? privyWalletAdapter.signer : null;

  const exportActiveWallet = useCallback(async () => {
    if (!publicKey) return;
    await exportWallet({ address: publicKey.toBase58() });
  }, [exportWallet, publicKey]);

  return {
    walletName: signer?.walletName ?? null,
    isEmbedded: signer?.isEmbedded ?? false,
    exportWallet: exportActiveWallet,
  };
};

// Without a Privy app ID, PrivyProvider isn't mounted (it throws on an invalid
// ID), so Privy hooks can't run. The app stays usable view-only; login reports
// the misconfiguration. privyAppId is a build-time constant, so the chosen hook
// never changes between renders.
const useDisabledWalletLogin = () => {
  const openLogin = useCallback(() => {
    toast.error('Login is not configured (missing VITE_PRIVY_APP_ID).');
  }, []);
  return { openLogin, ready: true };
};

const useDisabledActiveWalletInfo = () => ({
  walletName: null,
  isEmbedded: false,
  exportWallet: async () => {},
});

export const useWalletLogin = privyAppId ? usePrivyWalletLogin : useDisabledWalletLogin;
export const useActiveWalletInfo = privyAppId
  ? usePrivyActiveWalletInfo
  : useDisabledActiveWalletInfo;

export const WalletModel = {
  useWallet,
  useWalletWithErrorHandling,
  useWalletLogin,
  useActiveWalletInfo,
};
