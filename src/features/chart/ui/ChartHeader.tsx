import { memo, useMemo } from 'react';
import { MarketSelector } from '@/features/market-selector';
import { cn } from '@/lib/utils';
import { useSelectedMarket } from '@/entities/market';
import { formatPrice, formatQuantity } from '@/features/orderbook-view/lib/processOrderbook';
import { useMarketStats } from '@/shared/hooks/useMarketStats';
import { useVolume24h } from '@/shared/hooks/useVolume24h';
import { quoteLotsToUi } from '@/shared/lib/mango-sdk-conversions';

interface LatestPrice {
  price: number;
  isPositive: boolean;
  change: number;
  percentChange: string;
}

interface ChartHeaderProps {
  selectedMarketId?: string | null;
  onMarketSelect: (marketId: string) => void;
  latestPrice?: LatestPrice | null;
}

function ChartHeaderComponent({ selectedMarketId, onMarketSelect, latestPrice }: ChartHeaderProps) {
  const { selectedMarket } = useSelectedMarket();
  const { data: volumeData } = useVolume24h(selectedMarketId ?? undefined);

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
          marketKind="perp"
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
          {(() => {
            const pct = latestPrice?.percentChange ?? '0.0';
            const isZero = !latestPrice || latestPrice.change === 0 || pct === '0.0';
            const sign = isZero ? '' : latestPrice?.isPositive ? '+' : '-';
            return (
              <span
                className={cn(
                  'font-mono font-semibold text-base',
                  isZero ? 'text-white' : latestPrice?.isPositive ? 'text-success' : 'text-danger'
                )}
              >
                {sign}
                {pct}%
              </span>
            );
          })()}
        </div>

        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs whitespace-nowrap font-medium text-white/50">Funding Rate</span>
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

        {/* Open Interest */}
        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs whitespace-nowrap font-medium text-white/50">Open Interest</span>
          <span className="font-mono font-semibold text-base text-white">
            {marketStats?.open_interest
              ? formatQuantity(marketStats.open_interest, selectedMarket.baseDecimals)
              : '0'}
          </span>
        </div>

        {/* 24h Volume */}
        <div className="flex flex-col justify-center px-2 h-full ">
          <span className="text-xs whitespace-nowrap font-medium text-white/50">24h Volume</span>
          <span className="font-mono font-semibold text-base text-white">
            {volumeData?.total_volume_quote_lots
              ? `$${quoteLotsToUi(volumeData.total_volume_quote_lots, {
                  quoteDecimals: selectedMarket.quoteDecimals,
                  quoteLotSize: selectedMarket.quote_lot_size,
                }).toLocaleString('en-US', {
                  notation: 'compact',
                  maximumFractionDigits: 2,
                })}`
              : '$0'}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ChartHeader = memo(ChartHeaderComponent);
