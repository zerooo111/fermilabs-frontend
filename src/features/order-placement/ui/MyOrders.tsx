/**
 * My orders component
 * Displays the user's active orders
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { createHash } from 'crypto';
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { useSelectedMarket } from '@/entities/market';
import { CancelOrderData } from '@/features/order-placement/lib/CancelOrderData';
import { orderReceiptsAtom } from '@/entities/order-receipt';
import { OrderReceipt } from './OrderReceipt';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
} from '@/features/orderbook-view/lib/processOrderbook';
import axios from 'axios';
import { baseMint, quoteMint, config, API_ROUTES } from '@/shared/config/constants';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useQuery } from '@tanstack/react-query';

export function MyOrders() {
  const { publicKey, signMessage } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const orderReceipts = useAtomValue(orderReceiptsAtom);
  const { fetchUserOrders } = useSequencerApi();

  const { data: userOrders } = useQuery({
    queryKey: ['userOrders', publicKey?.toBase58(), selectedMarket?.uuid],
    queryFn: async () => {
      if (!publicKey) return [];
      return await fetchUserOrders(publicKey.toBase58());
    },
    enabled: !!publicKey && !!selectedMarket,
    refetchInterval: 1000, // Refetch every 1 second
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  useEffect(() => {
    // User orders effect
  }, [userOrders]);

  const myOrders = useMemo(() => {
    if (!userOrders || !publicKey) return [];

    return userOrders.filter(order => order.market_id === selectedMarket?.uuid);
  }, [userOrders, publicKey, selectedMarket?.uuid]);

  // Helper function to find receipt by order_id
  const getReceiptForOrder = (orderId: number) => {
    // Find receipt by matching order_id
    for (const [, receipt] of orderReceipts.entries()) {
      if (receipt.order_id === orderId) {
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

  const cancelOrder = async (orderId: number) => {
    try {
      if (!signMessage) return;

      const baseMintAddress = selectedMarket?.base_mint || baseMint.toBase58();
      const quoteMintAddress = selectedMarket?.quote_mint || quoteMint.toBase58();

      // Build the CancelOrderData struct matching the rollup spec
      const cancelOrderData = new CancelOrderData(
        new BN(orderId),
        publicKey,
        new PublicKey(baseMintAddress),
        new PublicKey(quoteMintAddress)
      );

      // Borsh-serialize and sign per spec:
      // message = b"FRM_DEX_CANCEL:" || borsh_serialize(CancelOrderData)
      const serializedData = CancelOrderData.serialize(cancelOrderData);
      const SIGNED_CANCEL_PREFIX = Buffer.from('FRM_DEX_CANCEL:');
      const prefixedMessage = Buffer.concat([SIGNED_CANCEL_PREFIX, serializedData]);
      const sha256Hash = createHash('sha256').update(new Uint8Array(prefixedMessage)).digest();
      const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');
      const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));
      const signatureHex = Buffer.from(signatureBytes).toString('hex');
      const timestampMs = Date.now().toString();

      // Build the FRM transaction with cancel fields at top level
      const frmTransaction = {
        version: '1.0',
        type: 'cancel',
        order_id: orderId,
        owner: publicKey.toBase58(),
        market_id: selectedMarket?.uuid,
        signature: signatureHex,
        local_sequencer_id: 'continuum_client',
        timestamp_ms: timestampMs,
      };

      const jsonFrm = JSON.stringify(frmTransaction);
      const frmPrefixedString = `FRM_v1.0:${jsonFrm}`;
      const payloadBytes = Buffer.from(frmPrefixedString, 'utf-8');

      const tx_id = `frm_cancel_${orderId.toString()}_${Date.now()}`;

      const transactionData = {
        version: '1.0',
        tx_id,
        payload: Array.from(payloadBytes),
        signature: signatureHex,
        public_key: publicKey,
        nonce: orderId,
        timestamp: timestampMs,
      };

      const apiBaseUrl = config.devnet.apiBaseUrl;
      await axios.post(`${apiBaseUrl}${API_ROUTES.tx}`, {
        transaction: transactionData,
      });

      toast.success('Order cancelled');
    } catch {
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
              {getReceiptForOrder(order.order_id) && (
                <OrderReceipt receipt={getReceiptForOrder(order.order_id)!} />
              )}
              <Button onClick={() => cancelOrder(order.order_id)} variant="outline" size="sm">
                Cancel
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
