/**
 * One chart in the perps chart grid: a bare CandleFrame engine with its feed,
 * saved layout, legend, loading / error states and the position's price
 * lines. The grid (CandleFrameChart) owns the toolbar and drawing rail and
 * drives the active pane through the engine handle this reports.
 *
 * Changing market remounts the pane; interval / price source swap the feed.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, type ChartApi } from 'candleframe/chart';
import {
  builtInDrawingTools,
  type Candle,
  type ChartType,
  type Drawing,
  type DrawingPatch,
} from 'candleframe/core';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import type { HarnessMarketConversionParams } from '@/shared/lib/harness-market';
import {
  chartTheme,
  resolveTimeZone,
  type ChartSettings,
} from '@/features/chart/lib/chart-settings';
import { createFermiFeed, type FermiFeed } from '@/features/chart/lib/fermi-feed';
import { volumeIndicator } from '@/features/chart/lib/volume-indicator';
import { priceAxisWidth, priceDigits } from '@/features/chart/lib/price-axis';
import {
  autosaveChartLayout,
  restoreChartLayout,
  type ChartLayoutAutosave,
} from '@/features/chart/lib/chart-document';
import { createValueStore } from '@/features/chart/lib/value-store';
import type { PerpsPriceSource, PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import { usePositionPriceLines } from '@/features/chart/model/usePositionPriceLines';
import { ChartLegend, type LegendIndicator } from './ChartLegend';
import { ChartPaneOverlays } from './ChartPaneOverlays';
import type { MagnetMode } from './ChartDrawingRail';
import { DrawingToolbar } from './drawing-editor/DrawingToolbar';
import type { ChartPosition, TriggerKind } from './PositionLines';

export interface CandleFrameMarket {
  uuid: string;
  symbol: string;
  base: string;
  quote: string;
  tickSize: number;
  conversion: HarnessMarketConversionParams;
}

/** The slice of a pane's chart state the toolbar and rail render. */
export interface PaneView {
  log: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasDrawings: boolean;
  drawingsHidden: boolean;
  tool: string;
  chartType: ChartType;
}

/** Drawing options the rail sets on every pane alike. */
export interface DrawingPrefs {
  magnet: MagnetMode;
  keepDrawing: boolean;
}

interface Status {
  status: 'loading' | 'live' | 'error';
  message: string | null;
}

interface ChartPaneProps {
  index: number;
  market: CandleFrameMarket;
  /** localStorage key for this pane's indicators and drawings. */
  layoutKey: string;
  interval: PerpsTimeframe;
  priceSource: PerpsPriceSource;
  livePrices: Record<PerpsPriceSource, number | null>;
  /** Part of a grid: shows its interval / source caption. */
  multi: boolean;
  /** The pane the toolbar and rail act on; outlined in a grid. */
  active: boolean;
  onActivate: (index: number) => void;
  /** Reports the engine once mounted (null on unmount). */
  onChart: (index: number, chart: ChartApi | null) => void;
  onView: (index: number, view: PaneView) => void;
  onCandles?: (candles: readonly Candle[]) => void;
  drawingPrefs: DrawingPrefs;
  /** Colors, legend, scales and canvas from the chart settings dialog. */
  settings: ChartSettings;
  position: ChartPosition | null;
  onTriggerChange?: (kind: TriggerKind, price: number | null) => Promise<boolean>;
}

const TOOLS = new Map(builtInDrawingTools.map(tool => [tool.type, tool]));
const NO_DRAWINGS: readonly Drawing[] = [];

const statusOf = (s: string): Status['status'] =>
  s === 'live' ? 'live' : s === 'error' ? 'error' : 'loading';

