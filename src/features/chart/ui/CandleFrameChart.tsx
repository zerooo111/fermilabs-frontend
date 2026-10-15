/**
 * CandleFrame chart for a perps market: the full CandleFrame workbench
 * (drawings, indicators, chart types, layouts, PNG export) fed from Fermi
 * candles, with the open position, SL and TP drawn as CandleFrame price lines.
 *
 * The widget owns interval and price-source selection (its interval picker and
 * source picker); we persist them and pick them up again on mount. The market
 * itself stays app-controlled: changing it remounts the widget.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { createChartWidget, type ChartApi, type ChartWidgetApi, type PriceLine } from 'candleframe';
import type { Candle } from 'candleframe/core';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { HarnessMarketConversionParams } from '@/shared/lib/harness-market';
import { fermiChartTheme } from '@/features/chart/lib/candleframe-theme';
import {
  createFermiFeed,
  FERMI_INTERVALS,
  PRICE_SOURCE_LABEL,
  type FermiFeed,
} from '@/features/chart/lib/fermi-feed';
import type { PerpsPriceSource, PerpsTimeframe } from '@/features/chart/lib/perps-chart';
import type { ChartPosition, TriggerKind } from './PositionLines';

const PRICE_SOURCES: readonly PerpsPriceSource[] = ['mark', 'ltp'];
// Keyboard shortcuts 1..6 → timeframe
const TIMEFRAME_SHORTCUTS: Record<string, PerpsTimeframe> = {
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1h',
  '5': '4h',
  '6': '1d',
};
const LABEL: Record<TriggerKind, string> = { stop_loss: 'SL', take_profit: 'TP' };
// Give up waiting for the keeper to echo a save after this long.
const PENDING_TIMEOUT_MS = 20_000;

export interface CandleFrameMarket {
  uuid: string;
  symbol: string;
  base: string;
  quote: string;
  tickSize: number;
  conversion: HarnessMarketConversionParams;
}

interface CandleFrameChartProps {
  market: CandleFrameMarket;
  interval: PerpsTimeframe;
  priceSource: PerpsPriceSource;
  /** The user picked another interval or source in the chart. */
  onSelectionChange: (interval: PerpsTimeframe, source: PerpsPriceSource) => void;
  /** Live ticks, UI units. Each feed takes the one matching its source. */
  livePrices: Record<PerpsPriceSource, number | null>;
  /** Loaded candles of the active chart, for the header's 24h change. */
  onCandles?: (candles: readonly Candle[]) => void;
  position: ChartPosition | null;
  /** Sets (price) or removes (null) one leg. Absent = lines are read-only. */
  onTriggerChange?: (kind: TriggerKind, price: number | null) => Promise<boolean>;
  className?: string;
}

interface Pending {
  kind: TriggerKind;
  /** null = removing the leg. */
  price: number | null;
}

const decimalsOf = (tick: number) => Math.max(0, Math.ceil(-Math.log10(tick) - 1e-9));

