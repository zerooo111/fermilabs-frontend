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

import { selectedMarketAtom } from '@/entities/market/model';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
} from '@/features/orderbook-view/lib/processOrderbook';
import axios from 'axios';

export function MyOrders() {
  const orderbook = useAtomValue(orderbookAtom);
  const { publicKey, signMessage } = useWallet();
  const [cancellingOrders, setCancellingOrders] = useState<Set<number>>(new Set());
  const selectedMarket = useAtomValue(selectedMarketAtom);

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

      const cancelData = {
        order_id: new BN(orderId).toNumber(),
        owner: publicKey.toBase58(),
        market_id: selectedMarket?.uuid,
        signature: '', // Will be filled after signing
        local_sequencer_id: 'continuum_client',
        timestamp_ms: Date.now().toString(),
      };

      const frmTransactionForSigning = {
        version: '1.0',
        type: 'cancel',
        order_id: cancelData.order_id,
        owner: cancelData.owner,
        market_id: cancelData.market_id,
        local_sequencer_id: cancelData.local_sequencer_id,
        timestamp_ms: cancelData.timestamp_ms,
      };

      // Serialize and sign the transaction data
      const serializedData = Buffer.from(JSON.stringify(frmTransactionForSigning), 'utf-8');
      const sha256Hash = createHash('sha256').update(new Uint8Array(serializedData)).digest();
      const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');
      const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));

      // Update the cancel data with signature
      cancelData.signature = Buffer.from(signatureBytes).toString('hex');

      // Create the complete FRM transaction
      const frmTransaction = {
        version: '1.0',
        type: 'cancel',
        order_id: cancelData.order_id,
        owner: cancelData.owner,
        market_id: cancelData.market_id,
        signature: cancelData.signature,
        local_sequencer_id: cancelData.local_sequencer_id,
        timestamp_ms: cancelData.timestamp_ms,
      };

      // Create the prefixed payload for continuum
      const jsonFrm = JSON.stringify(frmTransaction);
      const frmPrefixedString = `FRM_v1.0:${jsonFrm}`;
      const payloadBytes = Buffer.from(frmPrefixedString, 'utf-8');

      // Generate transaction ID
      const tx_id = `frm_cancel_${orderId.toString()}_${Date.now()}`;

      // Create the transaction data for continuum submission
      const transactionData = {
        version: '1.0',
        tx_id,
        payload: Array.from(payloadBytes),
        signature: Buffer.from(signatureBytes).toString('hex'),
        public_key: publicKey,
        nonce: cancelData.order_id,
        timestamp: cancelData.timestamp_ms,
      };

      // Submit to continuum via the explorer API
      await axios
        .post('https://explorer.fermilabs.xyz/api/v1/tx', {
          transaction: transactionData,
        })
        .then(res => res.data);

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
