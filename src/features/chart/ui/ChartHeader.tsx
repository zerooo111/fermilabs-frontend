import { memo, useMemo } from 'react';
import { MarketSelector } from '@/features/market-selector';
import { cn } from '@/lib/utils';
import { useSelectedMarket } from '@/entities/market';
import { useAtomValue } from 'jotai';
import { marketMetricsAtom } from '@/shared/api/sse-atoms';
import { useVolume24h } from '@/shared/hooks/useVolume24h';
import { quoteLotsToUi } from '@/shared/lib/mango-sdk-conversions';

function formatUiNumber(value: number): string {
  if (!value || value === 0) return '0.00';
  const abs = Math.abs(value);
  if (abs < 0.0001) return value.toFixed(8);
  if (abs < 0.01) return value.toFixed(6);
  if (abs < 1) return value.toFixed(4);
  if (abs < 100) return value.toFixed(2);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

  // Read market stats directly from the SSE metrics atom — scoped to the
  // current market, already UI-normalised. Avoids the marketsAtom array scan.
  const liveMetrics = useAtomValue(marketMetricsAtom);
  const marketStats = useMemo(() => {
    if (!selectedMarketId || !liveMetrics || liveMetrics.market !== selectedMarketId) return null;
    return {
      mark_price_ui: liveMetrics.mark_price_ui,
      // funding_rate_hourly_pct * 100 was stored as bps, then divided by 10000 in legacy path.
      // Net result: funding_rate_hourly_pct / 100.
      funding_rate: liveMetrics.funding_rate_hourly_pct / 100,
      open_interest_ui: liveMetrics.open_interest_base_ui,
    };
  }, [selectedMarketId, liveMetrics]);

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
            {marketStats?.mark_price_ui ? formatUiNumber(marketStats.mark_price_ui) : '0.0000'}
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
            {marketStats?.open_interest_ui ? formatUiNumber(marketStats.open_interest_ui) : '0'}
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
