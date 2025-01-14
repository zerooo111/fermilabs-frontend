/**
 * App.tsx
 * Main application component with wallet context integration
 */

import { ConnectWallet } from './components/ConnectWallet';
import { WalletDetails } from './components/WalletDetails';
import { useAtom, useAtomValue } from 'jotai';
import { marketAddressAtom } from './atoms/market';

import { ToastProvider } from './components/ToastProvider';
import { ErrorPage } from './components/ErrorPage';
import { isValidSolanaAddress } from './utils/market';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { fermiClientAtom } from './atoms/fermiClient';
import { useEffect } from 'react';
import { FermiClient } from './solana/fermiClient';
import { AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';
import { marketAccountAtom } from './atoms/market';

function App() {
  const [client, setClient] = useAtom(fermiClientAtom);
  const [marketAccount, setMarketAccount] = useAtom(marketAccountAtom);
  const marketAddress = useAtomValue(marketAddressAtom);
  const wallet = useAnchorWallet();

  /* Initialise client */
  useEffect(() => {
    if (wallet) {
      const connection = new Connection(clusterApiUrl('devnet'));
      const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
      setClient(new FermiClient(provider, new PublicKey(marketAddress)));
    } else {
      setClient(null);
    }

    return () => {
      setClient(null);
    };
  }, [wallet]);

  /* Initialise market */
  useEffect(() => {
    if (client) {
      (async () => {
        const marketAccount = await client.deserializeMarketAccount(new PublicKey(marketAddress));
        setMarketAccount(marketAccount);
      })();
    } else {
      setMarketAccount(null);
    }

    return () => {
      setMarketAccount(null);
    };
  }, [client, marketAddress]);

  if (!isValidSolanaAddress(marketAddress)) {
    return (
      <ErrorPage
        title="Invalid Market"
        message="The specified market address is not valid. Please check the URL and try again."
        actionText="Go to Default Market"
        onAction={() => {
          window.location.href = window.location.pathname;
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <nav className="flex justify-between items-center mb-8">
        <WalletDetails />
        <ConnectWallet />
      </nav>
      {client && <div>Client loaded</div>}
      {marketAccount && <div>Market account loaded</div>}
      <main>
        <h1 className="text-3xl font-bold">Fermi Labs DEX</h1>
        <div className="mt-4 text-gray-400">
          Market: <span className="font-mono">{marketAddress}</span>
        </div>
        {client && marketAccount && (
          <div className="mt-8">
            <OrderbookDisplay />
          </div>
        )}
      </main>
      <ToastProvider />
    </div>
  );
}

export default App;
