/**
 * useReplaceTriggerLegs.ts
 * Sets a position's TP/SL to new prices. Committed leg terms cannot be edited
 * in place, so this places fresh legs (one OCO bracket when both are set) and
 * then cancels the old ones by id. Used by the positions-table editor and by
 * dragging the lines on the chart.
 */
import { useCallback } from 'react';
import { usePerps } from './usePerps';
import type { TriggerOrder } from '@/features/trigger-orders/model/useTriggerOrders';
import { TRIGGER_EXPIRY_SECS, TRIGGER_SLIPPAGE_BPS } from '@/features/trigger-orders/lib/display';

export interface ReplaceTriggerLegsParams {
  marketIndex: number;
  position: 'long' | 'short';
  /** The position's active legs, all replaced. */
  legs: TriggerOrder[];
  /** UI price strings; empty or undefined leaves that side unset. */
  stopLoss?: string;
  takeProfit?: string;
}

export function useReplaceTriggerLegs() {
  const { placeTriggerLegs, cancelTriggerLegs } = usePerps();

  return useCallback(
    async ({
      marketIndex,
      position,
      legs,
      stopLoss,
      takeProfit,
    }: ReplaceTriggerLegsParams): Promise<boolean> => {
      const placing = !!stopLoss || !!takeProfit;
      // New legs first, then drop the old ones by id: a failed placement
      // leaves the old protection in place rather than none.
      if (placing) {
        const result = await placeTriggerLegs({
          marketIndex,
          position,
          size: 'all',
          stopLoss: stopLoss || undefined,
          takeProfit: takeProfit || undefined,
          slippageBps: TRIGGER_SLIPPAGE_BPS,
          expiresInSecs: TRIGGER_EXPIRY_SECS,
        });
        if (!result.success) return false;
      }
      if (legs.length > 0) {
        const cancel = await cancelTriggerLegs(
          { scope: 'ids', clientOrderIds: legs.map(l => BigInt(l.client_order_id)) },
          { silent: placing }
        );
        if (!cancel.success) return false;
      }
      return true;
    },
    [placeTriggerLegs, cancelTriggerLegs]
  );
}
