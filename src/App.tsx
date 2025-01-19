/**
 * App.tsx
 * Main application component with wallet context integration
 */
import React from 'react';
import { useMarket } from '@/hooks/useMarket';
import { ErrorPage } from './components/ErrorPage';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from './atoms/fermiClient';
import TradePanel from './components/TradePanel';
import AccountSection from './components/AccountSection';
import Header from './components/Header';

const App = () => {
  const { marketAccount, marketAddress, error, isLoading } = useMarket();
  const client = useAtomValue(fermiClientAtom);

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

  if (isLoading || !marketAddress || !marketAccount || !client) {
    return <div className="min-h-screen grid place-items-center">Loading market data...</div>;
  }

  return (
    <main className="flex flex-col max-w-[2160px] container mx-auto min-h-screen p-4 gap-4">
      <Header />
      <div className="flex gap-2 h-full  flex-1">
        {/* Trading column */}
        <div className="flex flex-col gap-2 basis-3/4">
          <div className="flex h-full gap-2">
            <div className="basis-1/3 card-outer">
              <div className="card-inner">
                <TradePanel marketAddress={marketAddress} marketAccount={marketAccount} />
              </div>
            </div>
            <div className="basis-2/3 card-outer">
              <div className="card-inner">Trading Chart</div>
            </div>
          </div>
          <div className="basis-3/3 card-outer">
            <div className="card-inner">
              <AccountSection />
            </div>
          </div>
        </div>
        {/* Orderbook column */}
        <div className="card-outer basis-1/4">
          <div className="card-inner">Orderbook</div>
        </div>
      </div>
    </main>
  );
};

export default App;
