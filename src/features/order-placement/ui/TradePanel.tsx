/**
 * Trade panel component
 * Allows users to place buy and sell orders
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { useState } from 'react';
import { OrderIntent } from '@/features/order-placement/lib/OrderIntent';
import { createHash } from 'crypto';
import { BN } from '@coral-xyz/anchor';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { baseMint, config, quoteMint } from '@/shared/config/constants';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { NumberInput } from '@/shared/ui/number-input';
import { useSelectedMarket } from '@/entities/market';
import { OrderAndBalanceInfo } from './OrderInfoSection';
import { addOrderReceiptAtom } from '@/entities/order-receipt';
import { useSetAtom } from 'jotai';
import axios from 'axios';

/**
 * Converts a decimal string to a scaled BN
 * @param value Decimal string (e.g. "123.45")
 * @param decimals Number of decimal places to scale by
 * @returns BN instance scaled by 10^decimals
 */
const decimalToBN = (value: string, decimals: number): BN => {
  try {
    // Remove any trailing zeros after decimal point
    const trimmed = value.trim();
    if (!trimmed) return new BN(0);

    // Split into integer and decimal parts
    const [integerPart = '0', decimalPart = ''] = trimmed.split('.');

    // Combine parts and pad with zeros
    const combined = integerPart + decimalPart.padEnd(decimals, '0');

    // Remove leading zeros to avoid interpretation as octal
    const normalized = combined.replace(/^0+/, '') || '0';

    return new BN(normalized);
  } catch {
    // Silent error handling
    return new BN(0);
  }
};

