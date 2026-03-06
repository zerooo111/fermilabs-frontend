import {
  PerpLimitOrderIntent,
  OrderSide,
  MarginMode,
} from '@/features/order-placement/lib/PerpLimitOrderIntent';
import { PerpMarketOrderIntent } from '@/features/order-placement/lib/PerpMarketOrderIntent';
import { BN } from '@coral-xyz/anchor';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';
import { baseMint, config, quoteMint, API_ROUTES } from '@/shared/config/constants';
import { useSelectedMarket } from '@/entities/market';
import { addOrderReceiptAtom } from '@/entities/order-receipt';
import { useSetAtom } from 'jotai';
import axios from 'axios';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';

interface PerpsSubmitOrderParams {
  side: OrderSide;
  price: string;
  size: string;
  leverage: string;
  marginMode: MarginMode;
  stopLoss?: string;
  takeProfit?: string;
}

interface PerpsMarketOrderParams {
  side: OrderSide;
  size: string;
  leverage: string;
  marginMode: MarginMode;
  maxSlippageBps: number;
  markPrice: number;
}

export function usePerps() {
  const { publicKey, signMessage } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const addOrderReceipt = useSetAtom(addOrderReceiptAtom);

  const signAndSubmit = async (
    serializedData: Buffer,
    intentJson: Record<string, unknown>,
    orderId: BN
  ): Promise<{ success: boolean; error?: string }> => {
    if (!signMessage || !publicKey) {
      throw new Error('Wallet not connected');
    }

    const SIGNED_ORDER_PREFIX = Buffer.from('FRM_DEX_ORDER:');
    const prefixedMessage = Buffer.concat([SIGNED_ORDER_PREFIX, serializedData]);
    const sha256Hash = createHash('sha256').update(new Uint8Array(prefixedMessage)).digest();
    const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');

    const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));
    const frmTransaction = {
      version: '1.0',
      type: 'order',
      intent: intentJson,
      signature: Buffer.from(signatureBytes).toString('hex'),
      local_sequencer_id: 'continuum_client',
      timestamp_ms: Date.now().toString(),
    };

    console.log('frmTransaction', frmTransaction);
    const jsonFrm = JSON.stringify(frmTransaction);
    const frmPrefixedString = `FRM_v1.0:${jsonFrm}`;

    const payloadBytes = Buffer.from(frmPrefixedString, 'utf-8');
    const tx_id = `frm_order_${orderId.toString()}_${Date.now()}`;
    const transactionData = {
      version: '1.0',
      tx_id,
      payload: Array.from(payloadBytes),
      signature: Buffer.from(signatureBytes).toString('hex'),
      public_key: publicKey,
      nonce: orderId.toNumber(),
      timestamp: Date.now().toString(),
    };

    const apiUrl = `${config.devnet.apiBaseUrl}${API_ROUTES.tx}`;

    const response = await axios.post(apiUrl, {
      transaction: transactionData,
    });

    console.log('TX RESPONSE', response.data);
    const receipt = response.data;

    if (receipt.sequence_number && receipt.expected_tick && receipt.tx_hash) {
      addOrderReceipt({
        sequence_number: receipt.sequence_number,
        expected_tick: receipt.expected_tick,
        tx_hash: receipt.tx_hash,
        order_id: orderId.toNumber(),
      });
    }

    return { success: true };
  };

  const openPosition = async ({
    side,
    price,
    size,
    leverage,
    marginMode,
    stopLoss,
    takeProfit,
  }: PerpsSubmitOrderParams): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!signMessage || !publicKey) {
        throw new Error('Wallet not connected');
      }

      if (!selectedMarket) {
        throw new Error('Selected market not found!');
      }

      // Validate input parameters
      const priceValue = parseFloat(price);
      const sizeValue = parseFloat(size);
      const leverageValue = parseFloat(leverage);

      if (isNaN(priceValue) || priceValue <= 0) {
        throw new Error('Invalid price: must be a positive number');
      }

      if (isNaN(sizeValue) || sizeValue <= 0) {
        throw new Error('Invalid size: must be a positive number');
      }

      if (isNaN(leverageValue) || leverageValue < 1) {
        throw new Error('Invalid leverage: must be at least 1');
      }

      const orderId = new BN(Date.now());

      const priceDecimals = new BN(Math.pow(10, selectedMarket?.quoteDecimals));
      const quantityDecimals = new BN(Math.pow(10, selectedMarket?.baseDecimals));

      console.log({ priceDecimals, quantityDecimals });
      const priceBN = new BN(Math.floor(priceValue)).mul(priceDecimals);
      const sizeBN = new BN(Math.floor(sizeValue)).mul(quantityDecimals);

      const baseMintAddress = selectedMarket?.base_mint || baseMint.toBase58();
      const quoteMintAddress = selectedMarket?.quote_mint || quoteMint.toBase58();

      // Calculate margin using the utility function
      const marginResult = calculatePerpMargin({
        price: Math.floor(priceValue), // Raw price without decimals
        quantity: Math.floor(sizeValue), // Raw quantity without decimals
        leverage: leverageValue,
        marketInitialMarginBps: selectedMarket?.perp_config?.initial_margin || 0,
      });

      // Apply quote token decimals to the margin result
      const marginAmount = marginResult.requiredMargin.mul(priceDecimals);

      // Parse and convert stop loss and take profit prices to BN with decimals
      const stopLossBN = stopLoss
        ? new BN(
            Math.floor(parseFloat(stopLoss) * Math.pow(10, selectedMarket?.quoteDecimals || 0))
          )
        : null;
      const takeProfitBN = takeProfit
        ? new BN(
            Math.floor(parseFloat(takeProfit) * Math.pow(10, selectedMarket?.quoteDecimals || 0))
          )
        : null;

      const orderIntent = new PerpLimitOrderIntent(
        orderId,
        publicKey,
        side,
        priceBN,
        sizeBN,
        new BN(3500000000000),
        new PublicKey(baseMintAddress),
        new PublicKey(quoteMintAddress),
        'perp',
        new BN(leverageValue),
        'open',
        false, // reduce_only - always false for open positions from PerpsTradePanel
        marginMode,
        marginAmount, // margin_amount
        false, // liquidation
        stopLossBN, // stop_loss_price
        takeProfitBN // take_profit_price
      );

      const serializedData = PerpLimitOrderIntent.serialize(orderIntent);
      const intentJson = {
        ...orderIntent.toJSON(),
        order_type: 'limit',
      };

      console.log('open position (limit)', intentJson);
      await signAndSubmit(serializedData, intentJson, orderId);

      toast.success(`${side} order placed successfully`);
      return { success: true };
    } catch (error) {
      toast.error('Failed to place order');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const openMarketPosition = async ({
    side,
    size,
    leverage,
    marginMode,
    maxSlippageBps,
    markPrice,
  }: PerpsMarketOrderParams): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!signMessage || !publicKey) {
        throw new Error('Wallet not connected');
      }

      if (!selectedMarket) {
        throw new Error('Selected market not found!');
      }

      const sizeValue = parseFloat(size);
      const leverageValue = parseFloat(leverage);

      if (isNaN(sizeValue) || sizeValue <= 0) {
        throw new Error('Invalid size: must be a positive number');
      }

      if (isNaN(leverageValue) || leverageValue < 1) {
        throw new Error('Invalid leverage: must be at least 1');
      }

      if (!markPrice || markPrice <= 0) {
        throw new Error('Mark price unavailable — cannot place market order');
      }

      const orderId = new BN(Date.now());

      const priceDecimals = new BN(Math.pow(10, selectedMarket?.quoteDecimals));
      const quantityDecimals = new BN(Math.pow(10, selectedMarket?.baseDecimals));
      const sizeBN = new BN(Math.floor(sizeValue)).mul(quantityDecimals);

      // Set price to mark_price * 1.05 for buys, mark_price * 0.95 for sells
      // This gives 5% headroom within the engine's 10% hard cap
      const slippageMultiplier = side === 'Buy' ? 1.05 : 0.95;
      const adjustedPrice = Math.floor(markPrice * slippageMultiplier);
      const priceBN = new BN(adjustedPrice).mul(priceDecimals);

      const baseMintAddress = selectedMarket?.base_mint || baseMint.toBase58();
      const quoteMintAddress = selectedMarket?.quote_mint || quoteMint.toBase58();

      const orderIntent = new PerpMarketOrderIntent(
        orderId,
        publicKey,
        side,
        priceBN,
        sizeBN,
        new BN(3500000000000),
        new PublicKey(baseMintAddress),
        new PublicKey(quoteMintAddress),
        'perp',
        new BN(leverageValue),
        'open',
        false, // reduce_only
        marginMode,
        false, // liquidation
        maxSlippageBps,
        selectedMarket?.uuid ?? null,
        null, // stop_loss_price
        null // take_profit_price
      );

      const serializedData = PerpMarketOrderIntent.serialize(orderIntent);
      const intentJson = orderIntent.toJSON();

      console.log('open position (market)', intentJson);
      await signAndSubmit(serializedData, intentJson, orderId);

      toast.success(`Market ${side} order placed successfully`);
      return { success: true };
    } catch (error) {
      toast.error('Failed to place market order');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const closePosition = async ({
    side,
    price,
    size,
  }: {
    side: OrderSide;
    price: string;
    size: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!signMessage || !publicKey) {
        throw new Error('Wallet not connected');
      }

      if (!selectedMarket) {
        throw new Error('Selected market not found!');
      }

      const orderId = new BN(Date.now());

      // Convert form values to proper BN values with decimal scaling
      const priceValue = parseFloat(price);
      const sizeValue = parseFloat(size);

      // const priceDecimals = new BN(Math.pow(10, selectedMarket?.quoteDecimals));
      // const quantityDecimals = new BN(Math.pow(10, selectedMarket?.baseDecimals));
      // commentintg out decimal part because the positions api gives lamports and wedirectly use that

      const priceBN = new BN(Math.floor(priceValue));
      const sizeBN = new BN(Math.floor(sizeValue));

      const baseMintAddress = selectedMarket?.base_mint || baseMint.toBase58();
      const quoteMintAddress = selectedMarket?.quote_mint || quoteMint.toBase58();

      const orderIntent = new PerpLimitOrderIntent(
        orderId,
        publicKey,
        side,
        priceBN,
        sizeBN,
        new BN(20000000000), // Hardcoded expiry
        new PublicKey(baseMintAddress),
        new PublicKey(quoteMintAddress),
        'perp',
        new BN(1), // leverage doesn't matter for closing
        'close', // position_effect: close
        true, // reduce_only: true for closing positions
        'cross', // margin_mode: cross for closing
        new BN(0), // margin_amount: 0 for closing
        false, // liquidation
        null, // stop_loss_price: null for closing
        null // take_profit_price: null for closing
      );

      const serializedData = PerpLimitOrderIntent.serialize(orderIntent);
      const SIGNED_ORDER_PREFIX = Buffer.from('FRM_DEX_ORDER:');
      const prefixedMessage = Buffer.concat([SIGNED_ORDER_PREFIX, serializedData]);
      const sha256Hash = createHash('sha256').update(new Uint8Array(prefixedMessage)).digest();
      const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');

      const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));
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
          stop_loss_price: orderIntent.stop_loss_price?.toNumber() || null,
          take_profit_price: orderIntent.take_profit_price?.toNumber() || null,
        },
        signature: Buffer.from(signatureBytes).toString('hex'),
        local_sequencer_id: 'continuum_client',
        timestamp_ms: Date.now().toString(),
      };

      console.log('closePosition', frmTransaction);
      const jsonFrm = JSON.stringify(frmTransaction);
      const frmPrefixedString = `FRM_v1.0:${jsonFrm}`;

      const payloadBytes = Buffer.from(frmPrefixedString, 'utf-8');
      const tx_id = `frm_order_${orderIntent.order_id.toString()}_${Date.now()}`;
      const transactionData = {
        version: '1.0',
        tx_id,
        payload: Array.from(payloadBytes),
        signature: Buffer.from(signatureBytes).toString('hex'),
        public_key: publicKey,
        nonce: frmTransaction.intent.order_id,
        timestamp: Date.now().toString(),
      };

      const apiUrl = `${config.devnet.apiBaseUrl}${API_ROUTES.tx}`;

      const response = await axios.post(apiUrl, {
        transaction: transactionData,
      });

      const receipt = response.data;

      console.log('CLOSE TX', receipt);

      if (receipt.sequence_number && receipt.expected_tick && receipt.tx_hash) {
        addOrderReceipt({
          sequence_number: receipt.sequence_number,
          expected_tick: receipt.expected_tick,
          tx_hash: receipt.tx_hash,
          order_id: orderIntent.order_id.toNumber(),
        });
      }

      toast.success(`Closed position`);
      return { success: true };
    } catch (error) {
      toast.error('Failed to place close order');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return {
    openPosition,
    openMarketPosition,
    closePosition,
  };
}
