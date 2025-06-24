/**
 * My orders component
 * Displays the user's active orders
 */
import { orderbookAtom } from '@/entities/orderbook';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { createHash } from 'crypto';
import { BN } from '@coral-xyz/anchor';
import { toast } from 'sonner';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { selectedMarketAtom } from '@/entities/market/model';
import { orderReceiptsAtom } from '@/entities/order-receipt';
import { OrderReceipt } from './OrderReceipt';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
} from '@/features/orderbook-view/lib/processOrderbook';

export function MyOrders() {
  const orderbook = useAtomValue(orderbookAtom);
  const { publicKey, signMessage } = useWallet();
  const [cancellingOrders, setCancellingOrders] = useState<Set<number>>(new Set());
  const { submitCancelOrderToSequencer } = useSequencerApi();
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const orderReceipts = useAtomValue(orderReceiptsAtom);

  const myOrders = useMemo(() => {
    if (!orderbook || !publicKey) return [];
    // Concatenate buys and sells
    const allOrders = [...orderbook.buys, ...orderbook.sells];

    return allOrders
      .filter(order => order.owner === publicKey?.toBase58())
      .filter(order => !cancellingOrders.has(order.order_id));
  }, [orderbook, publicKey, cancellingOrders]);

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  const cancelOrder = async (orderId: number) => {
    try {
      if (!signMessage) return;

      // Optimistically update UI
      setCancellingOrders(prev => new Set(prev).add(orderId));

      const message = `FRM_DEX_CANCEL:${new BN(orderId).toString()},${publicKey.toBase58()}`;

      const sha256Hash = createHash('sha256').update(Buffer.from(message)).digest();
      // Hex encode the hash
      const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');

      // Sign the hex encoded hash
      const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));
      const hexSignature = Buffer.from(signatureBytes).toString('hex');

      const body = {
        order_id: new BN(orderId).toNumber(),
        owner: publicKey.toBase58(),
        base_mint: selectedMarket?.base_mint,
        quote_mint: selectedMarket?.quote_mint,
        signature: hexSignature,
      };

      await submitCancelOrderToSequencer(body);
      toast.success('Order cancelled');
    } catch (error) {
      console.error(error);
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

    return myOrders.map(order => {
      return (
        <TableRow key={order.order_id} className="text-xs text-white/75">
          <TableCell>{order.order_id}</TableCell>
          <TableCell>
            <Badge variant={order.side === 'Buy' ? 'success' : 'danger'}>{order.side}</Badge>
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {formatPrice(order.price)} {selectedMarket?.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {formatQuantity(order.quantity)} {selectedMarket?.baseTokenName}
          </TableCell>
          <TableCell className="font-mono tabular-nums">
            {formatTotal(order.price, order.quantity)} {selectedMarket?.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono">
            {new Date(order.expiry).toLocaleString(undefined, {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex gap-1.5 justify-end">
              {orderReceipts.has(order.order_id) && (
                <OrderReceipt receipt={orderReceipts.get(order.order_id)!} />
              )}
              <Button
                onClick={() => cancelOrder(order.order_id)}
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
