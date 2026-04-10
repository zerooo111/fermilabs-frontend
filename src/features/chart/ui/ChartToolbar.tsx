import { memo } from 'react';
import { PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import { PerpsChartType } from '@/features/chart/ui/PerpsChart';
import { cn } from '@/lib/utils';
import { CandlestickChart, LineChart, AreaChart, BarChart3, Loader2 } from 'lucide-react';

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
}

function ChartToolbarComponent({
  timeInterval,
  onIntervalChange,
  chartType,
  onChartTypeChange,
  showChartType = true,
  isRefreshing,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center h-8 px-2 gap-1 border-b border-outline bg-card">
      {/* Time intervals */}
      <div className="flex items-center gap-0.5">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onIntervalChange(value)}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
              timeInterval === value
                ? 'text-white bg-white/15 font-medium'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {showChartType && onChartTypeChange && (
        <>
          <div className="w-px h-4 bg-outline mx-1" />

          {/* Chart type icons */}
          <div className="flex items-center gap-0.5">
            {CHART_TYPES.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => onChartTypeChange(value)}
                className={cn(
                  'p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
                  chartType === value
                    ? 'text-white bg-white/15'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
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

      {isRefreshing && (
        <div
          className="ml-auto flex items-center gap-1.5 text-[10px] text-white/40"
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
