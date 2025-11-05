import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { useAtomValue } from 'jotai';
import { MyOrders } from './MyOrders';
import { MyTrades } from './MyTrades';
import { MyAssets } from './MyAssets';
import { MyPositions } from './MyPositions';
import { AccountCard } from '@/shared/ui/account-card';
import { selectedMarketAtom } from '@/entities/market/model';

export function PortfolioTabs() {
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const isPerpsMode = selectedMarket?.kind === 'perp';

  return (
    <div className="flex flex-col md:flex-row flex-1 h-full mx-2 md:mx-4 border-x border-outline divide-y md:divide-y-0 md:divide-x divide-outline overflow-hidden">
      {/* Left side - Portfolio Tabs */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Tabs defaultValue="orders" className="h-full flex flex-col">
          <TabsList className="w-full justify-start border-b border-outline rounded-none bg-transparent overflow-x-auto flex-shrink-0">
            <TabsTrigger value="orders">My Orders</TabsTrigger>
            {!isPerpsMode && <TabsTrigger value="trades">My Trades</TabsTrigger>}
            {isPerpsMode && <TabsTrigger value="positions">My Positions</TabsTrigger>}
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-hidden">
            <TabsContent value="orders" className="mt-0 h-full overflow-auto">
              <MyOrders />
            </TabsContent>
            {!isPerpsMode && (
              <TabsContent value="trades" className="mt-0 h-full overflow-auto">
                <MyTrades />
              </TabsContent>
            )}
            {isPerpsMode && (
              <TabsContent value="positions" className="mt-0 h-full overflow-auto">
                <MyPositions />
              </TabsContent>
            )}
            <TabsContent value="assets" className="mt-0 h-full overflow-auto">
              <MyAssets />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Right side - Account Card */}
      <div className="w-full md:w-80 flex-shrink-0 overflow-hidden">
        <AccountCard />
      </div>
    </div>
  );
}
