/**
 * Perps trade panel component
 * Allows users to place buy and sell orders for perpetual contracts
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useState, useMemo } from 'react';
import { MarginMode, OrderSide } from '@/features/order-placement/lib/PerpOrdersIntent';
import { Loader2, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { NumberInput } from '@/shared/ui/number-input';
import { Slider } from '@/shared/ui/slider';
import { useSelectedMarket } from '@/entities/market';
import { getLeverageLimitsFromMarket } from '@/entities/market/model';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';

// Safe parsing functions to prevent NaN errors
const safeParseFloat = (value: string, defaultValue: number = 0): number => {
  if (!value || value.trim() === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export function PerpsTradePanel() {
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedMarket } = useSelectedMarket();
  const { openPosition } = usePerps();

  // Get leverage limits from the selected market
  const leverageLimits = useMemo(() => {
    if (selectedMarket) {
      return getLeverageLimitsFromMarket(selectedMarket);
    }
    return null;
  }, [selectedMarket]);

  const handleInputChange = (field: string, value: string | boolean) => {
    console.log('[PerpsTradePanel] Form input changed:', { field, value });

    // Validate numeric inputs for price and size
    if (field === 'price' || field === 'size') {
      const stringValue = value as string;
      // Allow empty string, numbers, and decimal point
      if (stringValue !== '' && !/^\d*\.?\d*$/.test(stringValue)) {
        return; // Reject invalid characters
      }
    }

    // Validate leverage input
    if (field === 'leverage') {
      const stringValue = value as string;
      const numValue = safeParseFloat(stringValue);
      if (numValue < 1 || numValue > 100) {
        return; // Reject invalid leverage values
      }
    }

    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenPosition = async (side: OrderSide) => {
    setIsSubmitting(true);
    const result = await openPosition({
      side: side,
      leverage: formState.leverage,
      marginMode: formState.marginMode,
      price: formState.price,
      size: formState.size,
    });
    if (result.success) {
      setFormState(prev => ({
        ...prev,
        price: '',
        size: '',
      }));
    }
    setIsSubmitting(false);
  };
  // Calculate order value considering decimal inputs with safe parsing
  const priceValue = safeParseFloat(formState.price);
  const sizeValue = safeParseFloat(formState.size);
  const leverageValue = safeParseFloat(formState.leverage, 1);
  const orderValue = priceValue * sizeValue;

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
          <TabsTrigger value="market" disabled className="flex-1">
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
            value={[leverageValue]}
            onValueChange={([value]) => handleInputChange('leverage', value.toString())}
            min={leverageLimits?.min ?? 1}
            max={leverageLimits?.max ?? 100}
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
              disabled={priceValue <= 0 || sizeValue <= 0 || isSubmitting}
              variant="success"
              onClick={() => handleOpenPosition('Buy')}
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
              disabled={priceValue <= 0 || sizeValue <= 0 || isSubmitting}
              onClick={() => handleOpenPosition('Sell')}
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
          <div className="flex items-center justify-between">
            <span>Margin</span>
            <span className="tabular-nums">
              {orderValue > 0 && priceValue > 0 && sizeValue > 0 && leverageValue >= 1
                ? (() => {
                    try {
                      const marginResult = calculatePerpMargin({
                        price: priceValue,
                        quantity: sizeValue,
                        leverage: leverageValue,
                        marketInitialMarginBps: selectedMarket?.perp_config?.initial_margin || 0,
                      });
                      return (
                        Number(marginResult.requiredMargin) /
                        Math.pow(10, getTokenDecimals(selectedMarket?.quoteTokenName))
                      ).toFixed(getTokenDecimals(selectedMarket?.quoteTokenName));
                    } catch (error) {
                      console.error('Margin calculation error:', error);
                      return '0.00';
                    }
                  })()
                : '0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Est. Liq. Price</span>
            <span className="tabular-nums">
              {orderValue > 0 && priceValue > 0 && leverageValue > 1
                ? (() => {
                    try {
                      const liqPrice = priceValue * (1 - 1 / leverageValue);
                      return liqPrice.toFixed(getTokenDecimals(selectedMarket?.quoteTokenName));
                    } catch (error) {
                      console.error('Liquidation price calculation error:', error);
                      return '0.00';
                    }
                  })()
                : '0.00'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Fee</span>
            <span className="tabular-nums">0.01%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
