import orderbookAtom from '@/atoms/orderbook';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { createHash } from 'crypto';
import { BN } from '@coral-xyz/anchor';

import { submitCancelOrderToSequencer } from '@/lib/sequencer';
import { toast } from 'sonner';

export default function MyOrders() {
  const orderbook = useAtomValue(orderbookAtom);
  const { publicKey, signMessage } = useWallet();
  const [cancellingOrders, setCancellingOrders] = useState<Set<number>>(new Set());

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
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  if (myOrders.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium">My Orders</h2>
        <div className="text-sm text-muted-foreground">No active orders</div>
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
        signature: hexSignature,
      };

      const response = await submitCancelOrderToSequencer(body);
      console.log('Order cancelled', { response });
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

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-lg font-medium">My Orders</h2>
      <div className="rounded-md border w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-accent rounded-tl-md">Order ID</TableHead>
              <TableHead className="bg-accent">Side</TableHead>
              <TableHead className="bg-accent">Price</TableHead>
              <TableHead className="bg-accent">Size</TableHead>
              <TableHead className="bg-accent">Expiry</TableHead>
              <TableHead className="bg-accent text-right rounded-tr-md">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myOrders.map(order => (
              <TableRow key={order.order_id} className="text-xs">
                <TableCell>{order.order_id}</TableCell>
                <TableCell>
                  <Badge variant={order.side === 'Buy' ? 'success' : 'danger'}>{order.side}</Badge>
                </TableCell>
                <TableCell className="font-mono">
                  {Number(order.price / 10 ** 9).toPrecision(4)}
                </TableCell>
                <TableCell className="font-mono">
                  {Number(order.quantity / 10 ** 9).toPrecision(4)}
                </TableCell>
                <TableCell className="font-mono">
                  {new Date(order.expiry).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <div className="flex gap-1.5 justify-end">
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
