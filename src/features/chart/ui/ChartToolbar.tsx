import { memo } from 'react';
import { PerpsTimeframe, PerpsPriceSource } from '@/features/chart/lib/perps-chart';
import { PerpsChartType } from '@/features/chart/ui/PerpsChart';
import { Segmented } from '@/shared/ui/segmented';
import { CandlestickChart, LineChart, AreaChart, BarChart3, Loader2 } from 'lucide-react';

const PRICE_SOURCES: { label: string; value: PerpsPriceSource; title: string }[] = [
  { label: 'Last', value: 'ltp', title: 'Last traded price, from trades on Fermi' },
  { label: 'Mark', value: 'mark', title: 'Mark price, from the Pyth index' },
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
    <div className="flex h-9 items-center gap-3 border-b border-outline bg-card px-2">
      <Segmented
        aria-label="Timeframe"
        mono
        value={timeInterval}
        onChange={onIntervalChange}
        options={INTERVALS}
      />

      {showChartType && chartType && onChartTypeChange && (
        <Segmented
          aria-label="Chart type"
          value={chartType}
          onChange={onChartTypeChange}
          options={CHART_TYPES.map(({ value, icon: Icon, label }) => ({
            value,
            title: label,
            label: <Icon className="size-3.5" />,
          }))}
        />
      )}

      {priceSource && onPriceSourceChange && (
        <Segmented
          aria-label="Price source"
          value={priceSource}
          onChange={onPriceSourceChange}
          options={PRICE_SOURCES}
        />
      )}

      {isRefreshing && (
        <div
          className="ml-auto flex items-center gap-1.5 text-[10px] text-rock/40"
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
