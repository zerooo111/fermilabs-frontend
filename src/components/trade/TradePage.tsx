import { useSetAtom } from 'jotai';
import MyOrders from './MyOrders';
import Orderbook from './Orderbook';
import TradePanel from './TradePanel';
import { fetchOrderbook } from '@/lib/sequencer';
import orderbookAtom from '@/atoms/orderbook';
import { useQuery } from '@tanstack/react-query';
import { baseMint, quoteMint } from '@/solana/constants';
import ChartContainer from './chart/ChartContainer';

interface OrderbookItem {
  base_mint: string;
  quote_mint: string;
  [key: string]: any;
}

export default function TradePage() {
  const setOrderbook = useSetAtom(orderbookAtom);

  useQuery({
    queryKey: ['orderbook'],
    queryFn: async () => {
      const orderbook = await fetchOrderbook();
      const baseMintString = baseMint.toBase58();
      const quoteMintString = quoteMint.toBase58();
      setOrderbook({
        buys: orderbook.buys.filter(
          (it: OrderbookItem) =>
            it.base_mint === baseMintString && it.quote_mint === quoteMintString
        ),
        sells: orderbook.sells.filter(
          (it: OrderbookItem) =>
            it.base_mint === baseMintString && it.quote_mint === quoteMintString
        ),
        lastUpdated: new Date(),
      });
      return orderbook;
    },
    refetchInterval: 500000000,
  });

  return (
    <div className="flex flex-col gap-1.5 px-3 min-h-[calc(100vh-60px)]">
      <div className="flex gap-1.5 rounded-lg">
        <div className="flex-1 border border-border rounded-lg">
          <ChartContainer />
        </div>
        <Orderbook />
        <TradePanel />
      </div>
      <div className="flex-1 border border-border rounded-lg p-3">{/* <MyOrders /> */}</div>
    </div>
  );
}
