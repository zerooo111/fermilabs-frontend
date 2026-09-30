/**
 * Perps trade panel component
 * Allows users to place buy and sell orders for perpetual contracts
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Loader2, Wallet, Info, AlertTriangle, XCircle } from 'lucide-react';
import { NumberInput } from '@/shared/ui/number-input';
import { formatSolFromLamports } from '@/features/fee-credit';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';
import {
  useOrderForm,
  safeParseFloat,
  marketQuoteDecimals,
  marketBaseDecimals,
} from '@/features/order-placement/lib/useOrderForm';

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

export function PerpsTradePanel() {
  const {
    submittingSide,
    isSubmitting,
    enableSLTP,
    setEnableSLTP,
    customSlippage,
    setCustomSlippage,
    formState,
    setFormState,
    publicKey,
    setVisible,
    selectedMarket,
    setSLTPValues,
    setFeeCreditOpen,
    feeStatus,
    feeHealth,
    feeInsufficient,
    markPrice,
    priceValue,
    sizeValue,
    orderValue,
    buySimulate,
    sellSimulate,
    buyWouldReject,
    sellWouldReject,
    simLoading,
    computedLeverage,
    handleInputChange,
    handleOpenPosition,
  } = useOrderForm();

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

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium text-foreground">Leverage</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="text-xs">
                  Computed as position size ÷ free collateral. Max 5× enforced by the protocol.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="tabular-nums font-semibold">
            {computedLeverage !== null ? `${computedLeverage.toFixed(2)}×` : '5×'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="reduceOnly"
            checked={formState.reduceOnly}
            onChange={e => setFormState(prev => ({ ...prev, reduceOnly: e.target.checked }))}
            className="h-4 w-4 rounded border-outline"
          />
          <label htmlFor="reduceOnly" className="text-sm font-medium cursor-pointer">
            Reduce Only
          </label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs">
                Only reduces or closes your existing position. The order will never increase your
                position or open one in the opposite direction.
              </div>
            </TooltipContent>
          </Tooltip>
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

          const FIXED_LEVERAGE = 5;

          const marginDisplay = (() => {
            if (!(orderValue > 0 && priceValue > 0 && sizeValue > 0)) return '—';
            try {
              const quoteDecimals = marketQuoteDecimals(selectedMarket);
              const baseDecimals = marketBaseDecimals(selectedMarket);
              const priceRaw = Math.floor(priceValue * Math.pow(10, quoteDecimals));
              const sizeRaw = Math.floor(sizeValue * Math.pow(10, baseDecimals));
              const marginResult = calculatePerpMargin({
                price: priceRaw,
                quantity: sizeRaw,
                leverage: FIXED_LEVERAGE,
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
            if (!(orderValue > 0 && priceValue > 0)) return '—';
            try {
              return (priceValue * (1 - 1 / FIXED_LEVERAGE)).toFixed(
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