export function TradePanel() {
  const [formState, setFormState] = useState({
    price: '',
    size: '',
    orderType: 'limit',
  });
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const { selectedMarket } = useSelectedMarket();
  const addOrderReceipt = useSetAtom(addOrderReceiptAtom);

  const { signMessage, publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const placeOrderIntent = async (intent: OrderIntent) => {
    if (!signMessage || !publicKey) throw new Error('Wallet not connected!');

    // Create payload for signing (keep this part as-is)
    const serializedData = OrderIntent.serialize(intent);
    // const prefix = Buffer.from('FRM_v1.0:');

    const encodedMessage = Buffer.concat([serializedData]);
    const sha256Hash = createHash('sha256').update(new Uint8Array(encodedMessage)).digest();
    const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');
    const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));
    const frmTransaction = {
      version: '1.0',
      type: 'order',
      intent: {
        order_id: intent.order_id.toNumber(),
        owner: intent.owner.toBase58(),
        side: intent.side,
        price: intent.price.toNumber(),
        quantity: intent.quantity.toNumber(),
        expiry: intent.expiry.toNumber(),
        base_mint: intent.base_mint.toBase58(),
        quote_mint: intent.quote_mint.toBase58(),
      },
      signature: Buffer.from(signatureBytes).toString('hex'),
      local_sequencer_id: 'continuum_client',
      timestamp_ms: Date.now().toString(),
    };

    console.log(frmTransaction);

    const jsonFrm = JSON.stringify(frmTransaction);
    const frmPrefixedString = `FRM_v1.0:${jsonFrm}`;

    const payloadBytes = Buffer.from(frmPrefixedString, 'utf-8');
    const tx_id = `frm_order_${intent.order_id.toString()}_${Date.now()}`;

    const transactionData = {
      version: '1.0',
      tx_id,
      payload: Array.from(payloadBytes),
      signature: Buffer.from(signatureBytes).toString('hex'),
      public_key: publicKey,
      nonce: frmTransaction.intent.order_id,
      timestamp: Date.now().toString(),
    };

    // const receipt = await submitOrderToSequencer(transactionData);
    const receipt = await axios
      .post(`${config.devnet.apiBaseUrl}/api/v1/tx`, {
        transaction: transactionData,
      })
      .then(res => res.data);

    if (receipt.sequence_number && receipt.expected_tick && receipt.tx_hash) {
      addOrderReceipt({
        sequence_number: receipt.sequence_number,
        expected_tick: receipt.expected_tick,
        tx_hash: receipt.tx_hash,
        order_id: intent.order_id.toNumber(),
      });
    }

    return receipt;
  };

  const placeSellOrder = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    try {
      setIsSelling(true);
      if (!publicKey) throw new Error('Wallet not connected!');

      // Generate a unique order ID
      const orderId = new BN(Date.now() * 1000 + Math.floor(Math.random() * 1000));

      const baseMintPubkey = selectedMarket ? new PublicKey(selectedMarket.base_mint) : baseMint;
      const quoteMintPubkey = selectedMarket ? new PublicKey(selectedMarket.quote_mint) : quoteMint;

      // Convert decimal strings to scaled BNs using dynamic decimals based on token name
      const quoteDecimals = getTokenDecimals(selectedMarket?.quoteTokenName);
      const baseDecimals = getTokenDecimals(selectedMarket?.baseTokenName);
      const priceBN = decimalToBN(formState.price, quoteDecimals);
      const sizeBN = decimalToBN(formState.size, baseDecimals);

      const intent = new OrderIntent(
        orderId,
        publicKey,
        'Sell',
        priceBN,
        sizeBN,
        new BN(Date.now() + 60 * 60 * 1000),
        baseMintPubkey,
        quoteMintPubkey
      );

      await placeOrderIntent(intent);
      toast.success('Sell Order placed');
    } catch {
      // Silent error handling
      toast.error('Failed to place order');
    } finally {
      setIsSelling(false);
    }
  };

  const placeBuyOrder = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    try {
      setIsBuying(true);
      if (!publicKey) throw new Error('Wallet not connected!');

      // Generate a unique order ID
      const orderId = new BN(Date.now() * 1000 + Math.floor(Math.random() * 1000));

      const baseMintPubkey = selectedMarket ? new PublicKey(selectedMarket.base_mint) : baseMint;
      const quoteMintPubkey = selectedMarket ? new PublicKey(selectedMarket.quote_mint) : quoteMint;

      // Convert decimal strings to scaled BNs using dynamic decimals based on token name
      const quoteDecimals = getTokenDecimals(selectedMarket?.quoteTokenName);
      const baseDecimals = getTokenDecimals(selectedMarket?.baseTokenName);
      const priceBN = decimalToBN(formState.price, quoteDecimals);
      const sizeBN = decimalToBN(formState.size, baseDecimals);

      const intent = new OrderIntent(
        orderId,
        publicKey,
        'Buy',
        priceBN,
        sizeBN,
        new BN(Date.now() + 60 * 60 * 1000),
        baseMintPubkey,
        quoteMintPubkey
      );

      await placeOrderIntent(intent);
      toast.success('Buy Order placed');
    } catch {
      // Silent error handling
      toast.error('Failed to place order');
    } finally {
      setIsBuying(false);
    }
  };

  // Calculate order value considering decimal inputs
  const orderValue = parseFloat(formState.price) * parseFloat(formState.size) || 0;

  return (
    <div className="flex flex-col w-xs overflow-hidden">
      <Tabs defaultValue="limit">
        <TabsList className="w-full border-b border-outline">
          <TabsTrigger value="limit" className="flex-1">
            Limit
          </TabsTrigger>
          <TabsTrigger value="market" className="flex-1" disabled>
            Market
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col p-3 gap-3 flex-1">
        <NumberInput
          id="price"
          name="price"
          label="Price"
          value={formState.price}
          onValueChange={values => setFormState(prev => ({ ...prev, price: values.value || '' }))}
          min={0}
          placeholder="0.00"
          required
          unit={selectedMarket?.quoteTokenName}
          decimalScale={getTokenDecimals(selectedMarket?.quoteTokenName)}
          allowNegative={false}
        />

        <NumberInput
          id="size"
          name="size"
          label="Size"
          value={formState.size}
          onValueChange={values => setFormState(prev => ({ ...prev, size: values.value || '' }))}
          min={0}
          placeholder="0.00"
          required
          unit={selectedMarket?.baseTokenName}
          decimalScale={getTokenDecimals(selectedMarket?.baseTokenName)}
          allowNegative={false}
        />

        {!connected ? (
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => setVisible(true)}
          >
            <Wallet className="size-4" />
            Connect Wallet to Trade
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="success"
              disabled={!formState.price || !formState.size || isBuying}
              onClick={placeBuyOrder}
            >
              {isBuying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Buying...
                </>
              ) : (
                'Buy'
              )}
            </Button>
            <Button
              variant="destructive"
              disabled={!formState.price || !formState.size || isSelling}
              onClick={placeSellOrder}
            >
              {isSelling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Selling...
                </>
              ) : (
                'Sell'
              )}
            </Button>
          </div>
        )}
        <div className="font-medium bg-card border border-outline p-2 text-xs space-y-1 mt-auto">
          <OrderAndBalanceInfo orderValue={orderValue} />
        </div>
      </div>
    </div>
  );
}
