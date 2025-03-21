import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import CandlestickChart from './CandlestickChart';
import { fetchCandles, getTimeRangeForInterval, TimeInterval } from '@/lib/chart';
import { baseMint, quoteMint } from '@/solana/constants';
import { BN } from '@coral-xyz/anchor';

export default function ChartContainer() {
  const [timeInterval] = useState<TimeInterval>('1m');

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

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-gray-300">Loading chart data...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <CandlestickChart className="flex-1" data={data || []} />
    </div>
  );
}
