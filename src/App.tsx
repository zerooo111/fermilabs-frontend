/**
 * App.tsx
 * Main application component with wallet context integration
 */

import React from 'react';
import TradePanel from './components/TradePanel';
import Orderbook from './components/Orderbook';
import OpenOrdersTable from './components/OpenOrdersTable';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from './atoms/fermiClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/Tabs';
import { useMarket } from '@/hooks/useMarket';
import { ErrorPage } from './components/ErrorPage';

const App = () => {
  const client = useAtomValue(fermiClientAtom);
  const { marketAccount, marketAddress, error, isLoading } = useMarket();

  if (error) {
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

  if (isLoading || !client || !marketAddress || !marketAccount) {
    return <div className="min-h-screen grid place-items-center">Loading market data...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TradePanel client={client} marketAddress={marketAddress} marketAccount={marketAccount} />
          <Orderbook />
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
