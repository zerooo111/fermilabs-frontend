/**
 * My orders component
 * The selected market's open orders: resting book orders, then the stop loss
 * and take profit legs the trigger keeper holds for it
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { toast } from 'sonner';
import { useSelectedMarket } from '@/entities/market';
import { orderReceiptsAtom } from '@/entities/order-receipt';
import { OrderReceipt } from './OrderReceipt';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
} from '@/features/orderbook-view/lib/processOrderbook';
import { userOpenOrdersAtom } from '@/shared/api/sse-atoms';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import {
  useTriggerOrders,
  useTriggerOrdersEnabled,
} from '@/features/trigger-orders/model/useTriggerOrders';
import {
  LEG_STATE_LABEL,
  legSize,
  legTriggerPrice,
  toNative,
} from '@/features/trigger-orders/lib/display';
import { TriggerFacts } from '@/features/trigger-orders/ui/TriggerFacts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export function MyOrders() {
  const { publicKey } = useWallet();
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());
  const { selectedMarket } = useSelectedMarket();
  const orderReceipts = useAtomValue(orderReceiptsAtom);
  const userOrders = useAtomValue(userOpenOrdersAtom);
  const { cancelOrder, cancelTriggerLegs } = usePerps();
  const triggersEnabled = useTriggerOrdersEnabled();
  const { data: triggerOrders } = useTriggerOrders();
  const [cancellingLegs, setCancellingLegs] = useState<Set<string>>(new Set());

  const myLegs = useMemo(() => {
    if (!triggersEnabled || !selectedMarket) return [];
    const marketIndex = parseInt(selectedMarket.uuid, 10);
    return (triggerOrders ?? []).filter(o => o.market_index === marketIndex);
  }, [triggersEnabled, triggerOrders, selectedMarket]);

  const myOrders = useMemo(() => {
    if (!userOrders || !publicKey) return [];

    return userOrders
      .filter(order => order.market_id === selectedMarket?.uuid)
      .filter(order => !cancellingOrders.has(String(order.order_id)))
      .sort((a, b) => Number(BigInt(a.order_id) - BigInt(b.order_id)));
  }, [userOrders, publicKey, selectedMarket?.uuid, cancellingOrders]);

  // Helper function to find receipt by order_id
  const getReceiptForOrder = (orderId: string) => {
    // Find receipt by matching order_id
    for (const [, receipt] of orderReceipts.entries()) {
      if (String(receipt.order_id) === String(orderId)) {
        return receipt;
      }
    }
    return undefined;
  };

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  const handleCancelOrder = async (orderId: string, marketId: string) => {
    try {
      // Optimistically update UI
      setCancellingOrders(prev => new Set(prev).add(orderId));
      const result = await cancelOrder(orderId, marketId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel order');
      }
    } catch {
      // Silent error handling
      // Rollback optimistic update
      setCancellingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      toast.error('Failed to cancel order');
    }
  };

  const handleCancelLeg = async (id: string, clientOrderId: string) => {
    setCancellingLegs(prev => new Set(prev).add(id));
    try {
      await cancelTriggerLegs({ scope: 'ids', clientOrderIds: [BigInt(clientOrderId)] });
    } finally {
      setCancellingLegs(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const renderLegRows = () => {
    if (!selectedMarket) return null;
    const lots = {
      baseDecimals: selectedMarket.baseDecimals,
      quoteDecimals: selectedMarket.quoteDecimals,
      baseLotSize: selectedMarket.base_lot_size,
      quoteLotSize: selectedMarket.quote_lot_size,
    };

    return myLegs.map(leg => {
      const size = legSize(leg, lots);
      const isCancelling = cancellingLegs.has(leg.id);
      const stateLabel = LEG_STATE_LABEL[leg.state] ?? leg.state;
      return (
        <TableRow key={leg.id} className="text-xs text-white/75">
          <TableCell>
            <div className="flex flex-col">
              <span>{leg.kind === 'stop_loss' ? 'Stop loss' : 'Take profit'}</span>
              {leg.state !== 'armed' && (
                <span className="text-[11px] text-rock/50">{stateLabel}</span>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Badge variant={leg.side === 'bid' ? 'success' : 'danger'}>
              {leg.side === 'bid' ? 'Buy' : 'Sell'}
            </Badge>
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-rock/30 decoration-dotted underline-offset-2">
                  {leg.direction === 'at_or_above' ? '≥ ' : '≤ '}
                  {formatPrice(
                    toNative(legTriggerPrice(leg, lots), lots.quoteDecimals),
                    lots.quoteDecimals
                  )}{' '}
                  {selectedMarket.quoteTokenName}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-sans text-xs">
                <span className="mb-1.5 block font-medium">{stateLabel}</span>
                <TriggerFacts />
              </TooltipContent>
            </Tooltip>
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {size === null
              ? 'Entire position'
              : `${formatQuantity(toNative(size, lots.baseDecimals), lots.baseDecimals)} ${selectedMarket.baseTokenName}`}
          </TableCell>
          <TableCell className="font-mono">-</TableCell>
          <TableCell className="font-mono">{fmtDate(leg.expiry_ts * 1000)}</TableCell>
          <TableCell className="text-right">
            <Button
              onClick={() => handleCancelLeg(leg.id, leg.client_order_id)}
              variant="outline"
              size="sm"
              disabled={isCancelling || leg.state === 'firing'}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          </TableCell>
        </TableRow>
      );
    });
  };

  const renderTableContent = () => {
    if (myOrders.length === 0 && myLegs.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-sm text-neutral-500">
            No active orders
          </TableCell>
        </TableRow>
      );
    }

    if (!selectedMarket) return null;

    const bookRows = myOrders.map(order => {
      return (
        <TableRow key={order.order_id} className="text-xs text-white/75">
          <TableCell title={`Order ${order.order_id}`}>Limit</TableCell>
          <TableCell>
            <Badge variant={order.side === 'Buy' ? 'success' : 'danger'}>{order.side}</Badge>
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {formatPrice(order.price, selectedMarket.quoteDecimals)} {selectedMarket.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {formatQuantity(order.quantity, selectedMarket.baseDecimals)}{' '}
            {selectedMarket?.baseTokenName}
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {formatTotal(
              order.price,
              order.quantity,
              selectedMarket.quoteDecimals,
              selectedMarket.baseDecimals
            )}{' '}
            {selectedMarket?.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono">
            {order.expiry > 0
              ? new Date(order.expiry).toLocaleString(undefined, {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })
              : '-'}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex gap-1.5 justify-end">
              {getReceiptForOrder(order.order_id) && (
                <OrderReceipt receipt={getReceiptForOrder(order.order_id)!} />
              )}
              <Button
                onClick={() => handleCancelOrder(order.order_id, order.market_id)}
                variant="outline"
                size="sm"
                disabled={cancellingOrders.has(order.order_id)}
              >
                {cancellingOrders.has(order.order_id) ? 'Cancelling...' : 'Cancel'}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    });

    return (
      <>
        {bookRows}
        {renderLegRows()}
      </>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Price ({selectedMarket?.quoteTokenName})</TableHead>
          <TableHead>Size ({selectedMarket?.baseTokenName})</TableHead>
          <TableHead>Total ({selectedMarket?.quoteTokenName})</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderTableContent()}</TableBody>
    </Table>
  );
}
