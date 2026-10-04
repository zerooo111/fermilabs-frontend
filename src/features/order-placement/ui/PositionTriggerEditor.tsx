/**
 * TP/SL editor for one open position. Legs close the whole position at fire
 * time ('all'); saving replaces the position's existing legs, since committed
 * terms cannot be edited in place.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { NumberInput } from '@/shared/ui/number-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { formatPrice } from '@/features/orderbook-view/lib/processOrderbook';
import { useReplaceTriggerLegs } from '@/features/order-placement/lib/useReplaceTriggerLegs';
import type { TriggerOrder } from '@/features/trigger-orders/model/useTriggerOrders';
import {
  legTriggerPrice,
  TRIGGER_LATENCY_NOTE,
  toNative,
  type LegMarket,
} from '@/features/trigger-orders/lib/display';

const toNumber = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export function PositionTriggerEditor({
  marketIndex,
  marketName,
  position,
  markPrice,
  legs,
  market,
  quoteUnit,
}: {
  marketIndex: number;
  marketName: string;
  position: 'long' | 'short';
  markPrice: number;
  /** The position's active legs. */
  legs: TriggerOrder[];
  market: LegMarket;
  quoteUnit: string;
}) {
  const replaceTriggerLegs = useReplaceTriggerLegs();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const current = (kind: TriggerOrder['kind']) => {
    const leg = legs.find(l => l.kind === kind);
    return leg ? String(legTriggerPrice(leg, market)) : '';
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setStopLoss(current('stop_loss'));
      setTakeProfit(current('take_profit'));
    }
    setOpen(next);
  };

  // Against the mark: a leg already past its trigger fires on the next poll.
  const long = position === 'long';
  const sl = toNumber(stopLoss);
  const tp = toNumber(takeProfit);
  const problem =
    sl > 0 && (long ? sl >= markPrice : sl <= markPrice)
      ? `Stop loss must be ${long ? 'below' : 'above'} the mark price`
      : tp > 0 && (long ? tp <= markPrice : tp >= markPrice)
        ? `Take profit must be ${long ? 'above' : 'below'} the mark price`
        : null;
  const unchanged = stopLoss === current('stop_loss') && takeProfit === current('take_profit');

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await replaceTriggerLegs({
        marketIndex,
        position,
        legs,
        stopLoss: sl > 0 ? stopLoss : undefined,
        takeProfit: tp > 0 ? takeProfit : undefined,
      });
      if (!saved) return;
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={saving}>
          TP/SL
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-medium">TP/SL for {marketName}</div>
          <div className="text-xs text-zinc-400">
            Closes the whole {position} when the oracle reaches a price. Mark{' '}
            <span className="font-mono tabular-nums text-zinc-100">
              {formatPrice(toNative(markPrice, market.quoteDecimals), market.quoteDecimals)}
            </span>{' '}
            {quoteUnit}.
          </div>
        </div>
        <NumberInput
          name={`tp-${marketIndex}`}
          label="Take Profit"
          value={takeProfit}
          onValueChange={values => setTakeProfit(values.value || '')}
          min={0}
          decimalScale={market.quoteDecimals}
          allowNegative={false}
          unit={quoteUnit}
        />
        <NumberInput
          name={`sl-${marketIndex}`}
          label="Stop Loss"
          value={stopLoss}
          onValueChange={values => setStopLoss(values.value || '')}
          min={0}
          decimalScale={market.quoteDecimals}
          allowNegative={false}
          unit={quoteUnit}
        />
        <p className={`text-xs ${problem ? 'text-red-400' : 'text-zinc-400'}`}>
          {problem ?? TRIGGER_LATENCY_NOTE}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !!problem || unchanged}
            onClick={handleSave}
          >
            {saving ? (
              <>
                <Loader2 className="size-3 animate-spin mr-1" />
                Saving...
              </>
            ) : sl > 0 || tp > 0 ? (
              'Save'
            ) : (
              'Remove TP/SL'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
