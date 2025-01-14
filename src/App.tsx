/**
 * App.tsx
 * Main application component with wallet context integration
 */

import { useAtom, useAtomValue } from 'jotai';
import { marketAddressAtom } from './atoms/market';
import { ErrorPage } from './components/ErrorPage';
import { isValidSolanaAddress } from './utils/market';
import { fermiClientAtom } from './atoms/fermiClient';
import { useEffect } from 'react';
import { FermiClient } from './solana/fermiClient';
import { AnchorProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { clusterApiUrl } from '@solana/web3.js';
import { marketAccountAtom } from './atoms/market';
import TradePanel from './components/TradePanel';
import EmptyWallet from './solana/utils/emptyWallet';
import Orderbook from './components/Orderbook';

function App() {
  const [client, setClient] = useAtom(fermiClientAtom);
  const [marketAccount, setMarketAccount] = useAtom(marketAccountAtom);
  const marketAddress = useAtomValue(marketAddressAtom);

  /* Initialise client */
  useEffect(() => {
    const connection = new Connection(clusterApiUrl('devnet'));
    const provider = new AnchorProvider(
      connection,
      new EmptyWallet(new Keypair()),
      AnchorProvider.defaultOptions()
    );
    setClient(new FermiClient(provider, new PublicKey(marketAddress)));

    return () => {
      setClient(null);
    };
  }, []);

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
  }, [client, marketAddress, setMarketAccount]);

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

  if (!client || !marketAddress || !marketAccount) {
    return 'Something is missing bro';
  }

  return (
    <div className="min-h-screen p-4 flex flex-col gap-4 items-center justify-center">
      <TradePanel client={client} marketAccount={marketAccount} marketAddress={marketAddress} />
      <Orderbook />
    </div>
  );
}

export default App;
