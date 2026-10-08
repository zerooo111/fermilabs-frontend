/**
 * Chart toolbar
 * One quiet row: timeframes as plain text (one click, always visible), then
 * chart type and price source as two small dropdowns, since those are
 * set-and-forget. No boxed button groups so the row doesn't compete with the
 * chart for attention.
 */
import { memo } from 'react';
import { PerpsTimeframe, PerpsPriceSource } from '@/features/chart/lib/perps-chart';
import { PerpsChartType } from '@/features/chart/ui/PerpsChart';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  CandlestickChart,
  LineChart,
  AreaChart,
  BarChart3,
  ChevronDown,
  Loader2,
} from 'lucide-react';

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
  { value: 'candlestick', icon: CandlestickChart, label: 'Candles' },
  { value: 'bar', icon: BarChart3, label: 'Bars' },
  { value: 'line', icon: LineChart, label: 'Line' },
  { value: 'area', icon: AreaChart, label: 'Area' },
];

const TRIGGER =
  'inline-flex h-6 items-center gap-1 px-1.5 text-[11px] text-rock/60 transition-colors hover:text-rock outline-none data-[state=open]:text-rock [&_svg]:shrink-0';

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
  const currentType = CHART_TYPES.find(t => t.value === chartType) ?? CHART_TYPES[0];
  const TypeIcon = currentType.icon;
  const currentSource = PRICE_SOURCES.find(s => s.value === priceSource) ?? PRICE_SOURCES[0];

  return (
    <div className="flex h-8 items-center border-b border-outline px-1">
      {/* Timeframes: plain text, mono so widths line up; the active one is lit. */}
      <TabStrip
        id="chart-timeframe"
        role="radiogroup"
        aria-label="Timeframe"
        active={timeInterval}
        className="flex items-center"
      >
        {INTERVALS.map(({ label, value }) => (
          <TabStripItem
            key={value}
            value={value}
            role="radio"
            onSelect={v => onIntervalChange(v as PerpsTimeframe)}
            className="h-6 min-w-7 justify-center px-1.5 font-mono text-[11px] tabular-nums tracking-normal"
            activeClassName="inset-0 h-auto -z-10 bg-rock/10"
          >
            {label}
          </TabStripItem>
        ))}
      </TabStrip>

      <span className="mx-1.5 h-3.5 w-px bg-outline" aria-hidden />

      {showChartType && chartType && onChartTypeChange && (
        <DropdownMenu>
          <DropdownMenuTrigger className={TRIGGER} aria-label="Chart type" title="Chart type">
            <TypeIcon className="size-3.5" />
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-32">
            <DropdownMenuRadioGroup
              value={chartType}
              onValueChange={v => onChartTypeChange(v as PerpsChartType)}
            >
              {CHART_TYPES.map(({ value, icon: Icon, label }) => (
                <DropdownMenuRadioItem key={value} value={value} className="text-xs">
                  <Icon className="size-3.5" />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {priceSource && onPriceSourceChange && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={TRIGGER}
            aria-label="Price source"
            title={currentSource.title}
          >
            {currentSource.label}
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-40">
            <DropdownMenuRadioGroup
              value={priceSource}
              onValueChange={v => onPriceSourceChange(v as PerpsPriceSource)}
            >
              {PRICE_SOURCES.map(({ value, label, title }) => (
                <DropdownMenuRadioItem key={value} value={value} className="text-xs" title={title}>
                  {label}
                  <span className="ml-auto pl-3 text-[10px] text-rock/45">
                    {value === 'ltp' ? 'trades' : 'oracle'}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
