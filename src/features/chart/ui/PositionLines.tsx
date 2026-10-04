/**
 * PositionLines.tsx
 * TradingView-style position overlay for the perps chart: the entry line with
 * a size / PnL tag, and SL / TP lines whose tags can be dragged to a new price
 * or removed. Dragging the TP or SL handle off the position tag adds a leg.
 *
 * The lines themselves are lightweight-charts price lines (so they get axis
 * labels and follow zoom for free); the tags are HTML laid over the pane at
 * the lines' pixel positions, since price lines take no pointer input.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IChartApi, IPriceLine, ISeriesApi } from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TriggerKind = 'stop_loss' | 'take_profit';

export interface ChartPosition {
  side: 'long' | 'short';
  /** Absolute size in base units. */
  size: number;
  entryPrice: number;
  unrealizedPnl: number | null;
  /** Current mark; a leg must sit on the far side of it. */
  markPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  /** Smallest price step; dragged prices snap to it. */
  tick: number;
  baseUnit: string;
  quoteUnit: string;
}

interface PositionLinesProps {
  chart: IChartApi;
  series: ISeriesApi<any>;
  position: ChartPosition;
  /** Sets (price) or removes (null) one leg. Absent = lines are read-only. */
  onTriggerChange?: (kind: TriggerKind, price: number | null) => Promise<boolean>;
  buyColor: string;
  sellColor: string;
}

type LineKey = 'entry' | TriggerKind;

interface Drag {
  kind: TriggerKind;
  price: number;
  /** Dragged out of the position tag rather than an existing line. */
  isNew: boolean;
  pointerId: number;
}

interface Pending {
  kind: TriggerKind;
  /** null = removing the leg. */
  price: number | null;
}

const LABEL: Record<TriggerKind, string> = { stop_loss: 'SL', take_profit: 'TP' };
const NAME: Record<TriggerKind, string> = { stop_loss: 'Stop loss', take_profit: 'Take profit' };
// Give up waiting for the keeper to echo a save after this long.
const PENDING_TIMEOUT_MS = 20_000;

const decimalsOf = (tick: number) => Math.max(0, Math.ceil(-Math.log10(tick) - 1e-9));

