/**
 * The chart toolbar's actions: the indicators menu and grid layout beside the
 * chart controls, then, at the end of the row, the log toggle, jump-to-live,
 * a PNG snapshot, chart settings and fullscreen.
 */
import { memo } from 'react';
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronsRight,
  Columns2,
  Grid2x2,
  LayoutPanelLeft,
  Maximize2,
  Minimize2,
  Rows2,
  Settings,
  Square,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';
import { GRID_PRESETS, type GridPreset } from '@/features/chart/lib/chart-grid';

const GRID_ICONS: Record<GridPreset, LucideIcon> = {
  '1': Square,
  '2h': Columns2,
  '2v': Rows2,
  '1+2': LayoutPanelLeft,
  '2x2': Grid2x2,
};

/**
 * CandleFrame indicator kinds offered in the menu (see builtInIndicators;
 * `volume` is ours, lib/volume-indicator.ts).
 * The order-flow ones (cvd, price-delta, big-trades, flow-signals) need taker
 * buy volume or trades, which our candles don't carry. Volume profile is left
 * out too: a new venue doesn't trade enough for it to mean much.
 */
const INDICATORS: { kind: string; label: string; pane: 'overlay' | 'pane' }[] = [
  { kind: 'sma', label: 'Simple moving average', pane: 'overlay' },
  { kind: 'ema', label: 'Exponential moving average', pane: 'overlay' },
  { kind: 'bb', label: 'Bollinger Bands', pane: 'overlay' },
  { kind: 'volume', label: 'Volume', pane: 'pane' },
  { kind: 'rsi', label: 'Relative strength index', pane: 'pane' },
  { kind: 'macd', label: 'MACD', pane: 'pane' },
  { kind: 'regime', label: 'Market regime', pane: 'pane' },
];

const TRIGGER =
  'inline-flex h-6 items-center gap-1 px-1.5 text-[11px] text-rock/60 transition-colors hover:text-rock outline-none data-[state=open]:text-rock [&_svg]:shrink-0';

interface ChartActionsProps {
  onAddIndicator: (kind: string) => void;
  grid: GridPreset;
  onGridChange: (preset: GridPreset) => void;
  log: boolean;
  onLogChange: (enabled: boolean) => void;
  onFit: () => void;
  onSnapshot: () => void;
  onSettings: () => void;
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
}

function IconToggle({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center px-1 text-[11px] text-rock/50 transition-colors hover:text-rock',
            pressed && 'text-rock'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function ChartActionsComponent({
  onAddIndicator,
  grid,
  onGridChange,
  log,
  onLogChange,
  onFit,
  onSnapshot,
  onSettings,
  fullscreen,
  onFullscreenChange,
}: ChartActionsProps) {
  const GridIcon = GRID_ICONS[grid];
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger className={TRIGGER} aria-label="Add indicator">
          <Activity className="size-3.5" />
          Indicators
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-rock/40">
            On price
          </DropdownMenuLabel>
          {INDICATORS.filter(i => i.pane === 'overlay').map(({ kind, label }) => (
            <DropdownMenuItem key={kind} className="text-xs" onSelect={() => onAddIndicator(kind)}>
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-rock/40">
            Own pane
          </DropdownMenuLabel>
          {INDICATORS.filter(i => i.pane === 'pane').map(({ kind, label }) => (
            <DropdownMenuItem key={kind} className="text-xs" onSelect={() => onAddIndicator(kind)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={TRIGGER} aria-label="Chart layout" title="Chart layout">
          <GridIcon className="size-3.5" />
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuRadioGroup value={grid} onValueChange={v => onGridChange(v as GridPreset)}>
            {(Object.keys(GRID_PRESETS) as GridPreset[]).map(preset => {
              const Icon = GRID_ICONS[preset];
              return (
                <DropdownMenuRadioItem key={preset} value={preset} className="text-xs">
                  <Icon className="size-3.5" />
                  {GRID_PRESETS[preset].label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View controls sit at the end of the row. */}
      <div className="ml-auto flex items-center">
        <IconToggle label="Log scale" pressed={log} onClick={() => onLogChange(!log)}>
          <span className="font-mono">log</span>
        </IconToggle>
        <IconToggle label="Jump to live" onClick={onFit}>
          <ChevronsRight className="size-3.5" />
        </IconToggle>
        <IconToggle label="Save snapshot" onClick={onSnapshot}>
          <Camera className="size-3.5" />
        </IconToggle>
        <IconToggle label="Chart settings" onClick={onSettings}>
          <Settings className="size-3.5" />
        </IconToggle>
        <IconToggle
          label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          pressed={fullscreen}
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </IconToggle>
      </div>
    </div>
  );
}

export const ChartActions = memo(ChartActionsComponent);
