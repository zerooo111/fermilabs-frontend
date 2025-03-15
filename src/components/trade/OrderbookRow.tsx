import { cn } from '@/lib/utils';

type OrderbookRowProps = {
  price: number;
  size: number;
  side: 'Buy' | 'Sell';
};

export default function OrderbookRow({ price, size, side }: OrderbookRowProps) {
  return (
    <div
      className={cn(
        'tabular-nums font-mono grid grid-cols-8 text-xs px-3 py-1',
        side === 'Buy' ? 'text-green-600' : 'text-red-600'
      )}
    >
      <span className="text-left col-span-2">{price.toFixed(4)}</span>
      <span className="text-right col-span-3">{size.toFixed(4)}</span>
      <span className="text-right col-span-3">{(price * size).toFixed(4)}</span>
    </div>
  );
}
