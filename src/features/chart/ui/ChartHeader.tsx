import { memo } from 'react';
import { MarketSelector } from '@/features/market-selector';
import { TimeInterval } from '@/features/chart/lib/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useMarketStats } from '@/shared/hooks/useMarketStats';
import { cn } from '@/lib/utils';

const INTERVALS: { label: string; value: TimeInterval }[] = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
];

interface LatestPrice {
  price: number;
  isPositive: boolean;
  change: number;
  percentChange: string;
}

interface ChartHeaderProps {
  selectedMarketId?: string | null;
  onMarketSelect: (marketId: string) => void;
  marketKind: 'spot' | 'perp';
  timeInterval: TimeInterval;
  onIntervalChange: (interval: TimeInterval) => void;
  latestPrice?: LatestPrice | null;
}

function ChartHeaderComponent({
  selectedMarketId,
  onMarketSelect,
  marketKind,
  timeInterval,
  onIntervalChange,
  latestPrice,
}: ChartHeaderProps) {
  const { data: marketStats, isLoading: isStatsLoading } = useMarketStats(selectedMarketId || '');

  return (
    <div className="flex h-12 items-center divide-x divide-outline justify-between border-b border-outline">
      <div>
        <MarketSelector
          isLoading={false}
          selectedMarketId={selectedMarketId ?? null}
          onMarketSelect={onMarketSelect}
          marketKind={marketKind}
        />
      </div>
      <div className="flex items-center flex-1 h-full divide-x divide-outline">
        {/* Mark Price */}
        <div className="flex flex-col justify-center px-2 h-full border-r ">
          <span className="text-xs font-medium text-white/50">Mark Price</span>
          <span className="font-mono font-semibold text-base text-white">
            {isStatsLoading ? '...' : (marketStats?.mark_price?.toFixed(4) ?? '0.0000')}
          </span>
        </div>

        {/* 24 h change */}
        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs font-medium text-white/50">24h Change</span>
          <span
            className={cn(
              'font-mono font-semibold text-base',
              latestPrice?.isPositive ? 'text-success' : 'text-danger'
            )}
          >
            {latestPrice?.isPositive ? '+' : '-'}
            {latestPrice?.percentChange ?? '0.0'}%
          </span>
        </div>

        {/* Funding Rate (for perp markets) */}
        {marketKind === 'perp' && (
          <div className="flex flex-col justify-center px-2 h-full ">
            <span className="text-xs font-medium text-white/50">Funding Rate</span>
            <span
              className={cn(
                'font-mono font-semibold text-base',
                marketStats?.funding_rate && marketStats.funding_rate > 0
                  ? 'text-danger'
                  : 'text-white'
              )}
            >
              {isStatsLoading
                ? '...'
                : marketStats?.funding_rate
                  ? `${marketStats.funding_rate.toFixed(4)}%`
                  : '0.0000%'}
            </span>
          </div>
        )}

        {/* Open Interest */}
        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs font-medium text-white/50">Open Interest</span>
          <span className="font-mono font-semibold text-base text-white">
            {isStatsLoading
              ? '...'
              : marketStats?.open_interest
                ? marketStats.open_interest.toLocaleString()
                : '0'}
          </span>
        </div>
      </div>

      <Select value={timeInterval} onValueChange={onIntervalChange}>
        <SelectTrigger className="w-[80px] !h-full border-none">
          <SelectValue placeholder="Interval" />
        </SelectTrigger>
        <SelectContent align="end">
          {INTERVALS.map(({ label, value }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const ChartHeader = memo(ChartHeaderComponent);
