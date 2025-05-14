import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { MyOrders } from './MyOrders';
import { MyTrades } from './MyTrades';

export function OrdersAndTradesTab() {
  return (
    <Tabs defaultValue="orders" className="w-full space-y-1">
      <TabsList className="grid ring ring-zinc-500/50 grid-cols-2 w-fit">
        <TabsTrigger className="w-fit" value="orders">
          My Orders
        </TabsTrigger>
        <TabsTrigger className="w-fit" value="trades">
          My Trades
        </TabsTrigger>
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
