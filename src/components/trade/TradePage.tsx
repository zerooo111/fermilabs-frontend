import { useSetAtom } from 'jotai';
import MyOrders from './MyOrders';
import Orderbook from './Orderbook';
import TradePanel from './TradePanel';
import { fetchOrderbook } from '@/lib/sequencer';
import orderbookAtom from '@/atoms/orderbook';
import { useQuery } from '@tanstack/react-query';

export default function TradePage() {
  const setOrderbook = useSetAtom(orderbookAtom);

  useQuery({
    queryKey: ['orderbook'],
    queryFn: async () => {
      const orderbook = await fetchOrderbook();
      setOrderbook({
        buys: orderbook.buys,
        sells: orderbook.sells,
        lastUpdated: new Date(),
      });
      return orderbook;
    },
    refetchInterval: 500,
  });

  return (
    <div className="flex flex-col gap-1.5 px-3 min-h-[calc(100vh-60px)]">
      <div className="flex gap-1.5 rounded-lg">
        {/* Chart */}
        <div className="flex-1 border border-border rounded-lg flex items-center justify-center">
          Chart
        </div>
        <Orderbook />
        <TradePanel />
      </div>
      <div className="flex-1 border border-border rounded-lg p-3">
        <MyOrders />
      </div>
    </div>
  );
}
