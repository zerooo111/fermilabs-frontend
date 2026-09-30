/**
 * Trade ticket: the compact order form used on /perps-v2.
 *
 * Same logic as PerpsTradePanel (useOrderForm), laid out the way traders
 * expect: pick a side, pick market or limit, enter size (or drag the slider),
 * one button. Details that matter only sometimes (slippage, TP/SL) stay folded
 * until asked for, and the summary is a short list under the button.
 */
import { useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Check, CircleNotch, Warning, XCircle } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import type { OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';
import {
  marketBaseDecimals,
  marketQuoteDecimals,
  useOrderForm,
} from '@/features/order-placement/lib/useOrderForm';

const MAX_LEVERAGE = 5;
const FEE_RATE = '0.01%';
const SLIPPAGE_PRESETS = ['0.1', '0.25', '0.5', '1'];
const TICKS = [0, 25, 50, 75, 100];

const fmt = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Field({
  label,
  value,
  onChange,
  unit,
  decimals,
  action,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  decimals: number;
  action?: React.ReactNode;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex h-11 items-center gap-2 border border-line bg-surface-base px-3 transition-colors focus-within:border-line-focus hover:border-line-strong"
    >
      <span className="shrink-0 text-xs text-fg-tertiary">{label}</span>
      <NumericFormat
        id={id}
        value={value}
        onValueChange={v => onChange(v.value || '')}
        decimalScale={decimals}
        allowNegative={false}
        thousandSeparator=","
        allowedDecimalSeparators={['.']}
        placeholder="0.00"
        inputMode="decimal"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-right font-mono text-sm tabular-nums text-fg-primary outline-none placeholder:text-fg-disabled"
      />
      {unit && <span className="shrink-0 text-xs text-fg-secondary">{unit}</span>}
      {action}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs text-fg-secondary transition-colors hover:text-fg-primary"
    >
      <span
        className={cn(
          'grid size-3.5 shrink-0 place-items-center border transition-colors',
          checked ? 'border-fg-primary bg-fg-primary text-fg-inverse' : 'border-line-strong'
        )}
      >
        {checked && <Check size={10} weight="bold" />}
      </span>
      {children}
    </button>
  );
}

function Row({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-fg-tertiary">{label}</span>
      <span className={cn('font-mono tabular-nums text-fg-primary', className)}>{children}</span>
    </div>
  );
}

function SizeSlider({
  percent,
  onChange,
  disabled,
}: {
  percent: number;
  onChange: (percent: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <SliderPrimitive.Root
        value={[percent]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        aria-label="Size as a share of the maximum"
        className="relative flex h-5 flex-1 touch-none select-none items-center data-[disabled]:opacity-40"
      >
        <SliderPrimitive.Track className="relative h-0.5 grow bg-line">
          <SliderPrimitive.Range className="absolute h-full bg-fg-primary" />
        </SliderPrimitive.Track>
        {/* Radix keeps the 14px thumb inside the track, so its centre runs
            from 7px to width - 7px. Inset the ticks the same so they line up */}
        <span aria-hidden className="pointer-events-none absolute inset-x-[7px] inset-y-0">
          {TICKS.map(t => (
            <span
              key={t}
              className={cn(
                'absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 border',
                percent >= t
                  ? 'border-fg-primary bg-fg-primary'
                  : 'border-line-strong bg-surface-canvas'
              )}
              style={{ left: `${t}%` }}
            />
          ))}
        </span>
        <SliderPrimitive.Thumb className="block size-3.5 border-2 border-fg-primary bg-surface-canvas outline-none focus-visible:ring-2 focus-visible:ring-line-focus" />
      </SliderPrimitive.Root>
      <span className="w-11 shrink-0 text-right font-mono text-xs tabular-nums text-fg-secondary">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

export function TradeTicket() {
  const f = useOrderForm();
  const [side, setSide] = useState<OrderSide>('Buy');
  const isBuy = side === 'Buy';

  const market = f.selectedMarket;
  const baseDecimals = marketBaseDecimals(market);
  const quoteDecimals = marketQuoteDecimals(market);
  const base = market?.baseTokenName ?? '';
  const quote = market?.quoteTokenName ?? '';

  // Market orders price at mark; limit orders at the typed price
  const refPrice = f.isMarketOrder ? (f.markPrice ?? 0) : f.priceValue;
  const available = f.accountMetrics?.free_collateral_snapshot ?? 0;
  const maxSize = refPrice > 0 ? (available * MAX_LEVERAGE) / refPrice : 0;
  const percent = maxSize > 0 ? Math.min(100, (f.sizeValue / maxSize) * 100) : 0;
  const orderValue = refPrice * f.sizeValue;

  const setPercent = (p: number) => {
    const size = (maxSize * p) / 100;
    f.setFormState(prev => ({ ...prev, size: size > 0 ? size.toFixed(baseDecimals) : '' }));
  };

  const margin = useMemo(() => {
    if (!(refPrice > 0 && f.sizeValue > 0)) return null;
    try {
      const result = calculatePerpMargin({
        price: Math.floor(refPrice * 10 ** quoteDecimals),
        quantity: Math.floor(f.sizeValue * 10 ** baseDecimals),
        leverage: MAX_LEVERAGE,
        marketInitialMarginBps: market?.perp_config?.initial_margin || 0,
      });
      return Number(result.requiredMargin) / 10 ** (baseDecimals + quoteDecimals);
    } catch {
      return null;
    }
  }, [refPrice, f.sizeValue, quoteDecimals, baseDecimals, market?.perp_config?.initial_margin]);

  const liqPrice =
    refPrice > 0 && f.sizeValue > 0
      ? refPrice * (isBuy ? 1 - 1 / MAX_LEVERAGE : 1 + 1 / MAX_LEVERAGE)
      : null;

  const sim = isBuy ? f.buySimulate.data : f.sellSimulate.data;
  const rejects = sim?.reject_reasons ?? [];
  const warnings = sim?.warnings ?? [];
  const healthAfter = sim?.after.init_health_ratio;
  const wouldReject = isBuy ? f.buyWouldReject : f.sellWouldReject;

  const canSubmit =
    !!f.publicKey &&
    f.sizeValue > 0 &&
    (f.isMarketOrder || f.priceValue > 0) &&
    !f.isSubmitting &&
    !f.feeInsufficient &&
    !wouldReject;

  const toggleSLTP = (on: boolean) => {
    f.setEnableSLTP(on);
    if (!on) {
      f.setFormState(prev => ({ ...prev, stopLoss: '', takeProfit: '' }));
      f.setSLTPValues({ stopLoss: null, takeProfit: null });
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto p-3 text-fg-primary [&>*]:shrink-0">
      {/* Side */}
      <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 bg-surface-base p-0.5">
        {(['Buy', 'Sell'] as const).map(s => {
          const active = side === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSide(s)}
              className={cn(
                'h-8 text-sm font-medium transition-colors',
                active
                  ? s === 'Buy'
                    ? 'bg-positive-solid text-[var(--color-fg-on-positive,var(--color-fg-inverse))]'
                    : 'bg-negative-solid text-[var(--color-fg-on-negative,var(--color-fg-inverse))]'
                  : 'text-fg-tertiary hover:text-fg-primary'
              )}
            >
              {s === 'Buy' ? 'Buy / Long' : 'Sell / Short'}
            </button>
          );
        })}
      </div>

      {/* Order type, margin mode */}
      <div className="flex items-center justify-between border-b border-line-subtle">
        <div role="tablist" aria-label="Order type" className="flex">
          {(['market', 'limit'] as const).map(t => {
            const active = f.formState.orderType === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => f.handleInputChange('orderType', t)}
                className={cn(
                  '-mb-px h-8 border-b-2 px-3 text-sm capitalize transition-colors first:pl-0',
                  active
                    ? 'border-fg-primary text-fg-primary'
                    : 'border-transparent text-fg-tertiary hover:text-fg-primary'
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help border border-line px-2 py-0.5 text-[11px] text-fg-secondary">
              Cross · {MAX_LEVERAGE}×
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Cross margin, up to {MAX_LEVERAGE}× leverage. Isolated margin is coming.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-1.5">
        <Row label="Available">{f.publicKey ? `${fmt(available)} ${quote}` : '—'}</Row>
        {f.computedLeverage !== null && (
          <Row label="Leverage">{f.computedLeverage.toFixed(2)}×</Row>
        )}
      </div>

      {/* Inputs */}
      <div className="flex flex-col gap-2">
        {!f.isMarketOrder && (
          <Field
            id="ticket-price"
            label="Price"
            value={f.formState.price}
            onChange={price => f.setFormState(prev => ({ ...prev, price }))}
            unit={quote}
            decimals={quoteDecimals}
            action={
              f.markPrice !== null && (
                <button
                  type="button"
                  onClick={() =>
                    f.setFormState(prev => ({
                      ...prev,
                      price: f.markPrice!.toFixed(quoteDecimals),
                    }))
                  }
                  className="-mr-1 shrink-0 bg-state-hover px-1.5 py-0.5 text-[11px] text-fg-secondary hover:bg-state-pressed hover:text-fg-primary"
                >
                  Mark
                </button>
              )
            }
          />
        )}
        <Field
          id="ticket-size"
          label="Size"
          value={f.formState.size}
          onChange={size => f.setFormState(prev => ({ ...prev, size }))}
          unit={base}
          decimals={baseDecimals}
        />
        <SizeSlider percent={percent} onChange={setPercent} disabled={maxSize <= 0} />
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Checkbox
            checked={f.formState.reduceOnly}
            onChange={reduceOnly => f.setFormState(prev => ({ ...prev, reduceOnly }))}
          >
            Reduce only
          </Checkbox>
          {f.isMarketOrder ? (
            <Popover>
              <PopoverTrigger className="text-xs text-fg-tertiary hover:text-fg-primary">
                Slippage{' '}
                <span className="font-mono text-fg-secondary underline decoration-line-strong decoration-dotted underline-offset-4">
                  {f.formState.slippage}%
                </span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3">
                <p className="mb-2 text-xs text-fg-tertiary">
                  Cancel the order if it would fill further than this from the mark price.
                </p>
                <div className="grid grid-cols-4">
                  {SLIPPAGE_PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => f.setFormState(prev => ({ ...prev, slippage: p }))}
                      className={cn(
                        '-ml-px h-7 border text-xs first:ml-0',
                        f.formState.slippage === p
                          ? 'relative border-fg-primary bg-surface-inverse text-fg-inverse'
                          : 'border-[var(--glass-control)] text-fg-secondary hover:bg-state-hover'
                      )}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
        <Checkbox checked={f.enableSLTP} onChange={toggleSLTP}>
          Take profit / Stop loss
        </Checkbox>
        {f.enableSLTP && (
          <div className="grid grid-cols-2 gap-2">
            <Field
              id="ticket-tp"
              label="TP"
              value={f.formState.takeProfit}
              onChange={v => f.handleInputChange('takeProfit', v)}
              decimals={quoteDecimals}
            />
            <Field
              id="ticket-sl"
              label="SL"
              value={f.formState.stopLoss}
              onChange={v => f.handleInputChange('stopLoss', v)}
              decimals={quoteDecimals}
            />
          </div>
        )}
      </div>

      {/* Problems the simulator found, right above the button they affect */}
      {(rejects.length > 0 ||
        warnings.length > 0 ||
        f.feeInsufficient ||
        f.feeHealth === 'warn') && (
        <div className="flex flex-col gap-1.5 text-xs">
          {rejects.map((r, i) => (
            <p key={`r${i}`} className="flex items-start gap-1.5 text-negative-fg">
              <XCircle size={14} className="mt-px shrink-0" />
              {r}
            </p>
          ))}
          {warnings.map((w, i) => (
            <p key={`w${i}`} className="flex items-start gap-1.5 text-warning-fg">
              <Warning size={14} className="mt-px shrink-0" />
              {w}
            </p>
          ))}
          {f.publicKey && (f.feeInsufficient || f.feeHealth === 'warn') && (
            <p
              className={cn(
                'flex items-center justify-between',
                f.feeInsufficient ? 'text-negative-fg' : 'text-warning-fg'
              )}
            >
              {f.feeInsufficient ? 'Not enough fee credit' : 'Fee credit running low'}
              <button
                type="button"
                onClick={() => f.setFeeCreditOpen(true)}
                className="underline underline-offset-4 hover:text-fg-primary"
              >
                Top up
              </button>
            </p>
          )}
        </div>
      )}

      {/* Action */}
      {!f.publicKey ? (
        <button
          type="button"
          onClick={() => f.setVisible(true)}
          className="h-10 bg-surface-inverse text-sm font-medium text-fg-inverse transition-colors hover:bg-[var(--color-surface-inverse-hover)]"
        >
          Connect wallet
        </button>
      ) : (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => f.handleOpenPosition(side)}
          className={cn(
            'flex h-10 items-center justify-center gap-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            isBuy
              ? 'bg-positive-solid text-[var(--color-fg-on-positive,var(--color-fg-inverse))] hover:bg-positive-solid-hover'
              : 'bg-negative-solid text-[var(--color-fg-on-negative,var(--color-fg-inverse))] hover:bg-negative-solid-hover'
          )}
        >
          {f.submittingSide === side && <CircleNotch size={16} className="animate-spin" />}
          {f.submittingSide === side
            ? 'Placing order…'
            : `${isBuy ? 'Buy / Long' : 'Sell / Short'}${f.sizeValue > 0 ? ` ${f.formState.size} ${base}` : ''}`}
        </button>
      )}

      {/* Summary */}
      <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-3">
        <Row label="Order value">{orderValue > 0 ? `${fmt(orderValue)} ${quote}` : '—'}</Row>
        <Row label="Margin required">{margin !== null ? `${fmt(margin)} ${quote}` : '—'}</Row>
        <Row label="Est. liq. price">{liqPrice !== null ? fmt(liqPrice, quoteDecimals) : '—'}</Row>
        <Row
          label={
            <span className="flex items-center gap-1.5">
              Health after
              {f.simLoading && <CircleNotch size={11} className="animate-spin" />}
            </span>
          }
          className={
            healthAfter === undefined
              ? undefined
              : healthAfter < 10
                ? 'text-negative-fg'
                : healthAfter < 30
                  ? 'text-warning-fg'
                  : 'text-positive-fg'
          }
        >
          {healthAfter !== undefined ? `${healthAfter.toFixed(1)}%` : '—'}
        </Row>
        <Row label="Fee">{FEE_RATE}</Row>
      </div>
    </div>
  );
}
