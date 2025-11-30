/**
 * Perps trade panel component
 * Allows users to place buy and sell orders for perpetual contracts
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useState, useMemo, useEffect } from 'react';
import { MarginMode, OrderSide } from '@/features/order-placement/lib/PerpOrdersIntent';
import { Loader2, Wallet, Info } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { NumberInput } from '@/shared/ui/number-input';
import { Slider } from '@/shared/ui/slider';
import { useSelectedMarket } from '@/entities/market';
import { getLeverageLimitsFromMarket } from '@/entities/market/model';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { config, API_ROUTES } from '@/shared/config/constants';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

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
    marginMode: 'cross',
  });

  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedMarket } = useSelectedMarket();
  const { openPosition } = usePerps();

  // Fetch user balances from API
  const { data: balances } = useQuery({
    queryKey: ['userBalances', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      const url = `${config.devnet.apiBaseUrl}${API_ROUTES.user_balances.replace('{pubkey}', publicKey.toBase58())}`;
      const response = await axios.get(url);
      return response.data as Record<string, { available: string; reserved: string }>;
    },
    enabled: !!publicKey,
    refetchInterval: 5000,
  });

  // Airdrop function
  const requestAirdrop = async (mintAddress: string, tokenName: string) => {
    if (!publicKey) return;

    const url = `${config.devnet.apiBaseUrl}/rollup/airdrop`;

    // Default airdrop amount based on token decimals (e.g., 1000 tokens)
    const decimals = getTokenDecimals(tokenName);
    const amount = 1000 * Math.pow(10, decimals);

    const promise = axios
      .post(url, {
        recipient: publicKey.toBase58(),
        token_mint: mintAddress,
        amount: amount,
      })
      .then(res => res.data);

    toast.promise(promise, {
      loading: 'Airdrop Request Initiated - Waiting for approval...',
      success: data => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Request Confirmed</strong>
          </div>
          <div>
            Sent {(amount / Math.pow(10, decimals)).toLocaleString()} {tokenName}
          </div>
          {data?.transaction_id && (
            <div className="text-xs">TX: {data.transaction_id.slice(0, 8)}...</div>
          )}
        </div>
      ),
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Request Failed</strong>
          </div>
          <div>{err?.response?.data?.error || err?.message || 'Request failed'}</div>
        </div>
      ),
    });
  };

  // Calculate order value considering decimal inputs with safe parsing
  const priceValue = safeParseFloat(formState.price);
  const sizeValue = safeParseFloat(formState.size);
  const leverageValue = safeParseFloat(formState.leverage, 1);
  const orderValue = priceValue * sizeValue;

  // Calculate notional in raw token units for leverage tier lookup
  // Notional = price * size, where both are in human-readable units
  // Then convert to raw quote units (lamports) for comparison with tier thresholds
  const notionalRaw = useMemo(() => {
    if (!selectedMarket || priceValue <= 0 || sizeValue <= 0) {
      return 0;
    }
    const quoteDecimals = getTokenDecimals(selectedMarket.quoteTokenName);
    // Calculate notional in human-readable units (quote token units)
    const notionalHumanReadable = priceValue * sizeValue;
    // Convert to raw quote units (lamports) - this is what the backend uses
    // Example: 1000 USDC * 10^6 = 1000000000 (USDC lamports)
    return Math.floor(notionalHumanReadable * Math.pow(10, quoteDecimals));
  }, [selectedMarket, priceValue, sizeValue]);

  // Get leverage limits from the selected market, considering notional-based tiers
  const leverageLimits = useMemo(() => {
    if (selectedMarket) {
      return getLeverageLimitsFromMarket(selectedMarket, notionalRaw > 0 ? notionalRaw : undefined);
    }
    return null;
  }, [selectedMarket, notionalRaw]);

  // Clamp leverage value if it exceeds the new max leverage when limits change
  useEffect(() => {
    if (leverageLimits?.max && leverageValue > leverageLimits.max) {
      setFormState(prev => ({ ...prev, leverage: leverageLimits.max.toString() }));
    }
  }, [leverageLimits?.max, leverageValue]);

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
      const maxLeverage = leverageLimits?.max ?? 100;
      if (numValue < 1 || numValue > maxLeverage) {
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

  return (
    <div className="flex flex-col w-full lg:w-xs overflow-hidden">
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

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium">Leverage</label>
              {leverageLimits && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <div className="font-medium">Leverage Limits</div>
                      <div className="text-xs">
                        Max leverage is based on position size (notional value). Larger positions
                        have lower max leverage.
                      </div>
                      {orderValue > 0 && (
                        <div className="text-xs pt-1 border-t border-outline">
                          Current order value:{' '}
                          {orderValue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {selectedMarket?.quoteTokenName}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-semibold tabular-nums">{formState.leverage}x</span>
                {leverageLimits && (
                  <span className="text-xs text-muted-foreground">/ {leverageLimits.max}x max</span>
                )}
              </div>
              {/* Risk indicator */}
              {(() => {
                const riskLevel =
                  leverageValue <= 2
                    ? { label: 'Low Risk', color: 'text-green-500' }
                    : leverageValue <= 10
                      ? { label: 'Moderate', color: 'text-yellow-500' }
                      : leverageValue <= 25
                        ? { label: 'High Risk', color: 'text-orange-500' }
                        : { label: 'Very High', color: 'text-red-500' };
                return (
                  <span className={`text-[10px] font-medium ${riskLevel.color}`}>
                    {riskLevel.label}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Quick preset buttons */}
          {leverageLimits &&
            leverageLimits.recommended &&
            leverageLimits.recommended.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {leverageLimits.recommended
                  .filter(lev => lev <= leverageLimits.max)
                  .map(lev => (
                    <Button
                      key={lev}
                      variant={leverageValue === lev ? 'outline' : 'outline'}
                      size="sm"
                      className={`h-8 flex-1 text-xs transition-all ${
                        leverageValue === lev
                          ? 'bg-white text-black font-bold hover:bg-white/90'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleInputChange('leverage', lev.toString())}
                    >
                      {lev}x
                    </Button>
                  ))}
              </div>
            )}

          {/* Leverage slider */}
          <div className="space-y-2">
            <Slider
              value={[leverageValue]}
              onValueChange={([value]) => handleInputChange('leverage', value.toString())}
              min={leverageLimits?.min ?? 1}
              max={leverageLimits?.max ?? 100}
              step={1}
              className="w-full"
            />
          </div>
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
              <SelectItem value="isolated" disabled>
                Isolated
              </SelectItem>
              <SelectItem value="cross">Cross</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {publicKey && selectedMarket && (
          <div className="space-y-2 bg-card border border-outline p-2">
            <div className="text-xs font-medium text-muted-foreground">Balances</div>
            {/* Quote Token Balance */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{selectedMarket.quoteTokenName}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono tabular-nums">
                  {balances && balances[selectedMarket.quote_mint]
                    ? (
                        parseFloat(balances[selectedMarket.quote_mint].available) /
                        Math.pow(10, selectedMarket.quoteDecimals)
                      ).toFixed(selectedMarket.quoteDecimals)
                    : '0.000000'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    requestAirdrop(selectedMarket.quote_mint, selectedMarket.quoteTokenName)
                  }
                >
                  Airdrop
                </Button>
              </div>
            </div>
          </div>
        )}

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
            <span>Position Size</span>
            <span className="tabular-nums">
              {sizeValue > 0
                ? `${sizeValue.toFixed(getTokenDecimals(selectedMarket?.baseTokenName))}`
                : `0.00 `}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Margin Required</span>
            <span className="tabular-nums">
              {orderValue > 0 && priceValue > 0 && sizeValue > 0 && leverageValue >= 1
                ? (() => {
                    try {
                      const quoteDecimals = getTokenDecimals(selectedMarket?.quoteTokenName);
                      const baseDecimals = getTokenDecimals(selectedMarket?.baseTokenName);

                      // Convert to raw token units to preserve decimal precision
                      const priceRaw = Math.floor(priceValue * Math.pow(10, quoteDecimals));
                      const sizeRaw = Math.floor(sizeValue * Math.pow(10, baseDecimals));

                      const marginResult = calculatePerpMargin({
                        price: priceRaw,
                        quantity: sizeRaw,
                        leverage: leverageValue,
                        marketInitialMarginBps: selectedMarket?.perp_config?.initial_margin || 0,
                      });

                      // The notional is in (quote * base) decimal units
                      // Margin should be in quote token units only, so divide by base decimals
                      // Then convert to human-readable by dividing by quote decimals
                      const marginInQuoteUnits =
                        Number(marginResult.requiredMargin) /
                        Math.pow(10, baseDecimals + quoteDecimals);

                      return marginInQuoteUnits.toFixed(quoteDecimals);
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
