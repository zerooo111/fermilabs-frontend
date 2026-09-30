/**
 * Trade ticket: the compact order form used on /perps.
 *
 * Laid out the way traders expect: pick a side, pick market or limit, enter
 * size (or drag the margin slider), one button. Details that matter only sometimes (slippage, TP/SL) stay folded
 * until asked for, and the summary is a short list under the button.
 */
import { useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { CaretDown, Check, CircleNotch, Warning, XCircle } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';
import {
  marketBaseDecimals,
  marketQuoteDecimals,
  useOrderForm,
} from '@/features/order-placement/lib/useOrderForm';

const FEE_RATE = '0.01%';
const SLIPPAGE_PRESETS = ['0.1', '0.25', '0.5', '1'];
const MARGIN_TICKS = [0, 25, 50, 75, 100];
const MARGIN_PRESETS = [25, 50, 75, 100];

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
      className="flex h-9 items-center gap-2 border border-outline bg-card px-3 transition-colors focus-within:border-rock/60 hover:border-rock/40"
    >
      <span className="shrink-0 text-xs text-rock/50">{label}</span>
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
        className="min-w-0 flex-1 bg-transparent text-right font-mono text-sm tabular-nums text-rock outline-none placeholder:text-rock/30"
      />
      {unit && <span className="shrink-0 text-xs text-rock/70">{unit}</span>}
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
      className="flex items-center gap-2 text-xs text-rock/70 transition-colors hover:text-rock"
    >
      <span
        className={cn(
          'grid size-3.5 shrink-0 place-items-center border transition-colors',
          checked ? 'border-rock bg-rock text-background' : 'border-rock/40'
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
      <span className="text-rock/50">{label}</span>
      <span className={cn('font-mono tabular-nums text-rock', className)}>{children}</span>
    </div>
  );
}

function TickSlider({
  label,
  valueText,
  value,
  min,
  max,
  ticks,
  onChange,
  disabled = false,
  ariaLabel,
  ariaValueText,
}: {
  label: string;
  valueText: React.ReactNode;
  value: number;
  min: number;
  max: number;
  ticks: number[];
  onChange: (value: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  ariaValueText?: string;
}) {
  const at = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
  // End ticks sit flush with the track ends; the rest centre on their value
  const align = (v: number) =>
    v <= min ? 'translate-x-0' : v >= max ? '-translate-x-full' : '-translate-x-1/2';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-rock/50">{label}</span>
        <span className="font-mono tabular-nums text-rock/70">{valueText}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        aria-label={ariaLabel}
        className="relative -mx-[7px] flex h-5 touch-none select-none items-center data-[disabled]:opacity-40"
      >
        <SliderPrimitive.Track className="relative mx-[7px] h-0.5 grow bg-outline">
          <SliderPrimitive.Range className="absolute h-full bg-rock" />
        </SliderPrimitive.Track>
        {/* Radix keeps the 14px thumb inside the root, so its centre runs from
            7px to width - 7px. The root bleeds 7px past each side so that range
            is exactly the visible track, and the ticks use the same inset */}
        <span aria-hidden className="pointer-events-none absolute inset-x-[7px] inset-y-0">
          {ticks.map(t => (
            <span
              key={t}
              className={cn(
                'absolute top-1/2 size-1.5 -translate-y-1/2 border',
                align(t),
                value >= t ? 'border-rock bg-rock' : 'border-rock/40 bg-background'
              )}
              style={{ left: `${at(t)}%` }}
            />
          ))}
        </span>
        <SliderPrimitive.Thumb
          aria-valuetext={ariaValueText}
          className="block size-3.5 border-2 border-rock bg-background outline-none focus-visible:ring-2 focus-visible:ring-rock/40"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

// 1×, the quarter points and the max, e.g. [1, 10, 20, 30, 40]
// The usual leverage choices up to the market max, e.g. [1, 2, 3, 5, 10, 20, 40]
function leverageStops(max: number) {
  return [...[1, 2, 3, 5, 10, 20, 50, 100].filter(s => s < max), max];
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

  // Market orders price at mark; limit orders at the typed price. The margin
  // slider is the share of free collateral committed; at the chosen leverage
  // that buys available × leverage / price of size, so 100% is the largest order.
  const leverage = f.leverage;
  const refPrice = f.isMarketOrder ? (f.markPrice ?? 0) : f.priceValue;
  const available = f.accountMetrics?.free_collateral_snapshot ?? 0;
  const maxSize = refPrice > 0 ? (available * leverage) / refPrice : 0;
  const percent = maxSize > 0 ? Math.min(100, (f.sizeValue / maxSize) * 100) : 0;
  const marginUsed = (available * percent) / 100;
  const orderValue = refPrice * f.sizeValue;

  const stops = leverageStops(f.maxLeverage);
  // Highest stop at or below the current leverage
  const leverageIndex = Math.max(
    0,
    stops.findLastIndex(s => s <= leverage)
  );

  // Changing leverage keeps the committed margin and rescales the size
  const changeLeverage = (next: number) => {
    if (next === leverage) return;
    if (f.sizeValue > 0) {
      const size = (f.sizeValue * next) / leverage;
      f.setFormState(prev => ({ ...prev, size: size.toFixed(baseDecimals) }));
    }
    f.setLeverage(next);
  };

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
        leverage,
        marketInitialMarginBps: market?.perp_config?.initial_margin || 0,
      });
      return Number(result.requiredMargin) / 10 ** (baseDecimals + quoteDecimals);
    } catch {
      return null;
    }
  }, [
    refPrice,
    f.sizeValue,
    leverage,
    quoteDecimals,
    baseDecimals,
    market?.perp_config?.initial_margin,
  ]);

  // Where this position alone would hit zero maintenance health. Ignores the
  // rest of the cross-margin account, so it is only an estimate.
  const liqPrice =
    refPrice > 0 && f.sizeValue > 0
      ? isBuy
        ? (refPrice * (1 - 1 / leverage)) / f.maintAssetWeight
        : (refPrice * (1 + 1 / leverage)) / f.maintLiabWeight
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
    <div className="flex w-full flex-col gap-3 overflow-y-auto p-3 text-rock lg:w-xs [&>*]:shrink-0">
      {/* Side */}
      <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 bg-card p-0.5">
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
                    ? 'bg-success text-white'
                    : 'bg-danger text-white'
                  : 'text-rock/50 hover:text-rock'
              )}
            >
              {s === 'Buy' ? 'Buy / Long' : 'Sell / Short'}
            </button>
          );
        })}
      </div>

      {/* Order type, margin mode */}
      <div className="flex items-center justify-between border-b border-outline/60">
        <div role="tablist" aria-label="Order type" className="flex">
          {(['market', 'limit'] as const).map(t => {
            const active = f.formState.orderType === t;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  f.handleInputChange('orderType', t);
                  if (t === 'limit') toggleSLTP(false);
                }}
                className={cn(
                  '-mb-px h-8 border-b-2 px-3 text-sm capitalize transition-colors first:pl-0',
                  active
                    ? 'border-rock text-rock'
                    : 'border-transparent text-rock/50 hover:text-rock'
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
        {/* Margin mode and leverage are set-and-forget, so they live behind the badge */}
        <Popover>
          <PopoverTrigger className="flex items-center gap-1 border border-outline px-2 py-0.5 text-[11px] text-rock/70 transition-colors hover:border-rock/40 hover:text-rock">
            Cross · {leverage}×
            <CaretDown size={10} />
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-64 flex-col gap-3 p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-rock/50">Margin mode</span>
              <div
                role="radiogroup"
                aria-label="Margin mode"
                className="grid grid-cols-2 bg-card p-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked
                  className="h-7 bg-white/10 text-xs text-rock"
                >
                  Cross
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={false}
                  disabled
                  className="flex h-7 items-center justify-center gap-1.5 text-xs text-rock/40"
                >
                  Isolated
                  <span className="border border-outline px-1 text-[10px] leading-4">Soon</span>
                </button>
              </div>
            </div>
            {/* Leverage snaps to evenly spaced stops, so the slider works in stop
                indexes rather than raw multiples */}
            <TickSlider
              label="Leverage"
              valueText={`${leverage}×`}
              value={leverageIndex}
              min={0}
              max={stops.length - 1}
              ticks={stops.map((_, i) => i)}
              onChange={i => changeLeverage(stops[i])}
              ariaLabel="Leverage"
              ariaValueText={`${leverage}×`}
            />
            <p className="text-[11px] text-rock/50">Up to {f.maxLeverage}× on this market.</p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-1.5">
        <Row label="Available margin">{f.publicKey ? `${fmt(available)} ${quote}` : '—'}</Row>
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
                  className="-mr-1 shrink-0 bg-white/10 px-1.5 py-0.5 text-[11px] text-rock/70 hover:bg-white/15 hover:text-rock"
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
        <TickSlider
          label="Margin"
          valueText={
            <>
              {Math.round(percent)}%
              {marginUsed > 0 && (
                <span className="text-rock/50">
                  {' '}
                  · {fmt(marginUsed)} {quote}
                </span>
              )}
            </>
          }
          value={percent}
          min={0}
          max={100}
          ticks={MARGIN_TICKS}
          onChange={setPercent}
          disabled={maxSize <= 0}
          ariaLabel="Margin as a share of available collateral"
        />
        <div className="grid grid-cols-4 gap-1">
          {MARGIN_PRESETS.map(p => (
            <button
              key={p}
              type="button"
              disabled={maxSize <= 0}
              onClick={() => setPercent(p)}
              className={cn(
                'h-6 font-mono text-[11px] transition-colors hover:bg-white/10 hover:text-rock disabled:pointer-events-none disabled:opacity-40',
                Math.round(percent) === p ? 'bg-white/10 text-rock' : 'text-rock/50'
              )}
            >
              {p === 100 ? 'Max' : `${p}%`}
            </button>
          ))}
        </div>
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
              <PopoverTrigger className="text-xs text-rock/50 hover:text-rock">
                Slippage{' '}
                <span className="font-mono text-rock/70 underline decoration-rock/40 decoration-dotted underline-offset-4">
                  {f.formState.slippage}%
                </span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3">
                <p className="mb-2 text-xs text-rock/50">
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
                          ? 'relative border-rock bg-rock text-background'
                          : 'border-outline text-rock/70 hover:bg-white/10'
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
        {/* TP rides on a market entry only; a resting limit entry may never fill */}
        {f.isMarketOrder && (
          <Checkbox checked={f.enableSLTP} onChange={toggleSLTP}>
            Take profit
          </Checkbox>
        )}
        {f.isMarketOrder && f.enableSLTP && (
          <div className="flex flex-col gap-1.5">
            <Field
              id="ticket-tp"
              label="TP"
              value={f.formState.takeProfit}
              onChange={v => f.handleInputChange('takeProfit', v)}
              unit={quote}
              decimals={quoteDecimals}
            />
            <p className="text-[11px] text-rock/50">
              Placed as a reduce-only limit order once your entry goes through. Your wallet asks for
              a second signature.
            </p>
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
            <p key={`r${i}`} className="flex items-start gap-1.5 text-danger">
              <XCircle size={14} className="mt-px shrink-0" />
              {r}
            </p>
          ))}
          {warnings.map((w, i) => (
            <p key={`w${i}`} className="flex items-start gap-1.5 text-amber-400">
              <Warning size={14} className="mt-px shrink-0" />
              {w}
            </p>
          ))}
          {f.publicKey && (f.feeInsufficient || f.feeHealth === 'warn') && (
            <p
              className={cn(
                'flex items-center justify-between',
                f.feeInsufficient ? 'text-danger' : 'text-amber-400'
              )}
            >
              {f.feeInsufficient ? 'Not enough fee credit' : 'Fee credit running low'}
              <button
                type="button"
                onClick={() => f.setFeeCreditOpen(true)}
                className="underline underline-offset-4 hover:text-rock"
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
          className="h-10 bg-rock text-sm font-medium text-background transition-colors hover:bg-rock/90"
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
              ? 'bg-success text-white hover:brightness-125'
              : 'bg-danger text-white hover:brightness-125'
          )}
        >
          {f.submittingSide === side && <CircleNotch size={16} className="animate-spin" />}
          {f.submittingSide === side
            ? 'Placing order…'
            : `${isBuy ? 'Buy / Long' : 'Sell / Short'}${f.sizeValue > 0 ? ` ${f.formState.size} ${base}` : ''}`}
        </button>
      )}

      {/* Summary */}
      <div className="flex flex-col gap-1.5 border-t border-outline/60 pt-3">
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
                ? 'text-danger'
                : healthAfter < 30
                  ? 'text-amber-400'
                  : 'text-success'
          }
        >
          {healthAfter !== undefined ? `${healthAfter.toFixed(1)}%` : '—'}
        </Row>
        <Row label="Fee">{FEE_RATE}</Row>
      </div>
    </div>
  );
}
