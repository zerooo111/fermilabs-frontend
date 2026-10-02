/**
 * My triggers component
 * Displays the account's active stop-loss / take-profit legs on every market
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { marketsAtom } from '@/entities/market/model';
import { formatPrice, formatQuantity } from '@/features/orderbook-view/lib/processOrderbook';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { useTriggerOrders } from '@/features/trigger-orders/model/useTriggerOrders';
import {
  LEG_STATE_LABEL,
  legSize,
  legTriggerPrice,
  toNative,
  TRIGGER_LATENCY_NOTE,
} from '@/features/trigger-orders/lib/display';

export function MyTriggerOrders() {
  const { publicKey } = useWallet();
  const markets = useAtomValue(marketsAtom);
  const { data: orders, isLoading, isError } = useTriggerOrders();
  const { cancelTriggerLegs } = usePerps();
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  const marketsMap = useMemo(() => new Map(markets.map(m => [m.uuid, m])), [markets]);

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  const handleCancel = async (id: string, clientOrderId: string) => {
    setCancelling(prev => new Set(prev).add(id));
    try {
      await cancelTriggerLegs({ scope: 'ids', clientOrderIds: [BigInt(clientOrderId)] });
    } finally {
      setCancelling(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading triggers...
            </div>
          </TableCell>
        </TableRow>
      );
    }
    if (isError || !orders || orders.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-sm text-neutral-500">
            {isError ? 'Triggers unavailable right now' : 'No active stop loss or take profit'}
          </TableCell>
        </TableRow>
      );
    }

    return orders.map(order => {
      const market = marketsMap.get(String(order.market_index));
      const lots = market && {
        baseDecimals: market.base_decimals,
        quoteDecimals: market.quote_decimals,
        baseLotSize: market.base_lot_size,
        quoteLotSize: market.quote_lot_size,
      };
      const size = lots ? legSize(order, lots) : null;
      const isCancelling = cancelling.has(order.id);
      return (
        <TableRow key={order.id} className="text-xs text-white/75">
          <TableCell className="font-medium">{market?.name ?? `#${order.market_index}`}</TableCell>
          <TableCell>
            <Badge variant={order.kind === 'stop_loss' ? 'danger' : 'success'}>
              {order.kind === 'stop_loss' ? 'Stop loss' : 'Take profit'}
            </Badge>
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {order.direction === 'at_or_above' ? '≥ ' : '≤ '}
            {lots
              ? formatPrice(
                  toNative(legTriggerPrice(order, lots), lots.quoteDecimals),
                  lots.quoteDecimals
                )
              : '-'}{' '}
            {market?.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {order.side === 'ask' ? 'Sell ' : 'Buy '}
            {size === null
              ? 'all'
              : `${formatQuantity(toNative(size, lots?.baseDecimals ?? 0), lots?.baseDecimals ?? 0)} ${market?.baseTokenName ?? ''}`}
          </TableCell>
          <TableCell>{LEG_STATE_LABEL[order.state] ?? order.state}</TableCell>
          <TableCell className="font-mono">
            {new Date(order.expiry_ts * 1000).toLocaleString(undefined, {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </TableCell>
          <TableCell className="text-right">
            <Button
              onClick={() => handleCancel(order.id, order.client_order_id)}
              variant="outline"
              size="sm"
              disabled={isCancelling || order.state === 'firing'}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{renderTableContent()}</TableBody>
      </Table>
      <p className="px-4 py-2 text-[11px] text-neutral-500">{TRIGGER_LATENCY_NOTE}</p>
    </div>
  );
}
