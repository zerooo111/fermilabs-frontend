/**
 * Draws the open position, its SL and its TP as CandleFrame price lines and
 * turns drags on them into trigger-leg edits:
 *   • drag the SL or TP line to move it, × removes it
 *   • drag out of the position line to place a new leg; beyond the mark in the
 *     position's favour it is a take profit, against it a stop loss
 * A saved price is held until the keeper echoes it, so the line doesn't jump
 * back between the save and the next poll.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChartApi, PriceLine } from 'candleframe/chart';
import { toast } from 'sonner';
import type { ChartPosition, TriggerKind } from '@/features/chart/ui/PositionLines';

const LABEL: Record<TriggerKind, string> = { stop_loss: 'SL', take_profit: 'TP' };
// Give up waiting for the keeper to echo a save after this long.
const PENDING_TIMEOUT_MS = 20_000;
const BUY = '#219e61';
const SELL = '#d53736';

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

const pnlAt = (pos: ChartPosition, price: number) =>
  (price - pos.entryPrice) * pos.size * (pos.side === 'long' ? 1 : -1);

// Which leg a price would be: beyond the mark in the position's favour is a
// take profit, against it a stop loss.
const kindAt = (pos: ChartPosition, price: number): TriggerKind => {
  const ref = pos.markPrice || pos.entryPrice;
  const favourable = pos.side === 'long' ? price > ref : price < ref;
  return favourable ? 'take_profit' : 'stop_loss';
};

// A leg on the wrong side of the mark would fire on the keeper's next poll.
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

function buildLines(pos: ChartPosition, pending: Pending | null, editable: boolean): PriceLine[] {
  const lines: PriceLine[] = [];
  const long = pos.side === 'long';
  if (pos.entryPrice > 0) {
    const pnl = pos.unrealizedPnl;
    lines.push({
      id: 'entry',
      price: pos.entryPrice,
      color: (pnl ?? 0) >= 0 ? BUY : SELL,
      label: `${long ? 'Long' : 'Short'} ${pos.size.toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })}`,
      ...(pnl !== null ? { quantity: `${formatSigned(pnl)} ${pos.quoteUnit}` } : {}),
      style: 'solid',
      ...(editable ? { drag: 'copy' as const } : {}),
    });
  }
  for (const kind of ['take_profit', 'stop_loss'] as const) {
    const price =
      pending?.kind === kind ? pending.price : kind === 'stop_loss' ? pos.stopLoss : pos.takeProfit;
    if (price === null) continue;
    lines.push({
      id: kind,
      price,
      color: kind === 'take_profit' ? BUY : SELL,
      label: pending?.kind === kind ? `${LABEL[kind]} saving…` : LABEL[kind],
      quantity: `${formatSigned(pnlAt(pos, price))} ${pos.quoteUnit}`,
      style: 'dashed',
      ...(editable ? { drag: 'move' as const, closable: true } : {}),
    });
  }
  return lines;
}

export function usePositionPriceLines(
  chart: ChartApi | null,
  position: ChartPosition | null,
  onTriggerChange?: (kind: TriggerKind, price: number | null) => Promise<boolean>
) {
  const [pending, setPending] = useState<Pending | null>(null);

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
  const linesKey = JSON.stringify(position ? buildLines(position, pending, editable) : []);

  useEffect(() => {
    chart?.setPriceLines(JSON.parse(linesKey) as PriceLine[]);
  }, [chart, linesKey]);

  // Event handlers read the latest props through refs.
  const positionRef = useRef(position);
  positionRef.current = position;
  const saveRef = useRef(onTriggerChange);
  saveRef.current = onTriggerChange;

  useEffect(() => {
    if (!chart) return;
    const commit = async (kind: TriggerKind, price: number | null) => {
      const save = saveRef.current;
      if (!save) return;
      setPending({ kind, price });
      let saved = false;
      try {
        saved = await save(kind, price);
      } finally {
        if (!saved) setPending(null);
      }
    };

    const offDrag = chart.subscribePriceLineDrag(event => {
      const pos = positionRef.current;
      if (!pos) return;
      const kind = event.mode === 'copy' ? kindAt(pos, event.price) : (event.id as TriggerKind);
      if (kind !== 'stop_loss' && kind !== 'take_profit') return;
      if (event.phase === 'start' || event.phase === 'move') {
        return problemWith(pos, kind, event.price)
          ? `${LABEL[kind]} ✕`
          : `${LABEL[kind]} ${formatSigned(pnlAt(pos, event.price))} ${pos.quoteUnit}`;
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
    });
    const offAction = chart.subscribePriceLineAction(event => {
      if (event.action !== 'close') return;
      if (event.id === 'stop_loss' || event.id === 'take_profit') void commit(event.id, null);
    });
    return () => {
      offDrag();
      offAction();
    };
  }, [chart]);
}
