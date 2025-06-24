import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { MyOrders } from './MyOrders';
import { MyTrades } from './MyTrades';

export function OrdersAndTradesTab() {
  return (
    <div className="flex flex-col flex-1 border-x border-outline mx-4 ">
      <Tabs defaultValue="orders" className="divide-y divide-outline">
        <TabsList className="flex-1 w-full justify-start border-b border-outline">
          <TabsTrigger value="orders">My Orders</TabsTrigger>
          <TabsTrigger value="trades">My Trades</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <MyOrders />
        </TabsContent>
        <TabsContent value="trades">
          <MyTrades />
        </TabsContent>
      </Tabs>
    </div>
  );
}
