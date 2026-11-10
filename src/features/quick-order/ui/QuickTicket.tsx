/**
 * Quick ticket: the basket review step.
 *
 * One line per order, the totals, and one button. The copy is deliberate
 * about what the protocol can do: the legs are separate intents on separate
 * execution queues, so they go out in order and may fill partially — the
 * all-or-none part is the pre-flight, which refuses the basket before
 * anything is signed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CircleNotch, Warning, XCircle } from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { cn } from '@/lib/utils';
import { TokenLogo } from '@/shared/ui/token-logo';
import { OneClickToggle } from '@/features/one-click';
import { describeLeg } from '../model/parse';
import {
  quickOrderBasketAtom,
  quickOrderInputAtom,
  quickOrderSlippageBpsAtom,
  quickOrderStageAtom,
} from '../model/atoms';
import { useBasketPlan } from '../model/useBasketPlan';
import type { QuickOrderMarketInfo } from '../model/useQuickOrderMarkets';
import { useSubmitBasket } from '../lib/useSubmitBasket';

const SLIPPAGE_PRESETS_BPS = [10, 25, 50, 100];

const usd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (bps: number) => `${(bps / 100).toLocaleString('en-US')}%`;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-rock/50">{label}</span>
      <span className="font-mono tabular-nums">{children}</span>
    </div>
  );
}

export function QuickTicket({ markets }: { markets: QuickOrderMarketInfo[] }) {
  const [stage, setStage] = useAtom(quickOrderStageAtom);
  const setInput = useSetAtom(quickOrderInputAtom);
  const legs = useAtomValue(quickOrderBasketAtom);
  const [slippageBps, setSlippageBps] = useAtom(quickOrderSlippageBpsAtom);
  const plan = useBasketPlan(legs, markets);
  const { submit, progress } = useSubmitBasket();
  const sending = progress !== null;

  const [activeRow, setActiveRow] = useState(0);
  const [slippageText, setSlippageText] = useState(String(slippageBps / 100));
  const rowsRef = useRef<HTMLOListElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const open = stage === 'ticket';

  // Fully keyboard-driven: Enter submits as soon as the ticket opens.
  useEffect(() => {
    if (open) {
      setActiveRow(0);
      setSlippageText(String(slippageBps / 100));
      submitRef.current?.focus();
    }
    // Only on open; the slippage field owns its text from then on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const focusRow = (next: number) => {
    const row = Math.max(0, Math.min(next, legs.length - 1));
    setActiveRow(row);
    rowsRef.current?.querySelector<HTMLElement>(`[data-row="${row}"]`)?.focus();
  };

  const setSlippage = (bps: number) => {
    setSlippageBps(bps);
    setSlippageText(String(bps / 100));
  };

  const send = useCallback(async () => {
    if (!plan.canSubmit || sending) return;
    const outcome = await submit(plan, slippageBps);
    // Anything that went out cannot be unsent, so close rather than leave a
    // half-sent basket one keystroke away from going out twice.
    if (outcome.sent > 0) {
      setInput('');
      setStage('closed');
    }
  }, [plan, sending, setInput, setStage, slippageBps, submit]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && tag !== 'INPUT') {
      e.preventDefault();
      focusRow(activeRow + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') {
      // Buttons answer Enter themselves (Cancel must stay Cancel); from a row
      // or the slippage field it sends the basket.
      e.preventDefault();
      void send();
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={next => {
        if (!next && !sending) setStage('closed');
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={e => e.preventDefault()}
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col border border-rock/25 bg-background text-rock shadow-2xl shadow-black/60 duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          {/* Header */}
          <div className="flex flex-col gap-0.5 border-b border-outline px-4 py-3">
            <DialogPrimitive.Title className="text-[11px] tracking-[0.2em] text-rock/50 uppercase">
              Quick ticket
            </DialogPrimitive.Title>
            <span className="text-base font-medium">
              {legs.length} market {legs.length === 1 ? 'order' : 'orders'}
            </span>
            {/* No cross-market atomicity on chain, so we do not claim any. */}
            <span className="text-xs text-rock/50">Sent in order · partial fills possible</span>
          </div>

          {/* Orders */}
          <ol ref={rowsRef} className="flex flex-col divide-y divide-outline/60">
            {plan.legs.map((planned, i) => (
              <li
                key={`${planned.leg.market.id}-${i}`}
                data-row={i}
                tabIndex={0}
                onFocus={() => setActiveRow(i)}
                className={cn(
                  'flex flex-col gap-1 px-4 py-2.5 outline-none transition-colors',
                  activeRow === i && 'bg-rock/5'
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-rock/40">Order {i + 1}</span>
                  <TokenLogo symbol={planned.leg.market.base} size={18} />
                  <span
                    className={cn(
                      'font-medium',
                      planned.leg.side === 'Buy' ? 'text-success' : 'text-danger'
                    )}
                  >
                    {describeLeg(planned.leg)}
                  </span>
                  <span className="ml-auto font-mono text-sm tabular-nums text-rock/70">
                    {planned.markPrice === null ? '—' : `≈ ${usd(planned.notional)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-14 text-[11px] text-rock/40">
                  <span>
                    Market · IOC · {pct(slippageBps)} max slippage · {planned.maxLeverage}× max
                  </span>
                </div>
                {planned.problem && (
                  <p className="flex items-center gap-1.5 pl-14 text-[11px] text-danger">
                    <XCircle size={12} /> {planned.problem}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {/* Slippage */}
          <div className="flex items-center justify-between gap-3 border-t border-outline px-4 py-2.5">
            <span className="text-xs text-rock/50">Max slippage</span>
            <div className="flex items-center gap-1">
              {SLIPPAGE_PRESETS_BPS.map(bps => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => setSlippage(bps)}
                  className={cn(
                    'h-6 border px-2 font-mono text-[11px] transition-colors',
                    slippageBps === bps
                      ? 'border-rock/60 text-rock'
                      : 'border-outline text-rock/50 hover:border-rock/40 hover:text-rock'
                  )}
                >
                  {pct(bps)}
                </button>
              ))}
              <input
                aria-label="Custom max slippage, percent"
                inputMode="decimal"
                value={slippageText}
                onChange={e => {
                  const text = e.target.value.replace(/[^\d.]/g, '');
                  setSlippageText(text);
                  const next = Number(text);
                  // Ignore nonsense and anything past 50%; the last good value stands
                  if (text !== '' && Number.isFinite(next) && next > 0 && next <= 50) {
                    setSlippageBps(Math.round(next * 100));
                  }
                }}
                className="h-6 w-14 border border-outline bg-card px-1.5 text-right font-mono text-[11px] text-rock outline-none focus:border-rock/60"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="flex flex-col gap-1.5 border-t border-outline px-4 py-3">
            <Row label="Total notional">{usd(plan.totalNotional)}</Row>
            <Row label="Total margin required">{usd(plan.totalMargin)}</Row>
            <Row label="Free collateral">
              <span className={plan.totalMargin > plan.freeCollateral ? 'text-danger' : undefined}>
                {usd(plan.freeCollateral)}
              </span>
            </Row>
          </div>

          {/* What stops the basket, and what the user should know before signing */}
          {(plan.blockers.length > 0 || plan.walletApprovals > 0) && (
            <div className="flex flex-col gap-1.5 border-t border-outline px-4 py-3 text-xs">
              {plan.blockers.map(blocker => (
                <p key={blocker} className="flex items-start gap-1.5 text-danger">
                  <XCircle size={14} className="mt-px shrink-0" />
                  {blocker}
                </p>
              ))}
              {plan.walletApprovals > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="flex items-start gap-1.5 text-amber-200">
                    <Warning size={14} className="mt-px shrink-0" />
                    {plan.walletApprovals} wallet approvals — one per order. Turn on one-click to
                    sign them locally.
                  </p>
                  <OneClickToggle />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-outline px-4 py-3">
            <button
              type="button"
              disabled={sending}
              onClick={() => setStage('palette')}
              className="h-9 border border-outline px-3 text-xs text-rock/70 transition-colors hover:border-rock/40 hover:text-rock disabled:opacity-40"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => setStage('closed')}
              className="h-9 px-3 text-xs text-rock/50 transition-colors hover:text-rock disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              ref={submitRef}
              type="button"
              disabled={!plan.canSubmit || sending}
              onClick={() => void send()}
              className="ml-auto flex h-9 items-center justify-center gap-2 bg-rock px-4 text-sm font-semibold text-dark-forest transition-colors hover:bg-rock/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {progress && <CircleNotch size={14} className="animate-spin" />}
              {progress
                ? `Sending ${Math.min(progress.sent + 1, progress.total)} of ${progress.total}…`
                : `Send ${legs.length} ${legs.length === 1 ? 'order' : 'orders'}`}
            </button>
          </div>

          <div className="hidden items-center gap-4 border-t border-outline px-4 py-2 text-[11px] text-rock/40 sm:flex">
            <span>Enter Send</span>
            <span>↑↓ Orders</span>
            <span>Esc Close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