const formatSigned = (n: number) =>
  `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function PositionLines({
  chart,
  series,
  position,
  onTriggerChange,
  buyColor,
  sellColor,
}: PositionLinesProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const long = position.side === 'long';
  const decimals = decimalsOf(position.tick);
  const editable = !!onTriggerChange && !pending;

  // The price each line shows: the drag preview, then an unconfirmed save,
  // then what the keeper reports.
  const shown = (kind: TriggerKind): number | null => {
    if (drag?.kind === kind) return drag.price;
    if (pending?.kind === kind) return pending.price;
    return kind === 'stop_loss' ? position.stopLoss : position.takeProfit;
  };
  const prices: Record<LineKey, number | null> = {
    entry: position.entryPrice > 0 ? position.entryPrice : null,
    stop_loss: shown('stop_loss'),
    take_profit: shown('take_profit'),
  };

  const pnlAt = (price: number) => (price - position.entryPrice) * position.size * (long ? 1 : -1);

  // ── Price lines ──────────────────────────────────────────────────────────
  const linesRef = useRef<Partial<Record<LineKey, IPriceLine>>>({});
  const pnlPositive = (position.unrealizedPnl ?? 0) >= 0;
  const lineColor: Record<LineKey, string> = {
    entry: pnlPositive ? buyColor : sellColor,
    stop_loss: sellColor,
    take_profit: buyColor,
  };

  useEffect(() => {
    const lines = linesRef.current;
    (Object.keys(prices) as LineKey[]).forEach(key => {
      const price = prices[key];
      const line = lines[key];
      if (price === null) {
        if (line) series.removePriceLine(line);
        delete lines[key];
        return;
      }
      const options = {
        price,
        color: lineColor[key],
        lineWidth: 1 as const,
        lineStyle: key === 'entry' ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: '',
      };
      if (line) line.applyOptions(options);
      else lines[key] = series.createPriceLine(options);
    });
  });

  // Lines belong to this series; drop them with it.
  useEffect(
    () => () => {
      const lines = linesRef.current;
      (Object.keys(lines) as LineKey[]).forEach(key => {
        try {
          series.removePriceLine(lines[key]!);
        } catch {
          /* series already removed with its chart */
        }
      });
      linesRef.current = {};
    },
    [series]
  );

  // ── Tag positions ────────────────────────────────────────────────────────
  // Pan, zoom, price-scale drags and resizes all move the lines, and only some
  // of them emit events, so follow the lines every frame (cheap: three lookups,
  // state only changes when a tag actually moves).
  const [layout, setLayout] = useState<{
    y: Record<LineKey, number | null>;
    right: number;
    height: number;
  }>({ y: { entry: null, stop_loss: null, take_profit: null }, right: 0, height: 0 });
  const pricesRef = useRef(prices);
  pricesRef.current = prices;

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const p = pricesRef.current;
      const toY = (price: number | null) => {
        if (price === null) return null;
        const y = series.priceToCoordinate(price);
        return y === null ? null : Math.round(y);
      };
      const next = {
        y: { entry: toY(p.entry), stop_loss: toY(p.stop_loss), take_profit: toY(p.take_profit) },
        right: Math.round(chart.priceScale('right').width()),
        height: overlayRef.current?.clientHeight ?? 0,
      };
      setLayout(prev =>
        prev.right === next.right &&
        prev.height === next.height &&
        prev.y.entry === next.y.entry &&
        prev.y.stop_loss === next.y.stop_loss &&
        prev.y.take_profit === next.y.take_profit
          ? prev
          : next
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [chart, series]);

  // ── Saving ───────────────────────────────────────────────────────────────
  // Hold the new price until the keeper reports it, so the line doesn't jump
  // back to the old one between the save and the next poll.
  useEffect(() => {
    if (!pending) return;
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
  }, [pending, position.stopLoss, position.takeProfit, position.tick]);

  const commit = useCallback(
    async (kind: TriggerKind, price: number | null) => {
      if (!onTriggerChange) return;
      setPending({ kind, price });
      let saved = false;
      try {
        saved = await onTriggerChange(kind, price);
      } finally {
        if (!saved) setPending(null);
      }
    },
    [onTriggerChange]
  );

  // A leg on the wrong side of the mark would fire on the keeper's next poll.
  const problemWith = (kind: TriggerKind, price: number): string | null => {
    const mark = position.markPrice;
    if (!mark) return null;
    if (kind === 'stop_loss' && (long ? price >= mark : price <= mark)) {
      return `Stop loss must be ${long ? 'below' : 'above'} the mark price`;
    }
    if (kind === 'take_profit' && (long ? price <= mark : price >= mark)) {
      return `Take profit must be ${long ? 'above' : 'below'} the mark price`;
    }
    return null;
  };

  // ── Dragging ─────────────────────────────────────────────────────────────
  const priceAtPointer = (clientY: number): number | null => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const raw = series.coordinateToPrice(clientY - rect.top);
    if (raw === null || !Number.isFinite(raw) || raw <= 0) return null;
    return Number((Math.round(raw / position.tick) * position.tick).toFixed(decimals));
  };

  const startDrag = (e: React.PointerEvent, kind: TriggerKind, isNew: boolean) => {
    if (!editable || e.button !== 0) return;
    const price = isNew ? priceAtPointer(e.clientY) : shown(kind);
    if (price === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind, price, isNew, pointerId: e.pointerId });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const price = priceAtPointer(e.clientY);
    if (price !== null && price !== drag.price) setDrag({ ...drag, price });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { kind, price } = drag;
    setDrag(null);
    const before = kind === 'stop_loss' ? position.stopLoss : position.takeProfit;
    if (before !== null && Math.abs(before - price) < position.tick / 2) return;
    const problem = problemWith(kind, price);
    if (problem) {
      toast.error(problem);
      return;
    }
    void commit(kind, price);
  };

  // Escape abandons a drag.
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  // ── Tags ─────────────────────────────────────────────────────────────────
  const visible = (y: number | null): y is number => y !== null && y >= 0 && y <= layout.height;

  const entryY = layout.y.entry;
  const pnl = position.unrealizedPnl;

  const legTag = (kind: TriggerKind) => {
    const price = prices[kind];
    const y = layout.y[kind];
    if (price === null || !visible(y)) return null;
    const color = lineColor[kind];
    const dragging = drag?.kind === kind;
    const saving = pending?.kind === kind;
    const invalid = dragging && !!problemWith(kind, price);
    return (
      <div
        key={kind}
        className={cn(
          'pointer-events-auto absolute flex h-5 -translate-y-1/2 select-none items-stretch border font-mono text-[10px] leading-none tabular-nums shadow-sm',
          editable || dragging ? 'cursor-ns-resize' : 'cursor-default'
        )}
        style={{
          top: y,
          right: layout.right + 8,
          borderColor: invalid ? '#f59e0b' : color,
          background: 'rgb(9 20 16 / 0.92)',
        }}
        onPointerDown={e => startDrag(e, kind, false)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
        title={editable ? `Drag to move ${NAME[kind].toLowerCase()}` : undefined}
      >
        <span
          className="flex items-center px-1.5 font-semibold text-background"
          style={{ background: color }}
        >
          {LABEL[kind]}
        </span>
        <span className="flex items-center gap-1 px-1.5" style={{ color }}>
          {saving && <Loader2 className="size-2.5 animate-spin" />}
          {saving && price === null
            ? 'Removing…'
            : `${formatSigned(pnlAt(price))} ${position.quoteUnit}`}
        </span>
        {editable && !dragging && (
          <button
            type="button"
            aria-label={`Remove ${NAME[kind].toLowerCase()}`}
            className="flex items-center border-l px-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            style={{ borderColor: `${color}66` }}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => void commit(kind, null)}
          >
            <X className="size-2.5" />
          </button>
        )}
      </div>
    );
  };

  // While a new leg is dragged out of the position tag, the drag lives on the
  // handle that started it, which stays under the entry line; its preview tag
  // is drawn read-only at the pointer.
  const newHandle = (kind: TriggerKind) => {
    const exists = (kind === 'stop_loss' ? position.stopLoss : position.takeProfit) !== null;
    if (exists || !onTriggerChange) return null;
    if (pending?.kind === kind) return null;
    return (
      <button
        type="button"
        disabled={!editable}
        className="flex cursor-ns-resize items-center border-l px-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-40"
        style={{ borderColor: 'rgb(255 255 255 / 0.15)' }}
        title={`Drag ${long === (kind === 'take_profit') ? 'up' : 'down'} to set a ${NAME[kind].toLowerCase()}`}
        onPointerDown={e => startDrag(e, kind, true)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
      >
        {LABEL[kind]}
      </button>
    );
  };

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {visible(entryY) && (
        <div
          className="pointer-events-auto absolute flex h-5 -translate-y-1/2 select-none items-stretch border font-mono text-[10px] leading-none tabular-nums shadow-sm"
          style={{
            top: entryY,
            right: layout.right + 8,
            borderColor: lineColor.entry,
            background: 'rgb(9 20 16 / 0.92)',
          }}
        >
          <span
            className="flex items-center px-1.5 font-semibold text-background"
            style={{ background: lineColor.entry }}
          >
            {long ? 'Long' : 'Short'}{' '}
            {position.size.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </span>
          {pnl !== null && (
            <span className="flex items-center px-1.5" style={{ color: lineColor.entry }}>
              {formatSigned(pnl)} {position.quoteUnit}
            </span>
          )}
          {newHandle('take_profit')}
          {newHandle('stop_loss')}
        </div>
      )}
      {legTag('take_profit')}
      {legTag('stop_loss')}
    </div>
  );
}