const formatSigned = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function CandleFrameChartComponent({
  market,
  interval,
  priceSource,
  onSelectionChange,
  livePrices,
  onCandles,
  position,
  onTriggerChange,
  className,
}: CandleFrameChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<ChartWidgetApi | null>(null);
  const feedsRef = useRef(new Set<FermiFeed>());
  const feedForRef = useRef<(source: PerpsPriceSource, tf: PerpsTimeframe) => FermiFeed>(
    () => {
      throw new Error('Chart is not mounted');
    }
  );
  const [charts, setCharts] = useState<readonly ChartApi[]>([]);

  // Latest props for the widget's callbacks, which outlive renders.
  const latest = useRef({ market, livePrices, onSelectionChange, onCandles });
  latest.current = { market, livePrices, onSelectionChange, onCandles };

  // ── Widget lifecycle: one per market ──────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const feeds = feedsRef.current;

    const feedFor = (source: PerpsPriceSource, tf: PerpsTimeframe) => {
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
      for (const old of feeds) if (old.closed) feeds.delete(old);
      feeds.add(feed);
      // Seed with the latest tick so a quiet market still shows its price.
      const price = latest.current.livePrices[source];
      if (price !== null) feed.pushPrice(price);
      return feed;
    };
    feedForRef.current = feedFor;

    let widget: ChartWidgetApi;
    try {
      widget = createChartWidget(host, {
        feed: feedFor(priceSource, interval),
        markets: PRICE_SOURCES.map(source => ({
          id: source,
          label: PRICE_SOURCE_LABEL[source],
          symbols: [market.symbol],
          intervals: FERMI_INTERVALS,
          createFeed: ({ interval: tf }) => feedFor(source, tf as PerpsTimeframe),
        })),
        theme: fermiChartTheme,
        // Our own Archivo / Paper Mono are already loaded by the page.
        fonts: false,
        storageKey: 'fermi-perps-chart',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chart failed to start');
      return;
    }
    widgetRef.current = widget;
    // CandleFrame labels every non-simulated feed "Spot market"; these are perps.
    const shadow = host.querySelector('.candleframe-widget')?.shadowRoot;
    if (shadow) {
      const style = document.createElement('style');
      style.textContent = '.market-kind { display: none; }';
      shadow.append(style);
    }

    // Follow the active chart's market selection and candles, and the set of
    // charts (grid layouts add and remove them).
    let lastSelection = `${interval}:${priceSource}`;
    let lastCandles: readonly Candle[] | null = null;
    let lastCharts: readonly ChartApi[] = [];
    const unsubscribe = widget.subscribe(state => {
      const { id, interval: tf } = state.feed;
      const selection = `${tf}:${id}`;
      if (
        selection !== lastSelection &&
        (FERMI_INTERVALS as readonly string[]).includes(tf) &&
        (PRICE_SOURCES as readonly string[]).includes(id)
      ) {
        lastSelection = selection;
        latest.current.onSelectionChange(tf as PerpsTimeframe, id as PerpsPriceSource);
      }
      if (state.candles !== lastCandles) {
        lastCandles = state.candles;
        latest.current.onCandles?.(state.candles);
      }
      const now = widget.charts();
      if (now.length !== lastCharts.length || now.some((c, i) => c !== lastCharts[i])) {
        lastCharts = now;
        setCharts(now);
      }
    });
    setCharts(widget.charts());

    return () => {
      unsubscribe();
      widget.dispose();
      widgetRef.current = null;
      feeds.clear();
      setCharts([]);
    };
    // The widget owns interval/source after mount; only the market remounts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.uuid]);

  // ── Live ticks ────────────────────────────────────────────────────────────
  useEffect(() => {
    for (const feed of feedsRef.current) {
      const price = livePrices[feed.source];
      if (price !== null) feed.pushPrice(price);
    }
  }, [livePrices]);

  // ── Keyboard shortcuts: 1..6 switch timeframe ────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      // Focus inside the widget's shadow root retargets to its host element.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
        if (hostRef.current?.contains(target) && target.shadowRoot?.activeElement) {
          const inner = target.shadowRoot.activeElement as HTMLElement;
          if (inner.tagName === 'INPUT' || inner.isContentEditable) return;
        }
      }
      const tf = TIMEFRAME_SHORTCUTS[e.key];
      const widget = widgetRef.current;
      if (!tf || !widget) return;
      e.preventDefault();
      const current = widget.inspect().feed;
      if (current.interval === tf) return;
      widget.replaceFeed(feedForRef.current(current.id as PerpsPriceSource, tf));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Position, SL and TP lines ────────────────────────────────────────────
  const [pending, setPending] = useState<Pending | null>(null);

  // Hold the new price until the keeper reports it, so the line doesn't jump
  // back to the old one between the save and the next poll.
  useEffect(() => {
    if (!pending || !position) return;
    const current = pending.kind === 'stop_loss' ? position.stopLoss : position.takeProfit;
    const settled =
      pending.price === null
        ? current === null
        : current !== null && Math.abs(current - pending.price) < position.tick / 2;
    if (settled) {
      setPending(null);
      return;
    }
    const timer = setTimeout(() => setPending(null), PENDING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, position]);

  const editable = !!onTriggerChange && !pending;

  const lines: PriceLine[] = [];
  if (position) {
    const long = position.side === 'long';
    const pnlAt = (price: number) =>
      (price - position.entryPrice) * position.size * (long ? 1 : -1);
    const legPrice = (kind: TriggerKind) => {
      if (pending?.kind === kind) return pending.price;
      return kind === 'stop_loss' ? position.stopLoss : position.takeProfit;
    };
    if (position.entryPrice > 0) {
      const pnl = position.unrealizedPnl;
      lines.push({
        id: 'entry',
        price: position.entryPrice,
        color: (pnl ?? 0) >= 0 ? '#219e61' : '#d53736',
        label: `${long ? 'Long' : 'Short'} ${position.size.toLocaleString(undefined, {
          maximumFractionDigits: 4,
        })}`,
        ...(pnl !== null ? { quantity: `${formatSigned(pnl)} ${position.quoteUnit}` } : {}),
        style: 'solid',
        // Drag out of the position line to place a TP or SL.
        ...(editable ? { drag: 'copy' as const } : {}),
      });
    }
    for (const kind of ['take_profit', 'stop_loss'] as const) {
      const price = legPrice(kind);
      if (price === null) continue;
      const saving = pending?.kind === kind;
      lines.push({
        id: kind,
        price,
        color: kind === 'take_profit' ? '#219e61' : '#d53736',
        label: saving ? `${LABEL[kind]} saving…` : LABEL[kind],
        quantity: `${formatSigned(pnlAt(price))} ${position.quoteUnit}`,
        style: 'dashed',
        ...(editable ? { drag: 'move' as const, closable: true } : {}),
      });
    }
  }
  const linesKey = JSON.stringify(lines);

  useEffect(() => {
    const parsed = JSON.parse(linesKey) as PriceLine[];
    for (const chart of charts) chart.setPriceLines(parsed);
  }, [charts, linesKey]);

  // Drag and close events, with the latest position in reach.
  const positionRef = useRef(position);
  positionRef.current = position;
  const onTriggerChangeRef = useRef(onTriggerChange);
  onTriggerChangeRef.current = onTriggerChange;

  useEffect(() => {
    // Which leg a price would be: beyond the mark in the position's favour is
    // a take profit, against it a stop loss.
    const kindAt = (pos: ChartPosition, price: number): TriggerKind => {
      const ref = pos.markPrice || pos.entryPrice;
      const favourable = pos.side === 'long' ? price > ref : price < ref;
      return favourable ? 'take_profit' : 'stop_loss';
    };
    const problemWith = (pos: ChartPosition, kind: TriggerKind, price: number) => {
      const long = pos.side === 'long';
      const mark = pos.markPrice;
      if (!mark) return null;
      if (kind === 'stop_loss' && (long ? price >= mark : price <= mark)) {
        return `Stop loss must be ${long ? 'below' : 'above'} the mark price`;
      }
      if (kind === 'take_profit' && (long ? price <= mark : price >= mark)) {
        return `Take profit must be ${long ? 'above' : 'below'} the mark price`;
      }
      return null;
    };
    const commit = async (kind: TriggerKind, price: number | null) => {
      const save = onTriggerChangeRef.current;
      if (!save) return;
      setPending({ kind, price });
      let saved = false;
      try {
        saved = await save(kind, price);
      } finally {
        if (!saved) setPending(null);
      }
    };

    const unsubscribers = charts.flatMap(chart => [
      chart.subscribePriceLineDrag(event => {
        const pos = positionRef.current;
        if (!pos) return;
        const kind =
          event.mode === 'copy' ? kindAt(pos, event.price) : (event.id as TriggerKind);
        if (kind !== 'stop_loss' && kind !== 'take_profit') return;
        const pnl = (event.price - pos.entryPrice) * pos.size * (pos.side === 'long' ? 1 : -1);
        if (event.phase === 'start' || event.phase === 'move') {
          const problem = problemWith(pos, kind, event.price);
          return problem
            ? `${LABEL[kind]} ✕`
            : `${LABEL[kind]} ${formatSigned(pnl)} ${pos.quoteUnit}`;
        }
        if (event.phase !== 'end') return;
        const before = kind === 'stop_loss' ? pos.stopLoss : pos.takeProfit;
        if (before !== null && Math.abs(before - event.price) < pos.tick / 2) return;
        const problem = problemWith(pos, kind, event.price);
        if (problem) {
          toast.error(problem);
          return;
        }
        void commit(kind, Number(event.price.toFixed(decimalsOf(pos.tick))));
      }),
      chart.subscribePriceLineAction(event => {
        if (event.action !== 'close') return;
        if (event.id === 'stop_loss' || event.id === 'take_profit') void commit(event.id, null);
      }),
    ]);
    return () => unsubscribers.forEach(off => off());
  }, [charts]);

  return <div ref={hostRef} className={cn('relative h-full w-full', className)} />;
}

export const CandleFrameChart = memo(CandleFrameChartComponent);
