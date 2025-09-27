/**
 * Perps trade panel component
 * Allows users to place buy and sell orders for perpetual contracts
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useState, useMemo } from 'react';
import {
  PerpOrderIntent,
  OrderSide,
  MarginMode,
} from '@/features/order-placement/lib/PerpOrdersIntent';
import { BN } from '@coral-xyz/anchor';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';
import { baseMint, config, quoteMint } from '@/shared/config/constants';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { NumberInput } from '@/shared/ui/number-input';
import { Slider } from '@/shared/ui/slider';
import { useSelectedMarket } from '@/entities/market';
import { OrderAndBalanceInfo } from './OrderInfoSection';
import { addOrderReceiptAtom } from '@/entities/order-receipt';
import { useSetAtom } from 'jotai';
import axios from 'axios';
import { getLeverageLimitsFromMarket } from '@/entities/market/model';

export function PerpsTradePanel() {
  const [formState, setFormState] = useState<{
    price: string;
    size: string;
    orderType: string;
    leverage: string;
    marginMode: MarginMode;
  }>({
    price: '',
    size: '',
    orderType: 'limit',
    leverage: '1',
    marginMode: 'isolated',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedMarket } = useSelectedMarket();
  const addOrderReceipt = useSetAtom(addOrderReceiptAtom);

  // Get leverage limits from the selected market
  const leverageLimits = useMemo(() => {
    if (selectedMarket) {
      return getLeverageLimitsFromMarket(selectedMarket);
    }
    return null;
  }, [selectedMarket]);

  const handleInputChange = (field: string, value: string | boolean) => {
    console.log('[PerpsTradePanel] Form input changed:', { field, value });
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitOrder = async (side: OrderSide) => {
    console.log('[PerpsTradePanel] Starting order submission', {
      side,
      formState,
      hasWallet: !!publicKey,
      hasSignMessage: !!signMessage,
    });

    if (!signMessage || !publicKey) {
      console.log('[PerpsTradePanel] Wallet not connected - opening modal');
      setVisible(true);
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[PerpsTradePanel] Creating order intent...');
      const orderId = new BN(Date.now());

      // Convert form values to proper BN values with decimal scaling
      const leverageNum = parseFloat(formState.leverage);

      // Apply decimal scaling based on token types
      const priceDecimals = selectedMarket?.quoteTokenName?.toUpperCase() === 'USDC' ? 6 : 9;
      const sizeDecimals = selectedMarket?.baseTokenName?.toUpperCase() === 'USDC' ? 6 : 9;

      const priceValue = parseFloat(formState.price);
      const sizeValue = parseFloat(formState.size);

      const priceBN = new BN(Math.floor(priceValue * Math.pow(10, priceDecimals)));
      const sizeBN = new BN(Math.floor(sizeValue * Math.pow(10, sizeDecimals)));

      console.log('[PerpsTradePanel] BN values:', {
        price: priceBN.toString(),
        size: sizeBN.toString(),
        priceDecimals,
        sizeDecimals,
        priceValue,
        sizeValue,
        leverageNum,
      });

      const baseMintAddress = selectedMarket?.base_mint || baseMint.toBase58();
      const quoteMintAddress = selectedMarket?.quote_mint || quoteMint.toBase58();

      console.log('[PerpsTradePanel] Mint addresses:', {
        baseMintAddress,
        quoteMintAddress,
      });

      const orderIntent = new PerpOrderIntent(
        orderId,
        publicKey,
        side,
        priceBN,
        sizeBN,
        new BN(Math.floor(Date.now() / 1000) + 86400), // 24 hours expiry
        new PublicKey(baseMintAddress),
        new PublicKey(quoteMintAddress),
        'perp',
        new BN(leverageNum),
        'open',
        false, // reduce_only - always false for open positions from PerpsTradePanel
        formState.marginMode,
        sizeBN.mul(new BN(leverageNum)), // margin_amount
        false // liquidation
      );

      console.log('[PerpsTradePanel] Order intent created:', {
        order_id: orderIntent.order_id.toString(),
        owner: orderIntent.owner.toBase58(),
        side: orderIntent.side,
        price: orderIntent.price.toString(),
        quantity: orderIntent.quantity.toString(),
        leverage: orderIntent.leverage?.toString(),
        margin_mode: orderIntent.margin_mode,
        reduce_only: orderIntent.reduce_only, // Always false for PerpsTradePanel
      });

      console.log('[PerpsTradePanel] Serializing order intent...');
      const serializedData = PerpOrderIntent.serialize(orderIntent);
      console.log('[PerpsTradePanel] Serialized data length:', serializedData.length, 'bytes');

      console.log('[PerpsTradePanel] Creating hash and signing...');
      const encodedMessage = Buffer.concat([serializedData]);
      const sha256Hash = createHash('sha256').update(new Uint8Array(encodedMessage)).digest();
      const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');
      console.log('[PerpsTradePanel] Hash created:', sha256Hash_hex.substring(0, 16) + '...');

      console.log('[PerpsTradePanel] Requesting signature from wallet...');
      const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));
      console.log('[PerpsTradePanel] Signature received, length:', signatureBytes.length, 'bytes');

      console.log('[PerpsTradePanel] Building FRM transaction...');
      const frmTransaction = {
        version: '1.0',
        type: 'order',
        intent: {
          order_id: orderIntent.order_id.toNumber(),
          owner: orderIntent.owner.toBase58(),
          side: orderIntent.side,
          price: orderIntent.price.toNumber(),
          quantity: orderIntent.quantity.toNumber(),
          expiry: orderIntent.expiry.toNumber(),
          base_mint: orderIntent.base_mint.toBase58(),
          quote_mint: orderIntent.quote_mint.toBase58(),
          market_kind: orderIntent.market_kind,
          leverage: orderIntent.leverage?.toNumber() || 1,
          position_effect: orderIntent.position_effect,
          reduce_only: orderIntent.reduce_only,
          margin_mode: orderIntent.margin_mode,
          margin_amount: orderIntent.margin_amount?.toNumber() || 0,
          liquidation: orderIntent.liquidation,
        },
        signature: Buffer.from(signatureBytes).toString('hex'),
        local_sequencer_id: 'continuum_client',
        timestamp_ms: Date.now().toString(),
      };

      console.log('[PerpsTradePanel] FRM transaction created:', frmTransaction);

      console.log('[PerpsTradePanel] Creating prefixed string and payload...');
      const jsonFrm = JSON.stringify(frmTransaction);
      const frmPrefixedString = `FRM_v1.0:${jsonFrm}`;
      console.log(
        '[PerpsTradePanel] FRM prefixed string length:',
        frmPrefixedString.length,
        'chars'
      );

      const payloadBytes = Buffer.from(frmPrefixedString, 'utf-8');
      const tx_id = `frm_order_${orderIntent.order_id.toString()}_${Date.now()}`;
      console.log('[PerpsTradePanel] Transaction ID:', tx_id);

      console.log('[PerpsTradePanel] Building final transaction data...');
      const transactionData = {
        version: '1.0',
        tx_id,
        payload: Array.from(payloadBytes),
        signature: Buffer.from(signatureBytes).toString('hex'),
        public_key: publicKey,
        nonce: frmTransaction.intent.order_id,
        timestamp: Date.now().toString(),
      };

      console.log('[PerpsTradePanel] Transaction data prepared:', {
        version: transactionData.version,
        tx_id: transactionData.tx_id,
        payload_length: transactionData.payload.length,
        signature_length: transactionData.signature.length,
        public_key: transactionData.public_key.toBase58().substring(0, 8) + '...',
        nonce: transactionData.nonce,
        timestamp: transactionData.timestamp,
      });

      console.log('[PerpsTradePanel] Sending transaction to API...');
      const apiUrl = `${config.devnet.apiBaseUrl}/tx`;
      console.log('[PerpsTradePanel] API endpoint:', apiUrl);

      const response = await axios.post(apiUrl, {
        transaction: transactionData,
      });

      console.log('[PerpsTradePanel] API response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      });

      const receipt = response.data;

      console.log('[PerpsTradePanel] Processing receipt:', receipt);

      if (receipt.sequence_number && receipt.expected_tick && receipt.tx_hash) {
        console.log('[PerpsTradePanel] Valid receipt received, adding to order receipts:', {
          sequence_number: receipt.sequence_number,
          expected_tick: receipt.expected_tick,
          tx_hash: receipt.tx_hash.substring(0, 16) + '...',
          order_id: orderIntent.order_id.toNumber(),
        });

        addOrderReceipt({
          sequence_number: receipt.sequence_number,
          expected_tick: receipt.expected_tick,
          tx_hash: receipt.tx_hash,
          order_id: orderIntent.order_id.toNumber(),
        });

        console.log('[PerpsTradePanel] Order receipt added successfully');
      } else {
        console.warn('[PerpsTradePanel] Receipt missing required fields:', {
          has_sequence_number: !!receipt.sequence_number,
          has_expected_tick: !!receipt.expected_tick,
          has_tx_hash: !!receipt.tx_hash,
          receipt_keys: Object.keys(receipt),
        });
      }

      console.log('[PerpsTradePanel] Order submission completed successfully');
      toast.success(`${side} order placed successfully`);

      // Reset form
      setFormState(prev => ({
        ...prev,
        price: '',
        size: '',
      }));

      console.log('[PerpsTradePanel] Form reset completed');
    } catch (error) {
      console.error('[PerpsTradePanel] Order submission failed:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        formState,
        side,
      });
      toast.error('Failed to place order');
    } finally {
      console.log('[PerpsTradePanel] Setting isSubmitting to false');
      setIsSubmitting(false);
    }
  };

  // Calculate order value considering decimal inputs
  const orderValue = parseFloat(formState.price) * parseFloat(formState.size) || 0;

  return (
    <div className="flex flex-col w-xs overflow-hidden">
      <Tabs
        value={formState.orderType}
        onValueChange={value => handleInputChange('orderType', value)}
      >
        <TabsList className="w-full border-b border-outline">
          <TabsTrigger value="limit" className="flex-1">
            Limit
          </TabsTrigger>
          <TabsTrigger value="market" className="flex-1">
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
          min={0.01}
          placeholder="0.00"
          required
          unit={selectedMarket?.quoteTokenName}
          decimalScale={getTokenDecimals(selectedMarket?.quoteTokenName)}
          allowNegative={false}
          disabled={formState.orderType === 'market'}
        />

        <NumberInput
          id="size"
          name="size"
          label="Size"
          value={formState.size}
          min={0.01}
          onValueChange={values => setFormState(prev => ({ ...prev, size: values.value || '' }))}
          placeholder="0.00"
          required
          unit={selectedMarket?.baseTokenName}
          decimalScale={getTokenDecimals(selectedMarket?.baseTokenName)}
          allowNegative={false}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Leverage</label>
            <span className="text-sm text-muted-foreground">{formState.leverage}x</span>
          </div>
          <Slider
            value={[parseFloat(formState.leverage) || 1]}
            onValueChange={([value]) => handleInputChange('leverage', value.toString())}
            min={leverageLimits?.min ?? 0}
            max={leverageLimits?.max ?? 1}
            step={1}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Margin Mode</label>
          <Select
            value={formState.marginMode}
            onValueChange={value => handleInputChange('marginMode', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select margin mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="isolated">Isolated</SelectItem>
              <SelectItem value="Cross">Cross</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!publicKey ? (
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
              disabled={!formState.price || !formState.size || isSubmitting}
              variant="success"
              onClick={() => handleSubmitOrder('Buy')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Buying...
                </>
              ) : (
                'Buy / Long'
              )}
            </Button>
            <Button
              variant="destructive"
              disabled={!formState.price || !formState.size || isSubmitting}
              onClick={() => handleSubmitOrder('Sell')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Selling...
                </>
              ) : (
                'Sell / Short'
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
