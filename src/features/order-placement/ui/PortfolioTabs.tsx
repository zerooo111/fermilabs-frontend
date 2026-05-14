import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { useWallet } from '@solana/wallet-adapter-react';
import { MyOrders } from './MyOrders';
import { MyTrades } from './MyTrades';
import { MyAssets } from './MyAssets';
import { MyPositions } from './MyPositions';
import { AccountCard } from '@/shared/ui/account-card';
import { Trades } from '@/features/orderbook-view/ui/Trades';
import { useAtom } from 'jotai';
import { portfolioActiveTabAtom, type PortfolioTab } from '@/entities/market';

export function PortfolioTabs() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useAtom(portfolioActiveTabAtom);

  return (
    <div className="flex flex-col md:flex-row flex-1 h-full mx-2 md:mx-4 border-x border-outline divide-y md:divide-y-0 md:divide-x divide-outline overflow-hidden">
      {/* Left side - Portfolio Tabs or Trades */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {publicKey ? (
          <Tabs
            value={activeTab}
            onValueChange={value => setActiveTab(value as PortfolioTab)}
            className="h-full flex flex-col"
          >
            <TabsList className="w-full justify-start border-b border-outline rounded-none bg-transparent overflow-x-auto flex-shrink-0">
              <TabsTrigger value="orders">My Orders</TabsTrigger>
              <TabsTrigger value="positions">My Positions</TabsTrigger>
              <TabsTrigger value="trades">My Trades</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-hidden">
              <TabsContent value="orders" className="mt-0 h-full overflow-auto">
                <MyOrders />
              </TabsContent>
              <TabsContent value="positions" className="mt-0 h-full overflow-auto">
                <MyPositions />
              </TabsContent>
              <TabsContent value="trades" className="mt-0 h-full overflow-auto">
                <MyTrades />
              </TabsContent>
              <TabsContent value="assets" className="mt-0 h-full overflow-auto">
                <MyAssets />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex flex-col h-full">
            <h3 className="text-base md:text-lg px-3 md:px-4 h-12 leading-12 bg-card border-b border-outline font-medium">
              Trades
            </h3>
            <div className="grid grid-cols-6 px-4 py-2 text-xs bg-card border-b border-outline shrink-0">
              <div className="text-left font-mono">Price</div>
              <div className="text-center font-mono">Size</div>
              <div className="text-center font-mono">Total</div>
              <div className="text-center font-mono">Buyer</div>
              <div className="text-center font-mono">Seller</div>
              <div className="text-right font-mono">Time</div>
            </div>
            <div className="flex-1 min-h-0">
              <Trades rows={20} fullView={true} />
            </div>
          </div>
        )}
      </div>

      {/* Right side - Account Card */}
      <div className="w-full md:w-80 flex-shrink-0 overflow-hidden">
        <AccountCard />
      </div>
    </div>
  );
}
