/**
 * Perps chart: our toolbar and drawing rail around a grid of CandleFrame
 * panes (ChartPane). The toolbar and rail act on the active pane; clicking a
 * pane activates it. Panes share crosshair and time through a CandleFrame
 * chart group, and each keeps its own interval, price source, indicators and
 * drawings.
 *
 * Pane 1's interval / source are the container's (persisted there and used by
 * the header); panes 2..4 and the preset are saved by chart-grid.ts.
 */
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createChartGroup, type ChartApi } from 'candleframe/chart';
import type { Candle } from 'candleframe/core';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  GRID_PRESETS,
  loadGrid,
  saveGrid,
  type GridPreset,
  type GridSplit,
  type PaneSelection,
  type SavedGrid,
} from '@/features/chart/lib/chart-grid';
import type { PerpsPriceSource, PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import { ChartToolbar } from './ChartToolbar';
import { ChartActions } from './ChartActions';
import { ChartDrawingRail } from './ChartDrawingRail';
import { ChartGridDividers } from './ChartGridDividers';
import { ChartPane, type CandleFrameMarket, type PaneView } from './ChartPane';
import type { ChartPosition, TriggerKind } from './PositionLines';

export type { CandleFrameMarket } from './ChartPane';

// Keyboard shortcuts 1..6 → timeframe of the active pane
const TIMEFRAME_SHORTCUTS: Record<string, PerpsTimeframe> = {
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1h',
  '5': '4h',
  '6': '1d',
};

const EMPTY_VIEW: PaneView = {
  volume: true,
  log: false,
  canUndo: false,
  canRedo: false,
  hasDrawings: false,
  tool: 'cursor',
};

interface CandleFrameChartProps {
  market: CandleFrameMarket;
  interval: PerpsTimeframe;
  onIntervalChange: (interval: PerpsTimeframe) => void;
  priceSource: PerpsPriceSource;
  onPriceSourceChange: (source: PerpsPriceSource) => void;
  /** Live ticks, UI units. Each pane's feed takes the one matching its source. */
  livePrices: Record<PerpsPriceSource, number | null>;
  /** Pane 1's loaded candles, for the header's 24h change. */
  onCandles?: (candles: readonly Candle[]) => void;
  position: ChartPosition | null;
  /** Sets (price) or removes (null) one leg. Absent = lines are read-only. */
  onTriggerChange?: (kind: TriggerKind, price: number | null) => Promise<boolean>;
  className?: string;
}

function CandleFrameChartComponent({
  market,
  interval,
  onIntervalChange,
  priceSource,
  onPriceSourceChange,
  livePrices,
  onCandles,
  position,
  onTriggerChange,
  className,
}: CandleFrameChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<SavedGrid>(loadGrid);
  const [charts, setCharts] = useState<(ChartApi | null)[]>([]);
  const [views, setViews] = useState<PaneView[]>([]);
  const [fullscreen, setFullscreen] = useState(false);

  const paneCount = GRID_PRESETS[grid.preset].panes;
  const active = Math.min(grid.active, paneCount - 1);
  const multi = paneCount > 1;

  useEffect(() => saveGrid(grid), [grid]);

  // Every pane's selection; pane 1 is the container's.
  const selections: PaneSelection[] = Array.from({ length: paneCount }, (_, i) =>
    i === 0
      ? { interval, source: priceSource }
      : (grid.extra[i - 1] ?? { interval, source: priceSource })
  );
  const activeSelection = selections[active];
  const activeChart = charts[active] ?? null;
  const activeView = views[active] ?? EMPTY_VIEW;

  const handleChart = useCallback((index: number, chart: ChartApi | null) => {
    setCharts(prev => {
      const next = [...prev];
      next[index] = chart;
      return next;
    });
  }, []);
  const handleView = useCallback((index: number, view: PaneView) => {
    setViews(prev => {
      const next = [...prev];
      next[index] = view;
      return next;
    });
  }, []);
  const handleActivate = useCallback((index: number) => {
    setGrid(g => (g.active === index ? g : { ...g, active: index }));
  }, []);

  // ── Linked crosshair and time across panes ───────────────────────────────
  // `charts` only changes when an engine mounts or unmounts.
  useEffect(() => {
    const mounted = charts.slice(0, paneCount).filter((c): c is ChartApi => !!c);
    if (mounted.length < 2) return;
    const group = createChartGroup(mounted, { crosshair: true, time: true });
    return () => group.dispose();
  }, [charts, paneCount]);

  // ── Selection changes for the active pane ────────────────────────────────
  const setSelection = useCallback(
    (index: number, patch: Partial<PaneSelection>) => {
      if (index === 0) {
        if (patch.interval) onIntervalChange(patch.interval);
        if (patch.source) onPriceSourceChange(patch.source);
        return;
      }
      setGrid(g => {
        const extra = [...g.extra];
        const current = extra[index - 1] ?? { interval, source: priceSource };
        extra[index - 1] = { ...current, ...patch };
        return { ...g, extra };
      });
    },
    [onIntervalChange, onPriceSourceChange, interval, priceSource]
  );
  const handleIntervalChange = useCallback(
    (next: PerpsTimeframe) => setSelection(active, { interval: next }),
    [setSelection, active]
  );
  const handleSourceChange = useCallback(
    (next: PerpsPriceSource) => setSelection(active, { source: next }),
    [setSelection, active]
  );

  const handleGridChange = useCallback(
    (preset: GridPreset) => {
      setGrid(g => {
        const panes = GRID_PRESETS[preset].panes;
        // New panes start as a copy of the active one.
        const from = (g.active > 0 ? g.extra[g.active - 1] : undefined) ?? {
          interval,
          source: priceSource,
        };
        const extra = [...g.extra];
        for (let i = 0; i < panes - 1; i++) extra[i] ??= from;
        return { ...g, preset, active: Math.min(g.active, panes - 1), extra };
      });
    },
    [interval, priceSource]
  );

  const handleSplitChange = useCallback((split: GridSplit) => {
    setGrid(g => ({ ...g, split }));
  }, []);

  // ── Keyboard shortcuts: 1..6 switch the active pane's timeframe ─────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      const next = TIMEFRAME_SHORTCUTS[e.key];
      if (next) {
        e.preventDefault();
        handleIntervalChange(next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleIntervalChange]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const handleFullscreen = useCallback((next: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const request = next ? root.requestFullscreen?.() : document.exitFullscreen?.();
    request?.catch(() => toast.error('Fullscreen is not available here'));
  }, []);

  // ── Toolbar / rail actions on the active pane ────────────────────────────
  const run = useCallback(
    (command: Parameters<ChartApi['execute']>[0]) => {
      if (!activeChart) return;
      try {
        activeChart.execute(command);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Chart command failed');
      }
    },
    [activeChart]
  );
  const handleAddIndicator = useCallback(
    (kind: string) => run({ type: 'indicator.add', indicator: { kind } }),
    [run]
  );
  const handleVolume = useCallback(
    (visible: boolean) => run({ type: 'layer.set', layer: 'volume', visible }),
    [run]
  );
  const handleLog = useCallback(
    (enabled: boolean) => run({ type: 'priceScale.log', enabled }),
    [run]
  );
  const handleFit = useCallback(() => {
    run([{ type: 'viewport.reset' }, { type: 'priceScale.reset' }]);
  }, [run]);
  const handleSnapshot = useCallback(() => {
    if (!activeChart) return;
    try {
      const link = document.createElement('a');
      link.href = activeChart.capture();
      link.download = `${market.symbol}-${activeSelection.interval}-${new Date()
        .toISOString()
        .slice(0, 19)}.png`;
      link.click();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Snapshot failed');
    }
  }, [activeChart, market.symbol, activeSelection.interval]);
  const handleTool = useCallback(
    (tool: string) => {
      activeChart?.setTool(tool);
      const panes = rootRef.current?.querySelectorAll<HTMLElement>('.cf-chart');
      panes?.[active]?.focus({ preventScroll: true });
    },
    [activeChart, active]
  );
  const handleUndo = useCallback(() => run({ type: 'history.undo' }), [run]);
  const handleRedo = useCallback(() => run({ type: 'history.redo' }), [run]);
  const handleClear = useCallback(() => run({ type: 'drawing.clear' }), [run]);

  const preset = GRID_PRESETS[grid.preset];

  return (
    <div
      ref={rootRef}
      className={cn('flex h-full w-full flex-col overflow-hidden bg-background', className)}
    >
      <ChartToolbar
        timeInterval={activeSelection.interval}
        onIntervalChange={handleIntervalChange}
        priceSource={activeSelection.source}
        onPriceSourceChange={handleSourceChange}
        showChartType={false}
        actions={
          <ChartActions
            onAddIndicator={handleAddIndicator}
            grid={grid.preset}
            onGridChange={handleGridChange}
            volume={activeView.volume}
            onVolumeChange={handleVolume}
            log={activeView.log}
            onLogChange={handleLog}
            onFit={handleFit}
            onSnapshot={handleSnapshot}
            fullscreen={fullscreen}
            onFullscreenChange={handleFullscreen}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <ChartDrawingRail
          tool={activeView.tool}
          onToolChange={handleTool}
          canUndo={activeView.canUndo}
          canRedo={activeView.canRedo}
          hasDrawings={activeView.hasDrawings}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
        />
        <div
          ref={gridRef}
          className="relative min-w-0 flex-1"
          style={
            {
              '--split-x': grid.split.x,
              '--split-y': grid.split.y,
            } as CSSProperties
          }
        >
          <div
            className="grid h-full w-full gap-px bg-outline"
            style={{
              gridTemplateColumns:
                preset.cols === 2
                  ? 'minmax(0, calc(var(--split-x) * 100%)) minmax(0, 1fr)'
                  : 'minmax(0, 1fr)',
              gridTemplateRows:
                preset.rows === 2
                  ? 'minmax(0, calc(var(--split-y) * 100%)) minmax(0, 1fr)'
                  : 'minmax(0, 1fr)',
            }}
          >
            {selections.map((selection, i) => (
              <div
                key={i}
                className={cn(
                  'relative grid min-h-0 min-w-0 bg-background',
                  i === 0 && preset.first
                )}
              >
                <ChartPane
                  index={i}
                  market={market}
                  // Pane 1 keeps the pre-grid key, so existing layouts carry over.
                  layoutKey={i === 0 ? market.symbol : `${market.symbol}:${i + 1}`}
                  interval={selection.interval}
                  priceSource={selection.source}
                  livePrices={livePrices}
                  multi={multi}
                  active={i === active}
                  onActivate={handleActivate}
                  onChart={handleChart}
                  onView={handleView}
                  onCandles={i === 0 ? onCandles : undefined}
                  position={position}
                  onTriggerChange={onTriggerChange}
                />
              </div>
            ))}
          </div>
          <ChartGridDividers
            containerRef={gridRef}
            split={grid.split}
            cols={preset.cols}
            rows={preset.rows}
            rowSplitRightOnly={preset.rowSplitRightOnly}
            onSplitChange={handleSplitChange}
          />
        </div>
      </div>
    </div>
  );
}

export const CandleFrameChart = memo(CandleFrameChartComponent);
