/**
 * My orders component
 * Displays the user's active orders
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
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
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useQuery } from '@tanstack/react-query';
import { usePerps } from '@/features/order-placement/lib/usePerps';

export function MyOrders() {
  const { publicKey } = useWallet();
  const [cancellingOrders, setCancellingOrders] = useState<Set<string>>(new Set());
  const { selectedMarket } = useSelectedMarket();
  const orderReceipts = useAtomValue(orderReceiptsAtom);
  const { fetchUserOrders } = useSequencerApi();
  const { cancelOrder } = usePerps();

  const { data: userOrders } = useQuery({
    queryKey: ['userOrders', publicKey?.toBase58(), selectedMarket?.uuid],
    queryFn: async () => {
      if (!publicKey) return [];
      return await fetchUserOrders(
        publicKey.toBase58(),
        selectedMarket?.uuid,
        selectedMarket || undefined
      );
    },
    enabled: !!publicKey && !!selectedMarket,
    refetchInterval: 500, // Refetch every 0.5 seconds
    staleTime: 500, // Keep cache fresh when switching tabs
  });

  useEffect(() => {
    // User orders effect
  }, [userOrders]);

  const myOrders = useMemo(() => {
    if (!userOrders || !publicKey) return [];

    return userOrders
      .filter(order => order.market_id === selectedMarket?.uuid)
      .filter(order => !cancellingOrders.has(String(order.order_id)));
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

  const handleCancelOrder = async (orderId: string) => {
    try {
      // Optimistically update UI
      setCancellingOrders(prev => new Set(prev).add(orderId));
      const result = await cancelOrder(orderId);
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

  const renderTableContent = () => {
    if (myOrders.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-sm text-neutral-500">
            No active orders
          </TableCell>
        </TableRow>
      );
    }

    if (!selectedMarket) return null;

    return myOrders.map(order => {
      return (
        <TableRow key={order.order_id} className="text-xs text-white/75">
          <TableCell>{order.order_id}</TableCell>
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
                onClick={() => handleCancelOrder(order.order_id)}
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
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
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
