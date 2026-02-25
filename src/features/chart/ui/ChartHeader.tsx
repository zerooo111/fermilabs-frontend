import { memo, useMemo } from 'react';
import { MarketSelector } from '@/features/market-selector';
import { TimeInterval } from '@/features/chart/lib/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/lib/utils';
import { useSelectedMarket } from '@/entities/market';
import { formatPrice, formatQuantity } from '@/features/orderbook-view/lib/processOrderbook';
import { useMarketStats } from '@/shared/hooks/useMarketStats';

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
  const { selectedMarket } = useSelectedMarket();

  // Fetch market stats using react-query
  const { data: marketsData } = useMarketStats({
    refetchInterval: 1000,
    enabled: !!selectedMarketId,
  });

  // Calculate market stats from the fetched market data
  const marketStats = useMemo(() => {
    if (!selectedMarketId || !marketsData) return null;

    // Find the current market in the fetched data by selectedMarketId
    const currentMarketData = marketsData.find(m => m.uuid === selectedMarketId);
    if (!currentMarketData) return null;

    // Extract stats from perp_state for perp markets
    if (currentMarketData.kind === 'perp' && currentMarketData.perp_state) {
      const perpState = currentMarketData.perp_state;

      // Mark price: keep as raw value (formatPrice will handle the decimal conversion)
      const markPriceRaw = perpState.mark_price ?? 0;

      // Funding rate: convert from bps to percentage
      // Try funding_rate_bps first, fallback to last_funding_rate_bps
      const fundingRateBps = perpState.funding_rate_bps ?? perpState.last_funding_rate_bps ?? 0;
      const fundingRate = fundingRateBps / 10000;

      // Open interest: keep as raw value (formatQuantity will handle the decimal conversion)
      const openInterestRaw = currentMarketData.open_interest ?? 0;

      return {
        mark_price: markPriceRaw,
        funding_rate: fundingRate,
        open_interest: openInterestRaw,
      };
    }

    return null;
  }, [selectedMarketId, marketsData]);

  if (!selectedMarket) return null;

  return (
    <div className="flex h-12  items-center divide-x divide-outline justify-between border-b border-outline">
      <div>
        <MarketSelector
          isLoading={false}
          selectedMarketId={selectedMarketId ?? null}
          onMarketSelect={onMarketSelect}
          marketKind={marketKind}
        />
      </div>
      <div className="flex items-center overflow-x-auto flex-1 h-full divide-x divide-outline">
        {/* Mark Price */}
        <div className="flex flex-col justify-center px-2 h-full border-r ">
          <span className="text-xs whitespace-nowrap font-medium text-white/50">Mark Price</span>
          <span className="font-mono font-semibold text-base text-white">
            {marketStats?.mark_price
              ? formatPrice(marketStats.mark_price, selectedMarket.quoteDecimals)
              : '0.0000'}
          </span>
        </div>

        {/* 24 h change */}
        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs whitespace-nowrap font-medium text-white/50">24h Change</span>
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
            <span className="text-xs whitespace-nowrap font-medium text-white/50">
              Funding Rate
            </span>
            <span
              className={cn(
                'font-mono font-semibold text-base',
                marketStats?.funding_rate && marketStats.funding_rate > 0
                  ? 'text-danger'
                  : 'text-white'
              )}
            >
              {marketStats?.funding_rate !== undefined
                ? `${marketStats.funding_rate.toFixed(4)}%`
                : '0.0000%'}
            </span>
          </div>
        )}

        {/* Open Interest */}
        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs whitespace-nowrap font-medium text-white/50">Open Interest</span>
          <span className="font-mono font-semibold text-base text-white">
            {marketStats?.open_interest
              ? formatQuantity(marketStats.open_interest, selectedMarket.baseDecimals)
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