function ChartPaneComponent({
  index,
  market,
  layoutKey,
  interval,
  priceSource,
  livePrices,
  multi,
  active,
  onActivate,
  onChart,
  onView,
  onCandles,
  drawingPrefs,
  settings,
  position,
  onTriggerChange,
}: ChartPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<ChartApi | null>(null);
  const [status, setStatus] = useState<Status>({ status: 'loading', message: null });
  const [indicators, setIndicators] = useState<LegendIndicator[]>([]);
  const [pricePrecision, setPricePrecision] = useState(2);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [toolHint, setToolHint] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<readonly Drawing[]>(NO_DRAWINGS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hovered = useMemo(() => createValueStore<Candle | null>(null), []);
  const latestBar = useMemo(() => createValueStore<Candle | null>(null), []);
  const feedRef = useRef<FermiFeed | null>(null);
  const autosaveRef = useRef<ChartLayoutAutosave | null>(null);

  // Latest props for long-lived callbacks.
  const latest = useRef({
    market,
    livePrices,
    onCandles,
    onView,
    onChart,
    interval,
    priceSource,
    settings,
  });
  latest.current = {
    market,
    livePrices,
    onCandles,
    onView,
    onChart,
    interval,
    priceSource,
    settings,
  };

  const makeFeed = useCallback((source: PerpsPriceSource, tf: PerpsTimeframe) => {
    const m = latest.current.market;
    const feed = createFermiFeed({
      marketId: m.uuid,
      symbol: m.symbol,
      base: m.base,
      quote: m.quote,
      tickSize: m.tickSize,
      conversion: m.conversion,
      interval: tf,
      source,
    });
    // Seed with the latest tick so a quiet market still shows its price.
    const price = latest.current.livePrices[source];
    if (price !== null) feed.pushPrice(price);
    feedRef.current = feed;
    return feed;
  }, []);

  // ── Engine lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let tool = 'cursor';
    let drawingsHidden = false;
    let lastView = '';
    let lastState: Parameters<Parameters<ChartApi['subscribe']>[0]>[0] | null = null;
    const report = () => {
      if (!lastState) return;
      const view: PaneView = {
        log: !!lastState.document.priceScale.log,
        canUndo: lastState.history.canUndo,
        canRedo: lastState.history.canRedo,
        hasDrawings: lastState.document.drawings.length > 0,
        drawingsHidden,
        tool,
        chartType: lastState.document.chartType ?? 'candles',
      };
      const key = JSON.stringify(view);
      if (key === lastView) return;
      lastView = key;
      latest.current.onView(index, view);
    };

    let instance: ChartApi;
    try {
      instance = createChart(host, {
        feed: makeFeed(latest.current.priceSource, latest.current.interval),
        theme: chartTheme(latest.current.settings),
        indicatorDefinitions: [volumeIndicator(() => latest.current.settings.candles)],
        timeZone: resolveTimeZone(latest.current.settings.scales.timeZone),
        onHover: bar => hovered.set(bar),
        onToolChange: next => {
          tool = next;
          setToolHint(next === 'cursor' ? null : (TOOLS.get(next)?.hint ?? null));
          report();
        },
        onDrawingChange: state => {
          drawingsHidden = state.options.hidden;
          // The toolbar edits one drawing; a multi-selection gets none.
          setSelectedId(state.selection.length === 1 ? (state.selected?.id ?? null) : null);
          report();
        },
        // Double-click / Enter: text tools edit their text, the rest open settings.
        onDrawingEdit: drawing => {
          if (TOOLS.get(drawing.type)?.editableText) {
            setEditing({ id: drawing.id, text: drawing.text });
          } else {
            setSelectedId(drawing.id);
            setSettingsOpen(true);
          }
        },
        onError: error => console.warn('[chart]', error.code, error.message),
      });
    } catch (error) {
      // No WebGL2, most likely.
      setStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Chart failed to start',
      });
      return;
    }
    restoreChartLayout(instance, layoutKey);
    const autosave = autosaveChartLayout(instance, layoutKey);
    autosaveRef.current = autosave;

    let lastCandles: readonly Candle[] | null = null;
    let lastStatus = '';
    let lastIndicators = '';
    const unsubscribe = instance.subscribe(state => {
      lastState = state;
      // Same array until the document changes, so ticks don't re-render.
      setDrawings(state.document.drawings);
      if (state.candles !== lastCandles) {
        lastCandles = state.candles;
        latestBar.set(state.candles[state.candles.length - 1] ?? null);
        latest.current.onCandles?.(state.candles);
      }
      const health = state.streams.candles;
      const nextStatus = { status: statusOf(health.status), message: health.message };
      const statusKey = JSON.stringify(nextStatus);
      if (statusKey !== lastStatus) {
        lastStatus = statusKey;
        setStatus(nextStatus);
      }
      const nextIndicators = state.indicators.map(({ plugin, visible }) => ({
        id: plugin.id,
        name: plugin.name,
        visible,
        pane: plugin.pane ?? 'price',
      }));
      const indicatorsKey = JSON.stringify(nextIndicators);
      if (indicatorsKey !== lastIndicators) {
        lastIndicators = indicatorsKey;
        setIndicators(nextIndicators);
      }
      setPricePrecision(state.feed.instrument.pricePrecision);
      report();
    });
    setChart(instance);
    latest.current.onChart(index, instance);

    return () => {
      unsubscribe();
      autosave.dispose();
      autosaveRef.current = null;
      latest.current.onChart(index, null);
      instance.dispose();
      feedRef.current = null;
      setChart(null);
    };
    // Only the market (via key) or the pane's layout slot remount the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  // ── Interval / price source: swap the feed, keep the layout ─────────────
  const selectionRef = useRef({ interval, priceSource });
  useEffect(() => {
    if (!chart) return;
    const prev = selectionRef.current;
    if (prev.interval === interval && prev.priceSource === priceSource) return;
    selectionRef.current = { interval, priceSource };
    // An interval switch keeps the document (drawings, groups, undo). A new
    // source is a new feed id, which starts a fresh document: write the layout
    // first and put it back after.
    const sourceChanged = prev.priceSource !== priceSource;
    if (sourceChanged) autosaveRef.current?.flush();
    chart.replaceFeed(makeFeed(priceSource, interval));
    if (sourceChanged) restoreChartLayout(chart, layoutKey);
  }, [chart, interval, priceSource, makeFeed, layoutKey]);

  // ── Live ticks ────────────────────────────────────────────────────────────
  useEffect(() => {
    const feed = feedRef.current;
    const price = feed ? livePrices[feed.source] : null;
    if (feed && price !== null) feed.pushPrice(price);
  }, [livePrices]);

  // ── Magnet / keep drawing, shared by every pane ─────────────────────────
  useEffect(() => {
    chart?.setDrawingOptions({
      magnet: drawingPrefs.magnet,
      stayInDrawingMode: drawingPrefs.keepDrawing,
    });
  }, [chart, drawingPrefs.magnet, drawingPrefs.keepDrawing]);

  // ── Chart settings: theme overrides and time zone ───────────────────────
  // Collapsed indicator panes need room above the time axis (ChartPaneOverlays).
  const paneStrip = indicators.some(i => i.pane === 'separate' && !i.visible);
  // The price axis fits the market's labels; it changes only with the digit count.
  const digits = priceDigits(livePrices[priceSource]);
  const axisWidth = useMemo(
    () => (digits === null ? undefined : priceAxisWidth(digits, pricePrecision)),
    [digits, pricePrecision]
  );
  const theme = useMemo(
    () => chartTheme(settings, paneStrip, axisWidth),
    [settings, paneStrip, axisWidth]
  );
  // Also runs once per new engine: createChart got the settings, but not the
  // fitted axis or the collapsed-pane strip.
  useEffect(() => {
    chart?.setTheme(theme);
  }, [chart, theme]);
  // Skips the first run per engine: createChart already got the time zone.
  const appliedZone = useRef<{ chart: ChartApi; zone: string } | null>(null);
  useEffect(() => {
    if (!chart) return;
    const zone = settings.scales.timeZone;
    const applied = appliedZone.current;
    appliedZone.current = { chart, zone };
    if (applied?.chart !== chart || applied.zone === zone) return;
    chart.setTimeZone(resolveTimeZone(zone));
  }, [chart, settings.scales.timeZone]);

  usePositionPriceLines(chart, position, onTriggerChange);

  // ── Legend / overlays ─────────────────────────────────────────────────────
  const run = useCallback(
    (command: Parameters<ChartApi['execute']>[0]) => {
      try {
        chart?.execute(command);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Chart command failed');
      }
    },
    [chart]
  );
  const handleToggleIndicator = useCallback(
    (id: string, visible: boolean) => run({ type: 'indicator.update', id, visible }),
    [run]
  );
  const handleRemoveIndicator = useCallback(
    (id: string) => run({ type: 'indicator.remove', id }),
    [run]
  );
  const handleRetry = useCallback(() => {
    if (!chart) return;
    chart.replaceFeed(makeFeed(priceSource, interval));
    restoreChartLayout(chart, layoutKey);
  }, [chart, makeFeed, priceSource, interval, layoutKey]);

  const selected = drawings.find(d => d.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) setSettingsOpen(false);
  }, [selected]);
  const selectedTool = selected ? TOOLS.get(selected.type) : undefined;
  const updateSelected = useCallback(
    (patch: DrawingPatch) => {
      if (selectedId) run({ type: 'drawing.update', id: selectedId, patch });
    },
    [run, selectedId]
  );
  const removeSelected = useCallback(() => {
    if (selectedId) run({ type: 'drawing.remove', id: selectedId });
  }, [run, selectedId]);
  const editSelectedText = useCallback(() => {
    if (selected) setEditing({ id: selected.id, text: selected.text });
  }, [selected]);

  const saveText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editing) return;
    run({ type: 'drawing.update', id: editing.id, patch: { text: editing.text } });
    setEditing(null);
  };

  return (
    <div
      className={cn(
        'relative min-h-0 min-w-0 overflow-hidden',
        multi && active && 'outline outline-1 -outline-offset-1 outline-primary/40'
      )}
      onPointerDownCapture={() => onActivate(index)}
      onFocusCapture={() => onActivate(index)}
    >
      {/* CandleFrame's own status box (loading / errors) is hidden; the
          overlays below replace it. */}
      <div
        ref={hostRef}
        className="absolute inset-0 [&_.cf-chart>[role=status]]:[display:none!important]"
      />
      <ChartLegend
        hovered={hovered}
        latest={latestBar}
        pricePrecision={pricePrecision}
        indicators={settings.legend.indicators ? indicators : []}
        showOhlc={settings.legend.ohlcValues}
        showChange={settings.legend.change}
        caption={multi ? `${interval} · ${priceSource === 'mark' ? 'Mark' : 'Last'}` : undefined}
        onToggleIndicator={handleToggleIndicator}
        onRemoveIndicator={handleRemoveIndicator}
      />
      <ChartPaneOverlays
        host={hostRef}
        theme={theme}
        indicators={indicators}
        onToggle={handleToggleIndicator}
        onRemove={handleRemoveIndicator}
      />

      {status.status === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/80">
          <AlertCircle className="size-8 text-danger" />
          <div className="text-center">
            <p className="text-sm font-medium text-danger">Failed to fetch chart data</p>
            {status.message && (
              <p className="mt-1 max-w-md text-xs text-rock/50">{status.message}</p>
            )}
          </div>
          <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}
      {status.status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          {status.message ? (
            // History came back empty: waiting for the first tick.
            <span className="text-sm text-rock/50">{status.message}</span>
          ) : (
            <div className="flex items-center gap-2 text-sm text-rock/50">
              <Loader2 className="size-4 animate-spin" />
              Loading chart data…
            </div>
          )}
        </div>
      )}

      {chart && selected && selectedTool && active && !editing && (
        <div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2">
          <DrawingToolbar
            chart={chart}
            drawing={selected}
            tool={selectedTool}
            update={updateSelected}
            pricePrecision={pricePrecision}
            onRemove={removeSelected}
            onEditText={editSelectedText}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
          />
        </div>
      )}

      {toolHint && active && !editing && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 border border-outline bg-surface/90 px-2 py-1 text-[11px] text-rock/60">
          {toolHint}
        </div>
      )}

      {editing && (
        <form
          onSubmit={saveText}
          className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-end gap-1 border border-outline bg-surface p-1 shadow-lg"
        >
          {/* Enter saves, Shift+Enter starts a new line (notes, table rows). */}
          <textarea
            autoFocus
            // New drawings start with placeholder text; typing replaces it.
            onFocus={e => e.currentTarget.select()}
            rows={Math.min(6, editing.text.split('\n').length)}
            value={editing.text}
            onChange={e => setEditing({ ...editing, text: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Escape') setEditing(null);
              else if (e.key === 'Enter' && !e.shiftKey) saveText(e);
            }}
            placeholder="Text"
            aria-label="Drawing text"
            className="w-56 resize-none bg-transparent px-2 py-1.5 text-xs leading-4 text-rock outline-none placeholder:text-rock/30"
          />
          <Button type="submit" size="sm" className="h-7 text-xs">
            Save
          </Button>
        </form>
      )}
    </div>
  );
}

export const ChartPane = memo(ChartPaneComponent);
