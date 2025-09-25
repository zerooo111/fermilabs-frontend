/**
 * Perps trade panel component
 * Allows users to place buy and sell orders for perpetual contracts
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useState } from 'react';
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

export function PerpsTradePanel() {
  const [formState, setFormState] = useState<{
    price: string;
    size: string;
    orderType: string;
    leverage: string;
    marginMode: MarginMode;
    reduceOnly: boolean;
  }>({
    price: '',
    size: '',
    orderType: 'limit',
    leverage: '1',
    marginMode: 'Isolated',
    reduceOnly: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedMarket } = useSelectedMarket();
  const addOrderReceipt = useSetAtom(addOrderReceiptAtom);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { price, size, leverage } = formState;

    if (!price.trim() || !size.trim()) {
      toast.error('Price and size are required');
      return false;
    }

    if (parseFloat(price) <= 0 || parseFloat(size) <= 0) {
      toast.error('Price and size must be positive');
      return false;
    }

    if (parseFloat(leverage) < 1) {
      toast.error('Leverage must be at least 1');
      return false;
    }

    return true;
  };

  const handleSubmitOrder = async (side: OrderSide) => {
    if (!publicKey) {
      setVisible(true);
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const baseDecimals = getTokenDecimals(baseMint);
      const quoteDecimals = getTokenDecimals(quoteMint);

      const orderIntent = new PerpOrderIntent(
        new BN(Date.now()), // order_id
        publicKey,
        side,
        decimalToBN(formState.price, quoteDecimals),
        decimalToBN(formState.size, baseDecimals),
        new BN(Math.floor(Date.now() / 1000) + 86400), // 24 hours expiry
        baseMint,
        quoteMint,
        'Perp',
        decimalToBN(formState.leverage, 0),
        'Open',
        formState.reduceOnly,
        formState.marginMode as 'Isolated' | 'Cross',
        null, // margin_amount
        false // liquidation
      );

      // Use the proper serialization method from PerpOrdersIntent
      const serializedOrder = PerpOrderIntent.serialize(orderIntent);

      const response = await axios.post(`${config.apiUrl}/orders`, serializedOrder, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      console.log(response);

      addOrderReceipt({
        id: orderIntent.order_id.toString(),
        market: selectedMarket?.uuid || '',
        side,
        price: formState.price,
        size: formState.size,
        timestamp: Date.now(),
        status: 'pending',
      });

      toast.success(`${side} order placed successfully`);

      // Reset form
      setFormState(prev => ({
        ...prev,
        price: '',
        size: '',
      }));
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error('Failed to place order');
    } finally {
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
          min={0}
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
          onValueChange={values => setFormState(prev => ({ ...prev, size: values.value || '' }))}
          min={0}
          placeholder="0.00"
          required
          unit={selectedMarket?.baseTokenName}
          decimalScale={getTokenDecimals(selectedMarket?.baseTokenName)}
          allowNegative={false}
        />

        <NumberInput
          id="leverage"
          name="leverage"
          label="Leverage"
          value={formState.leverage}
          onValueChange={values =>
            setFormState(prev => ({ ...prev, leverage: values.value || '' }))
          }
          min={1}
          placeholder="1"
          required
          step="0.1"
          allowNegative={false}
        />

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
              <SelectItem value="Isolated">Isolated</SelectItem>
              <SelectItem value="Cross">Cross</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="reduceOnly"
            checked={formState.reduceOnly}
            onChange={e => handleInputChange('reduceOnly', e.target.checked)}
          />
          <label htmlFor="reduceOnly" className="text-sm">
            Reduce Only
          </label>
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
              variant="success"
              disabled={!formState.price || !formState.size || isSubmitting}
              onClick={() => handleSubmitOrder('Buy')}
            >
              {isSubmitting ? (
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
              disabled={!formState.price || !formState.size || isSubmitting}
              onClick={() => handleSubmitOrder('Sell')}
            >
              {isSubmitting ? (
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
