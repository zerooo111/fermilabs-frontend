/**
 * Perps trade panel component
 * Allows users to place buy and sell orders for perpetual contracts
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useState, useEffect, useMemo } from 'react';
import { MarginMode, OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';
import { Loader2, Wallet, Info, AlertTriangle, XCircle } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { NumberInput } from '@/shared/ui/number-input';
import { Slider } from '@/shared/ui/slider';
import { useSelectedMarket, sltpValuesAtom } from '@/entities/market';
import {
  useFeeStatus,
  feeCreditDialogOpenAtom,
  formatSolFromLamports,
} from '@/features/fee-credit';
import { useSetAtom } from 'jotai';
import { getLeverageLimitsFromMarket } from '@/entities/market/model';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { useSimulate } from '@/features/order-placement/lib/useSimulate';
import { warmSimulate } from '@/features/order-placement/lib/simulateApi';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';
import { useMarketStats } from '@/shared/hooks/useMarketStats';

type FeeBannerTone = 'ok' | 'warn' | 'danger';

const FEE_BANNER_STYLES: Record<FeeBannerTone, string> = {
  ok: 'bg-success/10 border-success/30 text-success',
  warn: 'bg-amber-400/10 border-amber-400/30 text-amber-300',
  danger: 'bg-danger/10 border-danger/30 text-danger',
};

function FeeBanner({
  tone,
  availableLamports,
  onTopUp,
}: {
  tone: FeeBannerTone;
  availableLamports: number | undefined;
  onTopUp: () => void;
}) {
  const message =
    tone === 'danger'
      ? 'Insufficient fee credit'
      : tone === 'warn'
        ? 'Fee credit running low'
        : `Fee credit: ${formatSolFromLamports(availableLamports)} SOL`;
  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 text-xs border ${FEE_BANNER_STYLES[tone]}`}
    >
      <span>{message}</span>
      {tone !== 'ok' && (
        <Button size="sm" variant="outline" className="h-5 px-2 text-[10px]" onClick={onTopUp}>
          Top Up
        </Button>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function healthColor(ratio: number) {
  if (ratio < 0) return { bar: 'bg-danger', text: 'text-danger' };
  if (ratio < 10) return { bar: 'bg-orange-500', text: 'text-orange-400' };
  if (ratio < 30) return { bar: 'bg-amber-400', text: 'text-amber-400' };
  return { bar: 'bg-success', text: 'text-success' };
}

function InlineHealthBar({ label, ratio }: { label: string; ratio?: number }) {
  // Placeholder mode: pre-trade simulation hasn't returned data yet. Reserves
  // the same vertical space as the real bar so the panel doesn't shift when
  // simResult arrives.
  if (ratio === undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0 w-28">{label}</span>
        <div className="flex-1 h-0.5 bg-outline overflow-hidden" />
        <span className="tabular-nums shrink-0 text-muted-foreground">—</span>
      </div>
    );
  }
  const { bar, text } = healthColor(ratio);
  const clamped = Math.max(0, Math.min(100, ratio));
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0 w-28">{label}</span>
      <div className="flex-1 h-0.5 bg-outline overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${bar}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`tabular-nums shrink-0 ${text}`}>{ratio.toFixed(1)}%</span>
    </div>
  );
}

// Safe parsing functions to prevent NaN errors
const safeParseFloat = (value: string, defaultValue: number = 0): number => {
  if (!value || value.trim() === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const marketQuoteDecimals = (selectedMarket: any): number =>
  Math.max(
    0,
    selectedMarket?.quoteDecimals ??
      selectedMarket?.quote_decimals ??
      getTokenDecimals(selectedMarket?.quoteTokenName)
  );

const marketBaseDecimals = (selectedMarket: any): number =>
  Math.max(
    0,
    selectedMarket?.baseDecimals ??
      selectedMarket?.base_decimals ??
      getTokenDecimals(selectedMarket?.baseTokenName)
  );

export function PerpsTradePanel() {
  const [submittingSide, setSubmittingSide] = useState<OrderSide | null>(null);
  const isSubmitting = submittingSide !== null;
  const [enableSLTP, setEnableSLTP] = useState(false);
  const [customSlippage, setCustomSlippage] = useState(false);
  const [formState, setFormState] = useState<{
    price: string;
    size: string;
    orderType: string;
    leverage: string;
    marginMode: MarginMode;
    stopLoss: string;
    takeProfit: string;
    slippage: string;
  }>({
    price: '',
    size: '',
    orderType: 'limit',
    leverage: '1',
    marginMode: 'cross',
    stopLoss: '',
    takeProfit: '',
    slippage: '0.25',
  });

  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedMarket } = useSelectedMarket();
  const { openPosition, openMarketPosition } = usePerps();
  const setSLTPValues = useSetAtom(sltpValuesAtom);
  const setFeeCreditOpen = useSetAtom(feeCreditDialogOpenAtom);
  const feeStatus = useFeeStatus();
  const feeHealth = feeStatus.health;
  const feeInsufficient = !!publicKey && feeStatus.isSuccess && !feeStatus.data?.ok;

  // Warm the simulation cache as soon as the wallet connects, before the user fills the form
  useEffect(() => {
    if (!publicKey) return;
    warmSimulate(publicKey.toBase58()).catch(() => {});
  }, [publicKey]);

  // Fetch market stats to get mark price
  const { data: marketsData } = useMarketStats({
    refetchInterval: 1000,
    enabled: !!selectedMarket,
  });

  // Get mark price for the selected market
  const markPrice = useMemo(() => {
    if (!selectedMarket?.uuid || !marketsData) return null;

    const currentMarketData = marketsData.find(m => m.uuid === selectedMarket.uuid);
    if (!currentMarketData || currentMarketData.kind !== 'perp' || !currentMarketData.perp_state) {
      return null;
    }

    const rawMarkPrice = currentMarketData.perp_state.mark_price;
    if (rawMarkPrice === null || rawMarkPrice === undefined || rawMarkPrice <= 0) {
      return null;
    }

    // Normalize mark_price by dividing by 10^quoteDecimals
    const quoteDecimals = marketQuoteDecimals(selectedMarket);
    return rawMarkPrice / Math.pow(10, quoteDecimals);
  }, [selectedMarket?.uuid, selectedMarket?.quoteDecimals, marketsData]);

  // Calculate order value considering decimal inputs with safe parsing
  const priceValue = safeParseFloat(formState.price);
  const sizeValue = safeParseFloat(formState.size);
  const leverageValue = safeParseFloat(formState.leverage, 1);
  const orderValue = priceValue * sizeValue;
  const isMarketOrder = formState.orderType === 'market';

  // Debounced form values for simulation (avoids hitting the API on every keystroke)
  const debouncedPrice = useDebounce(priceValue, 400);
  const debouncedSize = useDebounce(sizeValue, 400);
  const marketIndex = selectedMarket ? parseInt(selectedMarket.uuid, 10) : null;
  const simulateEnabled = !!publicKey && !!selectedMarket && debouncedSize > 0;

  const buySimulate = useSimulate({
    owner: publicKey?.toBase58() ?? null,
    marketIndex,
    side: 'buy',
    quantity: debouncedSize,
    price: isMarketOrder ? null : debouncedPrice > 0 ? debouncedPrice : null,
    orderType: isMarketOrder ? 'market' : 'limit',
    enabled: simulateEnabled,
  });

  const sellSimulate = useSimulate({
    owner: publicKey?.toBase58() ?? null,
    marketIndex,
    side: 'sell',
    quantity: debouncedSize,
    price: isMarketOrder ? null : debouncedPrice > 0 ? debouncedPrice : null,
    orderType: isMarketOrder ? 'market' : 'limit',
    enabled: simulateEnabled,
  });

  const buyWouldReject = buySimulate.data?.would_reject ?? false;
  const sellWouldReject = sellSimulate.data?.would_reject ?? false;
  const simLoading =
    (buySimulate.isFetching || sellSimulate.isFetching) && !buySimulate.data && !sellSimulate.data;

  // Calculate notional in raw token units for leverage tier lookup
  // Notional = price * size, where both are in human-readable units
  // Then convert to raw quote units (lamports) for comparison with tier thresholds
  const notionalRaw = useMemo(() => {
    if (!selectedMarket || priceValue <= 0 || sizeValue <= 0) {
      return 0;
    }
    const quoteDecimals = marketQuoteDecimals(selectedMarket);
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
    // Validate numeric inputs for price, size, stopLoss, and takeProfit
    if (field === 'price' || field === 'size' || field === 'stopLoss' || field === 'takeProfit') {
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

    // Validate Stop Loss: cannot be above entry price
    if (field === 'stopLoss') {
      const stringValue = value as string;
      if (stringValue !== '') {
        const stopLossValue = safeParseFloat(stringValue);
        if (priceValue > 0 && stopLossValue > priceValue) {
          toast.error('Stop Loss cannot be above entry price');
          return; // Reject invalid stop loss
        }
      }
    }

    // Validate Take Profit: cannot be below entry price
    if (field === 'takeProfit') {
      const stringValue = value as string;
      if (stringValue !== '') {
        const takeProfitValue = safeParseFloat(stringValue);
        if (priceValue > 0 && takeProfitValue < priceValue) {
          toast.error('Take Profit cannot be below entry price');
          return; // Reject invalid take profit
        }
      }
    }

    setFormState(prev => {
      const newState = { ...prev, [field]: value };

      // Update SL/TP atom when values change
      if (field === 'stopLoss' || field === 'takeProfit') {
        const stopLossValue = field === 'stopLoss' ? (value as string) : newState.stopLoss;
        const takeProfitValue = field === 'takeProfit' ? (value as string) : newState.takeProfit;

        const sltp = {
          stopLoss: stopLossValue ? safeParseFloat(stopLossValue) : null,
          takeProfit: takeProfitValue ? safeParseFloat(takeProfitValue) : null,
        };

        setSLTPValues(sltp);
      }

      return newState;
    });
  };

  const handleOpenPosition = async (side: OrderSide) => {
    // Validate SL/TP before submitting (skip for market orders since price is unknown)
    if (enableSLTP && !isMarketOrder) {
      const stopLossValue = safeParseFloat(formState.stopLoss);
      const takeProfitValue = safeParseFloat(formState.takeProfit);

      if (formState.stopLoss && stopLossValue > priceValue) {
        toast.error('Stop Loss cannot be above entry price');
        return;
      }

      if (formState.takeProfit && takeProfitValue < priceValue) {
        toast.error('Take Profit cannot be below entry price');
        return;
      }
    }

    if (isMarketOrder && (!markPrice || markPrice <= 0)) {
      toast.error('Mark price unavailable — cannot place market order');
      return;
    }

    setSubmittingSide(side);

    try {
      let result: { success: boolean; error?: string };

      if (isMarketOrder) {
        result = await openMarketPosition({
          side,
          size: formState.size,
          leverage: formState.leverage,
          marginMode: formState.marginMode,
          maxSlippageBps: Math.round(safeParseFloat(formState.slippage, 1) * 100),
          markPrice: markPrice!,
        });
      } else {
        result = await openPosition({
          side,
          leverage: formState.leverage,
          marginMode: formState.marginMode,
          price: formState.price,
          size: formState.size,
          stopLoss: enableSLTP && formState.stopLoss ? formState.stopLoss : undefined,
          takeProfit: enableSLTP && formState.takeProfit ? formState.takeProfit : undefined,
        });
      }

      if (result.success) {
        setFormState(prev => ({
          ...prev,
          price: '',
          size: '',
          stopLoss: '',
          takeProfit: '',
        }));
        setSLTPValues({ stopLoss: null, takeProfit: null });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setSubmittingSide(null);
    }
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
          <TabsTrigger value="market" className="flex-1">
            Market
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col p-3 gap-2 flex-1">
        {formState.orderType !== 'market' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label htmlFor="price" className="text-sm font-medium">
                Price
              </label>
              {markPrice !== null && (
                <button
                  type="button"
                  onClick={() => {
                    const formattedPrice = markPrice.toFixed(marketQuoteDecimals(selectedMarket));
                    setFormState(prev => ({ ...prev, price: formattedPrice }));
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Market
                </button>
              )}
            </div>
            <NumberInput
              id="price"
              name="price"
              value={formState.price}
              onValueChange={values =>
                setFormState(prev => ({ ...prev, price: values.value || '' }))
              }
              min={0.01}
              placeholder="0.00"
              required
              unit={selectedMarket?.quoteTokenName}
              decimalScale={marketQuoteDecimals(selectedMarket)}
              allowNegative={false}
            />
          </div>
        )}

        {formState.orderType === 'market' && (
          <div className="space-y-1.5 rounded-sm bg-muted/20 px-2 py-1.5 border border-outline/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <input
                  type="checkbox"
                  id="customSlippage"
                  checked={customSlippage}
                  onChange={e => {
                    setCustomSlippage(e.target.checked);
                    if (!e.target.checked) {
                      setFormState(prev => ({ ...prev, slippage: '0.25' }));
                    }
                  }}
                  className="h-3 w-3 rounded border-outline shrink-0"
                />
                <label
                  htmlFor="customSlippage"
                  className="text-[11px] text-muted-foreground cursor-pointer truncate"
                >
                  Custom slippage limit
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3 text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="text-xs">
                      Maximum acceptable price deviation. 1% = 100 bps. Order is cancelled if fill
                      price exceeds this threshold. Defaults to 0.25%.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-[11px] tabular-nums text-foreground shrink-0">
                {formState.slippage}%
              </span>
            </div>
            {customSlippage && (
              <>
                <div className="flex gap-1">
                  {['0.25', '0.5', '1', '2'].map(pct => (
                    <Button
                      key={pct}
                      variant="outline"
                      size="sm"
                      className={`h-6 flex-1 text-[11px] px-1 ${
                        formState.slippage === pct
                          ? 'bg-white text-black font-bold hover:bg-white/90'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => setFormState(prev => ({ ...prev, slippage: pct }))}
                    >
                      {pct}%
                    </Button>
                  ))}
                </div>
                <NumberInput
                  value={formState.slippage}
                  onValueChange={values =>
                    setFormState(prev => ({ ...prev, slippage: values.value }))
                  }
                  placeholder="0.25"
                  min={0.01}
                  max={100}
                  decimalScale={2}
                  allowNegative={false}
                  unit="%"
                />
              </>
            )}
          </div>
        )}

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
          decimalScale={marketBaseDecimals(selectedMarket)}
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

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableSLTP"
              checked={enableSLTP}
              onChange={e => {
                setEnableSLTP(e.target.checked);
                if (!e.target.checked) {
                  setFormState(prev => ({ ...prev, stopLoss: '', takeProfit: '' }));
                  setSLTPValues({ stopLoss: null, takeProfit: null });
                } else {
                  // When enabling, sync existing values if any
                  const stopLossValue = formState.stopLoss
                    ? safeParseFloat(formState.stopLoss)
                    : null;
                  const takeProfitValue = formState.takeProfit
                    ? safeParseFloat(formState.takeProfit)
                    : null;
                  if (stopLossValue || takeProfitValue) {
                    setSLTPValues({
                      stopLoss: stopLossValue,
                      takeProfit: takeProfitValue,
                    });
                  }
                }
              }}
              className="h-4 w-4 rounded border-outline"
            />
            <label htmlFor="enableSLTP" className="text-sm font-medium cursor-pointer">
              Stop loss / Take Profit
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-medium">Stop Loss / Take Profit</div>
                  <div className="text-xs">
                    Set price levels to automatically close your position. Stop Loss limits losses,
                    while Take Profit locks in profits at your target price.
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          {enableSLTP && (
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                id="stopLoss"
                name="stopLoss"
                label="Stop Loss Price"
                value={formState.stopLoss}
                min={0.01}
                onValueChange={values =>
                  setFormState(prev => ({ ...prev, stopLoss: values.value || '' }))
                }
                placeholder="Price level"
                unit={selectedMarket?.quoteTokenName}
                decimalScale={marketQuoteDecimals(selectedMarket)}
                allowNegative={false}
                disabled={formState.orderType === 'market'}
              />
              <NumberInput
                id="takeProfit"
                name="takeProfit"
                label="Take Profit Price"
                value={formState.takeProfit}
                min={0.01}
                onValueChange={values =>
                  setFormState(prev => ({ ...prev, takeProfit: values.value || '' }))
                }
                placeholder="Price level"
                unit={selectedMarket?.quoteTokenName}
                decimalScale={marketQuoteDecimals(selectedMarket)}
                allowNegative={false}
                disabled={formState.orderType === 'market'}
              />
            </div>
          )}
        </div>

        {/* Order summary — sits directly above the action buttons so margin /
            health info stays adjacent to the trade box. Pinned to the bottom
            with mt-auto so summary + fee banner + buttons stay grouped. */}
        {(() => {
          const simResult = buySimulate.data ?? sellSimulate.data;
          const rejectReasons = simResult?.reject_reasons ?? [];
          const warnings = simResult?.warnings ?? [];
          const hasAlerts = rejectReasons.length > 0 || warnings.length > 0;
          const borderClass = rejectReasons.length > 0 ? 'border-danger/40' : 'border-outline';

          const marginDisplay = (() => {
            if (!(orderValue > 0 && priceValue > 0 && sizeValue > 0 && leverageValue >= 1))
              return '—';
            try {
              const quoteDecimals = marketQuoteDecimals(selectedMarket);
              const baseDecimals = marketBaseDecimals(selectedMarket);
              const priceRaw = Math.floor(priceValue * Math.pow(10, quoteDecimals));
              const sizeRaw = Math.floor(sizeValue * Math.pow(10, baseDecimals));
              const marginResult = calculatePerpMargin({
                price: priceRaw,
                quantity: sizeRaw,
                leverage: leverageValue,
                marketInitialMarginBps: selectedMarket?.perp_config?.initial_margin || 0,
              });
              const marginInQuoteUnits =
                Number(marginResult.requiredMargin) / Math.pow(10, baseDecimals + quoteDecimals);
              return `${marginInQuoteUnits.toFixed(2)} ${selectedMarket?.quoteTokenName ?? ''}`;
            } catch {
              return '—';
            }
          })();

          const liqPriceDisplay = (() => {
            if (!(orderValue > 0 && priceValue > 0 && leverageValue > 1)) return '—';
            try {
              return (priceValue * (1 - 1 / leverageValue)).toFixed(
                marketQuoteDecimals(selectedMarket)
              );
            } catch {
              return '—';
            }
          })();

          return (
            <div className={`bg-card border text-xs mt-auto ${borderClass}`}>
              {/* Alerts — reject reasons and warnings (conditional). */}
              {hasAlerts && (
                <div className="px-3 pt-2.5 pb-2 space-y-1.5 border-b border-outline">
                  {rejectReasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-danger">
                      <XCircle className="size-3 mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </div>
                  ))}
                  {warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-amber-400">
                      <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Static order details — always rendered. */}
              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Size</span>
                  <span className="tabular-nums text-foreground">
                    {sizeValue > 0
                      ? `${sizeValue.toFixed(marketBaseDecimals(selectedMarket))} ${selectedMarket?.baseTokenName ?? ''}`
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Margin</span>
                  <span className="tabular-nums text-foreground">{marginDisplay}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Est. Liq. Price</span>
                  <span className="tabular-nums text-foreground">{liqPriceDisplay}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Fee</span>
                  <span className="tabular-nums text-foreground">0.01%</span>
                </div>
              </div>

              {/* After Trade — always rendered with placeholders so the panel
                  has a constant height while pre-trade simulation is in flight. */}
              <div className="px-3 pb-2.5 pt-2 border-t border-dashed border-outline space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="uppercase tracking-wide text-[10px]">After Trade</span>
                  {simLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                </div>
                <InlineHealthBar label="Init Health" ratio={simResult?.after.init_health_ratio} />
                <InlineHealthBar label="Maint Health" ratio={simResult?.after.maint_health_ratio} />
                <div className="flex items-center justify-between text-muted-foreground pt-0.5">
                  <span>Health Impact</span>
                  {simResult ? (
                    <span
                      className={`tabular-nums ${simResult.delta.init_health_ui_quote < 0 ? 'text-danger' : 'text-success'}`}
                    >
                      {simResult.delta.init_health_ui_quote < 0 ? '−' : '+'}$
                      {Math.abs(simResult.delta.init_health_ui_quote).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {publicKey && feeHealth !== 'unknown' && (
          <FeeBanner
            tone={feeInsufficient ? 'danger' : feeHealth === 'warn' ? 'warn' : 'ok'}
            availableLamports={feeStatus.data?.fee_account.available_balance_lamports}
            onTopUp={() => setFeeCreditOpen(true)}
          />
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
              disabled={
                (formState.orderType !== 'market' && priceValue <= 0) ||
                sizeValue <= 0 ||
                isSubmitting ||
                feeInsufficient ||
                buyWouldReject
              }
              variant="success"
              onClick={() => handleOpenPosition('Buy')}
            >
              {submittingSide === 'Buy' ? (
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
              disabled={
                (formState.orderType !== 'market' && priceValue <= 0) ||
                sizeValue <= 0 ||
                isSubmitting ||
                feeInsufficient ||
                sellWouldReject
              }
              onClick={() => handleOpenPosition('Sell')}
            >
              {submittingSide === 'Sell' ? (
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
      </div>
    </div>
  );
}
