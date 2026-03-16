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

export function WalletContextProvider({ children }: WalletContextProviderProps) {
  const endpoint = useMemo(() => {
    const configured = config.devnet.rpcUrl;
    if (/^https?:\/\//i.test(configured)) {
      return configured;
    }
    if (typeof window !== 'undefined') {
      const path = configured.startsWith('/') ? configured : `/${configured}`;
      return `${window.location.origin}${path}`;
    }
    return 'http://127.0.0.1:8899';
  }, []);

  const wsEndpoint = useMemo(() => {
    const configured = config.devnet.wsUrl;
    if (/^wss?:\/\//i.test(configured)) {
      return configured;
    }
    if (typeof window !== 'undefined') {
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const path = configured.startsWith('/') ? configured : `/${configured}`;
      return `${scheme}//${window.location.host}${path}`;
    }
    return 'ws://127.0.0.1:8900';
  }, []);

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
          toast.error(error?.message || 'Wallet connection failed');
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
