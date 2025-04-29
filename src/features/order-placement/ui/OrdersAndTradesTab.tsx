import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyOrders } from './MyOrders';
import { MyTrades } from './MyTrades';

export function OrdersAndTradesTab() {
  return (
    <Tabs defaultValue="orders" className="w-full space-y-1">
      <TabsList className="grid grid-cols-2">
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
  );
}
