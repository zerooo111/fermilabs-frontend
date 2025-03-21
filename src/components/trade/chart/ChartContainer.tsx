import { useEffect, useState } from 'react';
import CandlestickChart from './CandlestickChart';
import { fetchCandles, getTimeRangeForInterval, OHLCVData, TimeInterval } from '@/lib/chart';
import { baseMint, quoteMint } from '@/solana/constants';
import { BN } from '@coral-xyz/anchor';

export default function ChartContainer() {
  const [data, setData] = useState<OHLCVData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeInterval] = useState<TimeInterval>('1h');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { startTime, endTime } = getTimeRangeForInterval(timeInterval);
        const candleData = await fetchCandles({
          interval: timeInterval,
          startTime,
          endTime,
          baseMint: baseMint.toBase58(),
          quoteMint: quoteMint.toBase58(),
        });


        setData(candleData.map((item)=>({
          ...item,
          open: new BN(item.open).div(new BN(10**9)).toNumber(),
          high: new BN(item.high).div(new BN(10**9)).toNumber(),
          low: new BN(item.low).div(new BN(10**9)).toNumber(),
          close: new BN(item.close).div(new BN(10**9)).toNumber(),
        })));
      } catch (err) {
        console.error('Error fetching candle data:', err);
        setError('Failed to fetch chart data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeInterval]);

  useEffect(() => {
    console.log(data);
  }, [data]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-red-500">{error}</span>
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
      <CandlestickChart className="flex-1" data={data} />
    </div>
  );
}
