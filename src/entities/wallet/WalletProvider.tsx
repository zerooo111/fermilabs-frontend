/**
 * WalletProvider.tsx
 * Provides Solana wallet connection functionality throughout the application
 * Configures supported wallets and connection settings
 */

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { config } from '@/shared/config/constants';
import { toast } from 'sonner';
import { IntentSolflareWalletAdapter } from './IntentSolflareWalletAdapter';
import { IntentPhantomWalletAdapter } from './IntentPhantomWalletAdapter';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletContextProviderProps {
  children: React.ReactNode;
}

// Many wallet-adapter errors (e.g. WalletNotReadyError) carry an empty `.message`,
// so falling back on the error class name keeps the toast useful.
const WALLET_ERROR_MESSAGES: Record<string, string> = {
  WalletNotReadyError: 'Wallet not detected. Install or unlock the wallet extension and try again.',
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

  const autoConnect =
    String(import.meta.env.VITE_WALLET_AUTOCONNECT || 'false').toLowerCase() === 'true';

  // Initialize supported wallet adapters
  const wallets = useMemo(
    () => [new IntentPhantomWalletAdapter(), new IntentSolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={{ wsEndpoint }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={autoConnect}
        onError={error => {
          console.error('Wallet adapter error:', error);
          const message = formatWalletError(error);
          if (message) toast.error(message);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
