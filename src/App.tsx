/**
 * App.tsx
 * Main application component with wallet context integration
 */

import React, { useEffect } from 'react';
import TradePanel from './components/TradePanel';
import Orderbook from './components/Orderbook';
import OpenOrdersTable from './components/OpenOrdersTable';
import { useAtom } from 'jotai';
import { fermiClientAtom } from './atoms/fermiClient';
import { marketAccountAtom, marketAddressAtom } from './atoms/market';
import { isValidSolanaAddress } from './utils/market';
import { PublicKey } from '@solana/web3.js';
import { clusterApiUrl, Keypair } from '@solana/web3.js';
import { FermiClient } from './solana/fermiClient';
import { Connection } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import EmptyWallet from './solana/utils/emptyWallet';
import { ErrorPage } from './components/ErrorPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/Tabs';

const App = () => {
  const [client, setClient] = useAtom(fermiClientAtom);
  const [marketAccount, setMarketAccount] = useAtom(marketAccountAtom);
  const [marketAddress] = useAtom(marketAddressAtom);

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
  }, [marketAddress, setClient]);

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
    <div className="min-h-screen bg-zinc-50 p-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {client && marketAccount && marketAddress && (
            <>
              <TradePanel
                client={client}
                marketAddress={marketAddress}
                marketAccount={marketAccount}
              />
              <Orderbook />
            </>
          )}
        </div>

        {/* Open Orders Section */}
        <div className="mt-8">
          <Tabs defaultValue="open-orders">
            <TabsList>
              <TabsTrigger value="open-orders">Open Orders</TabsTrigger>
              <TabsTrigger value="settle-funds">Settle Funds</TabsTrigger>
            </TabsList>
            <TabsContent value="open-orders">
              <OpenOrdersTable />
            </TabsContent>
            <TabsContent value="settle-funds">
              <OpenOrdersTable />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default App;
