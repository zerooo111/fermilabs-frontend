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
import { builtInDrawingTools, type Candle } from 'candleframe/core';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import type { HarnessMarketConversionParams } from '@/shared/lib/harness-market';
import { fermiChartTheme } from '@/features/chart/lib/candleframe-theme';
import { createFermiFeed, type FermiFeed } from '@/features/chart/lib/fermi-feed';
import {
  autosaveChartLayout,
  restoreChartLayout,
  type ChartLayoutAutosave,
} from '@/features/chart/lib/chart-document';
import { createValueStore } from '@/features/chart/lib/value-store';
import type { PerpsPriceSource, PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import { usePositionPriceLines } from '@/features/chart/model/usePositionPriceLines';
import { ChartLegend, type LegendIndicator } from './ChartLegend';
import type { MagnetMode } from './ChartDrawingRail';
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
  volume: boolean;
  log: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasDrawings: boolean;
  drawingsHidden: boolean;
  tool: string;
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
  position: ChartPosition | null;
  onTriggerChange?: (kind: TriggerKind, price: number | null) => Promise<boolean>;
}

/** What each drawing tool asks for, shown while it's active. */
const TOOL_HINTS = new Map(builtInDrawingTools.map(tool => [tool.type, tool.hint]));

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
  const hovered = useMemo(() => createValueStore<Candle | null>(null), []);
  const latestBar = useMemo(() => createValueStore<Candle | null>(null), []);
  const feedRef = useRef<FermiFeed | null>(null);
  const autosaveRef = useRef<ChartLayoutAutosave | null>(null);

  // Latest props for long-lived callbacks.
  const latest = useRef({ market, livePrices, onCandles, onView, onChart, interval, priceSource });
  latest.current = { market, livePrices, onCandles, onView, onChart, interval, priceSource };

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
        volume: lastState.document.layers.volume,
        log: !!lastState.document.priceScale.log,
        canUndo: lastState.history.canUndo,
        canRedo: lastState.history.canRedo,
        hasDrawings: lastState.document.drawings.length > 0,
        drawingsHidden,
        tool,
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
        theme: fermiChartTheme,
        onHover: bar => hovered.set(bar),
        onToolChange: next => {
          tool = next;
          setToolHint(next === 'cursor' ? null : (TOOL_HINTS.get(next) ?? null));
          report();
        },
        onDrawingChange: state => {
          drawingsHidden = state.options.hidden;
          report();
        },
        onDrawingEdit: drawing => setEditing({ id: drawing.id, text: drawing.text }),
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
    // The runtime drops drawings when the source changes; write them first
    // and put them back after.
    autosaveRef.current?.flush();
    chart.replaceFeed(makeFeed(priceSource, interval));
    restoreChartLayout(chart, layoutKey);
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
        indicators={indicators}
        caption={multi ? `${interval} · ${priceSource === 'mark' ? 'Mark' : 'Last'}` : undefined}
        onToggleIndicator={handleToggleIndicator}
        onRemoveIndicator={handleRemoveIndicator}
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
