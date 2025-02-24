/**
 * App.tsx
 * Main application component with wallet context integration
 */
import React from 'react';
import { useMarket } from '@/hooks/useMarket';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from './atoms/fermiClient';
import Header from './components/Header';
import TradePanel from './components/TradePanel';
import AccountSection from './components/AccountSection';
import Orderbook from './components/Orderbook';

const App = () => {
  const { marketAccount, marketAddress, isLoading } = useMarket();
  const client = useAtomValue(fermiClientAtom);

  if (isLoading || !marketAddress || !marketAccount || !client) {
    return <div className="min-h-screen grid place-items-center">Loading market data...</div>;
  }
  return (
    <main className="flex flex-col max-w-[2160px] container mx-auto min-h-screen p-4 gap-4">
      <Header />
      <div className="flex gap-2 h-full flex-1">
        {/* Trading column */}
        <div className="flex flex-col gap-2 basis-3/4">
          <div className="flex h-full gap-2">
            <div className="basis-1/3 card-outer">
              <div className="card-inner">
                <TradePanel />
              </div>
            </div>
            <div className="basis-2/3 card-outer">
              <div className="card-inner h-full"></div>
            </div>
          </div>
          <div className="basis-3/3 card-outer">
            <div className="card-inner">
              <AccountSection />
            </div>
          </div>
        </div>
        {/* Orderbook column */}
        <div className=" basis-1/4">
          <Orderbook />
        </div>
      </div>
    </main>
  );
};

export default App;
