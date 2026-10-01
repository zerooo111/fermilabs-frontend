/**
 * WalletProvider.tsx
 * Provides Solana wallet connection functionality throughout the application.
 * Privy owns login (email, Google, X, external wallets) and the embedded wallet;
 * the active Privy wallet is exposed through wallet-adapter so `useWallet()` /
 * `useAnchorWallet()` / `useConnection()` consumers work unchanged.
 */

import { PrivyProvider } from '@privy-io/react-auth';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { config } from '@/shared/config/constants';
import { toast } from 'sonner';
import { privyWalletAdapter } from './PrivyWalletAdapter';
import { PrivyBridge } from './PrivyBridge';
import { privyAppId, privyProviderProps } from './privyConfig';

interface WalletContextProviderProps {
  children: React.ReactNode;
}

if (!privyAppId) {
  console.error('VITE_PRIVY_APP_ID is not set — wallet login is disabled.');
}

const wallets = [privyWalletAdapter];

// Many wallet-adapter errors (e.g. WalletNotReadyError) carry an empty `.message`,
// so falling back on the error class name keeps the toast useful.
const WALLET_ERROR_MESSAGES: Record<string, string> = {
  WalletNotReadyError: 'Wallet not ready. Log in and try again.',
  WalletNotConnectedError: 'Wallet not connected.',
  WalletDisconnectedError: 'Wallet disconnected.',
  WalletTimeoutError: 'Wallet operation timed out. Try again.',
  WalletWindowClosedError: 'Wallet window was closed before completing the request.',
  WalletConnectionError: 'Failed to connect wallet.',
};

function formatWalletError(error: unknown): string | null {
  if (!error) return null;
  const { name, message } = error as { name?: string; message?: string };
  // Suppress signing rejections — handled inline at the call site (see usePerps).
  if (name === 'WalletSignMessageError') return null;
  if (message && /reject|denied|cancel/i.test(message)) return null;
  return WALLET_ERROR_MESSAGES[name ?? ''] ?? message ?? name ?? 'Wallet error';
}

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const endpoint = config.devnet.rpcUrl;
  const wsEndpoint = config.devnet.wsUrl;

  const walletTree = (
    <ConnectionProvider endpoint={endpoint} config={{ wsEndpoint }}>
      <WalletProvider
        wallets={wallets}
        // Own key so a stale "Phantom"/"Solflare" selection from the
        // pre-Privy adapter list isn't restored.
        localStorageKey="fermi.walletAdapter"
        onError={error => {
          console.error('Wallet adapter error:', error);
          const message = formatWalletError(error);
          if (message) toast.error(message);
        }}
      >
        {privyAppId && <PrivyBridge adapter={privyWalletAdapter} />}
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );

  if (!privyAppId) return walletTree;
  return <PrivyProvider {...privyProviderProps}>{walletTree}</PrivyProvider>;
}
