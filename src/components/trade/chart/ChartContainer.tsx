import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import CandlestickChart from './CandlestickChart';
import { fetchCandles, getTimeRangeForInterval, TimeInterval } from '@/lib/chart';
import { baseMint, quoteMint } from '@/solana/constants';
import { BN } from '@coral-xyz/anchor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const INTERVALS: { label: string; value: TimeInterval }[] = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
];

export default function ChartContainer() {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('1d');

  const { data, isLoading, error } = useQuery({
    queryKey: ['candlesticks', timeInterval, baseMint.toBase58(), quoteMint.toBase58()],
    queryFn: async () => {
      const { startTime, endTime } = getTimeRangeForInterval(timeInterval);
      const candleData = await fetchCandles({
        interval: timeInterval,
        startTime,
        endTime,
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
      });

      return candleData.map(item => ({
        ...item,
        time: item.time,
        open: new BN(item.open).div(new BN(10 ** 9)).toNumber(),
        high: new BN(item.high).div(new BN(10 ** 9)).toNumber(),
        low: new BN(item.low).div(new BN(10 ** 9)).toNumber(),
        close: new BN(item.close).div(new BN(10 ** 9)).toNumber(),
      }));
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-red-500">Failed to fetch chart data</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background ">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-medium text-foreground">SOL / USDC</h2>
          {data && data.length > 0 && (
            <div className="text-sm">
              <span
                className={
                  data[data.length - 1].close > data[data.length - 1].open
                    ? 'text-[#22c55e]'
                    : 'text-[#ef4444]'
                }
              >
                ${data[data.length - 1].close.toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <Select
          value={timeInterval}
          onValueChange={value => setTimeInterval(value as TimeInterval)}
        >
          <SelectTrigger className="w-[80px] h-7">
            <SelectValue placeholder="Interval" />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map(({ label, value }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <span className="text-muted-foreground">Loading chart data...</span>
          </div>
        )}
        <CandlestickChart className="h-full" data={data || []} interval={timeInterval} />
      </div>
    </div>
  );
}
