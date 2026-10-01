/**
 * Wallet entity model
 * Exports hooks and utilities for wallet interaction
 */
import { usePrivy, type LinkedAccountWithMetadata } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useMemo } from 'react';
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

export type LoginMethod = 'email' | 'google' | 'twitter' | 'wallet';

/** Who is behind the connected wallet, as far as Privy knows. */
export interface AccountIdentity {
  method: LoginMethod;
  /** Email address, @handle, or the external wallet's name (e.g. "Phantom"). */
  label: string;
  /** Display name for social logins, when it adds something to the label. */
  name: string | null;
  avatarUrl: string | null;
  /** Logo of the wallet doing the signing (external wallets only). */
  walletIcon: string | null;
  isEmbedded: boolean;
}

const verifiedAt = (account: LinkedAccountWithMetadata) =>
  new Date(account.latestVerifiedAt ?? account.firstVerifiedAt ?? 0).getTime();

const usePrivyAccountIdentity = (): AccountIdentity | null => {
  const { user } = usePrivy();
  const { connected, publicKey } = useWallet();

  return useMemo(() => {
    if (!user || !connected || !publicKey) return null;
    const signer = privyWalletAdapter.signer;
    const isEmbedded = signer?.isEmbedded ?? false;
    const walletIcon = isEmbedded ? null : (signer?.walletIcon ?? null);

    // The most recently verified account is the one the user just logged in
    // with. External wallets count too, so a Phantom login with a linked email
    // still reads as "Phantom".
    const [latest] = user.linkedAccounts
      .filter(
        a =>
          a.type === 'email' ||
          a.type === 'google_oauth' ||
          a.type === 'twitter_oauth' ||
          (a.type === 'wallet' && a.walletClientType !== 'privy')
      )
      .sort((a, b) => verifiedAt(b) - verifiedAt(a));

    const base = { isEmbedded, walletIcon, name: null, avatarUrl: null };
    switch (latest?.type) {
      case 'email':
        return { ...base, method: 'email', label: latest.address };
      case 'google_oauth':
        return { ...base, method: 'google', label: latest.email, name: latest.name };
      case 'twitter_oauth':
        return {
          ...base,
          method: 'twitter',
          label: latest.username ? `@${latest.username}` : (latest.name ?? 'X account'),
          name: latest.username ? latest.name : null,
          // Twitter serves 48px "_normal" avatars by default.
          avatarUrl: latest.profilePictureUrl?.replace('_normal.', '_200x200.') ?? null,
        };
      default:
        return { ...base, method: 'wallet', label: signer?.walletName ?? 'Wallet' };
    }
  }, [user, connected, publicKey]);
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

const useDisabledAccountIdentity = (): AccountIdentity | null => null;

export const useAccountIdentity = privyAppId ? usePrivyAccountIdentity : useDisabledAccountIdentity;
export const useWalletLogin = privyAppId ? usePrivyWalletLogin : useDisabledWalletLogin;
export const useActiveWalletInfo = privyAppId
  ? usePrivyActiveWalletInfo
  : useDisabledActiveWalletInfo;

export const WalletModel = {
  useWallet,
  useWalletWithErrorHandling,
  useWalletLogin,
  useActiveWalletInfo,
  useAccountIdentity,
};
