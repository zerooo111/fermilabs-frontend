import { memo } from 'react';
import { PerpsTimeframe, PerpsPriceSource } from '@/features/chart/lib/perps-chart';
import { PerpsChartType } from '@/features/chart/ui/PerpsChart';
import { cn } from '@/lib/utils';
import { CandlestickChart, LineChart, AreaChart, BarChart3, Loader2 } from 'lucide-react';

const PRICE_SOURCES: { label: string; value: PerpsPriceSource; title: string }[] = [
  { label: 'LTP', value: 'ltp', title: 'Last traded price (from on-venue trades)' },
  { label: 'Mark', value: 'mark', title: 'Mark price (Pyth index)' },
];

const INTERVALS: { label: string; value: PerpsTimeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const CHART_TYPES: { value: PerpsChartType; icon: typeof CandlestickChart; label: string }[] = [
  { value: 'candlestick', icon: CandlestickChart, label: 'Candlestick' },
  { value: 'bar', icon: BarChart3, label: 'Bar' },
  { value: 'line', icon: LineChart, label: 'Line' },
  { value: 'area', icon: AreaChart, label: 'Area' },
];

interface ChartToolbarProps {
  timeInterval: PerpsTimeframe;
  onIntervalChange: (interval: PerpsTimeframe) => void;
  chartType?: PerpsChartType;
  onChartTypeChange?: (chartType: PerpsChartType) => void;
  showChartType?: boolean;
  isRefreshing?: boolean;
  priceSource?: PerpsPriceSource;
  onPriceSourceChange?: (source: PerpsPriceSource) => void;
}

function ChartToolbarComponent({
  timeInterval,
  onIntervalChange,
  chartType,
  onChartTypeChange,
  showChartType = true,
  isRefreshing,
  priceSource,
  onPriceSourceChange,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center h-8 px-2 gap-1 border-b border-line-subtle bg-surface-raised">
      {/* Time intervals */}
      <div className="flex items-center gap-0.5">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onIntervalChange(value)}
            aria-pressed={timeInterval === value}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-focus',
              timeInterval === value
                ? 'text-fg-primary bg-state-selected font-medium'
                : 'text-fg-tertiary hover:text-fg-secondary hover:bg-state-hover'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {showChartType && onChartTypeChange && (
        <>
          <div className="w-px h-4 bg-line-subtle mx-1" />

          {/* Chart type icons */}
          <div className="flex items-center gap-0.5">
            {CHART_TYPES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => onChartTypeChange(value)}
                aria-pressed={chartType === value}
                className={cn(
                  'p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-focus',
                  chartType === value
                    ? 'text-fg-primary bg-state-selected'
                    : 'text-fg-tertiary hover:text-fg-secondary hover:bg-state-hover'
                )}
                title={label}
                aria-label={label}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </>
      )}

      {priceSource && onPriceSourceChange && (
        <>
          <div className="w-px h-4 bg-line-subtle mx-1" />

          {/* Price source: LTP vs Mark */}
          <div className="flex items-center gap-0.5">
            {PRICE_SOURCES.map(({ label, value, title }) => (
              <button
                key={value}
                onClick={() => onPriceSourceChange(value)}
                aria-pressed={priceSource === value}
                title={title}
                aria-label={title}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-focus',
                  priceSource === value
                    ? 'text-fg-primary bg-state-selected font-medium'
                    : 'text-fg-tertiary hover:text-fg-secondary hover:bg-state-hover'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {isRefreshing && (
        <div
          className="ml-auto flex items-center gap-1.5 text-[10px] text-fg-tertiary"
          aria-live="polite"
        >
          <Loader2 className="size-3 animate-spin" />
          <span>Refreshing</span>
        </div>
      )}
    </div>
  );
}

export const ChartToolbar = memo(ChartToolbarComponent);
