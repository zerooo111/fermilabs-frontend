/**
 * Quick multi-order palette (⌘K / Ctrl+K).
 *
 * One line of text becomes a basket of market orders: "long 2 SOL, short 0.5
 * BTC, l 1,000 JLP". Parsing is live, so every leg shows its size, its market
 * and its notional — or why it does not resolve — before Enter hands the
 * basket to the quick ticket.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Lightning, MagnifyingGlass, XCircle } from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { cn } from '@/lib/utils';
import { TokenLogo } from '@/shared/ui/token-logo';
import { favoriteMarketIdsAtom } from '@/features/market-selector/model/favorites';
import { MAX_BASKET_LEGS, parseQuickOrder } from '../model/parse';
import {
  quickOrderBasketAtom,
  quickOrderInputAtom,
  quickOrderRecentBasesAtom,
  quickOrderStageAtom,
} from '../model/atoms';
import { useQuickOrderMarkets } from '../model/useQuickOrderMarkets';
import { QuickTicket } from './QuickTicket';

const usd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border border-outline px-1.5 font-mono text-[10px] leading-4 text-rock/70">
      {children}
    </kbd>
  );
}

/** True when the keystroke belongs to whatever the user is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

export function QuickOrderPalette() {
  const [stage, setStage] = useAtom(quickOrderStageAtom);
  const [input, setInput] = useAtom(quickOrderInputAtom);
  const setBasket = useSetAtom(quickOrderBasketAtom);
  const favorites = useAtomValue(favoriteMarketIdsAtom);
  const recentBases = useAtomValue(quickOrderRecentBasesAtom);

  const markets = useQuickOrderMarkets(stage !== 'closed');
  const parsed = useMemo(() => parseQuickOrder(input, markets), [input, markets]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K opens the palette and closes it again. While the user is
  // typing somewhere else the shortcut stays out of the way, unless the
  // palette is the thing they are typing in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      const closed = stage === 'closed';
      if (closed && isTypingTarget(e.target)) return;
      e.preventDefault();
      setStage(closed ? 'palette' : 'closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, setStage]);

  // Reopening keeps the last command, selected so typing replaces it.
  useEffect(() => {
    if (stage === 'palette') inputRef.current?.select();
  }, [stage]);

  const review = () => {
    if (!parsed.valid) return;
    setBasket(parsed.legs.flatMap(l => (l.ok ? [l.leg] : [])));
    setStage('ticket');
  };

  const hintBases = useMemo(() => {
    const favoured = markets.filter(m => favorites.includes(m.id)).map(m => m.base);
    const recent = recentBases.filter(b => markets.some(m => m.base === b));
    const rest = markets.map(m => m.base);
    return [...new Set([...favoured, ...recent, ...rest])].slice(0, 8);
  }, [markets, favorites, recentBases]);

  return (
    <>
      <DialogPrimitive.Root
        open={stage === 'palette'}
        onOpenChange={next => setStage(next ? 'palette' : 'closed')}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-[14vh] left-1/2 z-50 flex w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 flex-col border border-rock/25 bg-background text-rock shadow-2xl shadow-black/60 duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
          >
            <DialogPrimitive.Title className="sr-only">Quick multi-order</DialogPrimitive.Title>

            {/* Command line */}
            <div className="flex items-center gap-3 border-b border-outline px-4">
              <MagnifyingGlass size={16} className="shrink-0 text-rock/50" />
              <input
                ref={inputRef}
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    review();
                  }
                }}
                placeholder="long 2 SOL, short 0.5 BTC"
                aria-label="Quick order command"
                spellCheck={false}
                autoComplete="off"
                className="h-12 w-full bg-transparent font-mono text-base text-rock outline-none placeholder:font-sans placeholder:text-rock/40"
              />
              <DialogPrimitive.Close
                aria-label="Close"
                className="border border-outline px-1.5 font-mono text-[10px] leading-4 text-rock/60 transition-colors hover:border-rock/40 hover:text-rock"
              >
                Esc
              </DialogPrimitive.Close>
            </div>

            {/* Live parse */}
            {parsed.legs.length > 0 ? (
              <ol className="flex flex-col divide-y divide-outline/60">
                {parsed.legs.map((leg, i) => {
                  if (!leg.ok) {
                    return (
                      <li
                        key={`${i}-${leg.raw}`}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm"
                      >
                        <XCircle size={16} className="shrink-0 text-danger" />
                        <span className="font-mono text-rock/50">{leg.raw}</span>
                        <span className="ml-auto text-right text-xs text-danger">{leg.error}</span>
                      </li>
                    );
                  }
                  const info = markets.find(m => m.id === leg.leg.market.id);
                  const notional = info?.markPrice ? info.markPrice * leg.leg.size : null;
                  return (
                    <li
                      key={`${i}-${leg.raw}`}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm"
                    >
                      <TokenLogo symbol={leg.leg.market.base} size={18} />
                      <span
                        className={cn(
                          'w-12 font-medium',
                          leg.leg.side === 'Buy' ? 'text-success' : 'text-danger'
                        )}
                      >
                        {leg.leg.side === 'Buy' ? 'Long' : 'Short'}
                      </span>
                      <span className="font-mono tabular-nums">
                        {leg.leg.size.toLocaleString('en-US')}
                      </span>
                      <span className="text-rock/70">{leg.leg.market.base}</span>
                      <span className="ml-auto font-mono text-sm tabular-nums text-rock/60">
                        {notional === null ? 'no mark price' : `≈ ${usd(notional)}`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="flex flex-col gap-2 px-4 py-5 text-xs text-rock/50">
                <p>
                  Type one order per comma: <span className="font-mono text-rock/70">side</span>{' '}
                  <span className="font-mono text-rock/70">size</span>{' '}
                  <span className="font-mono text-rock/70">market</span> — up to {MAX_BASKET_LEGS}{' '}
                  of them.
                </p>
                <p className="font-mono text-rock/40">long 2 SOL, short 0.5 BTC, l 100 JLP</p>
                {hintBases.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-rock/40">Markets</span>
                    {hintBases.map(base => (
                      <button
                        key={base}
                        type="button"
                        onClick={() => {
                          setInput(prev => `${prev.trim() ? `${prev}, ` : ''}long 1 ${base}`);
                          inputRef.current?.focus();
                        }}
                        className="border border-outline px-1.5 py-0.5 font-mono text-[11px] text-rock/70 transition-colors hover:border-rock/40 hover:text-rock"
                      >
                        {base}
                      </button>
                    ))}
                  </p>
                )}
              </div>
            )}

            {parsed.error && (
              <p className="flex items-center gap-1.5 border-t border-outline px-4 py-2.5 text-xs text-danger">
                <XCircle size={14} /> {parsed.error}
              </p>
            )}

            {/* Shortcuts */}
            <div className="flex items-center gap-4 border-t border-outline px-4 py-2 text-[11px] text-rock/50">
              <span className="flex items-center gap-1.5">
                <Kbd>Enter</Kbd> Review
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Esc</Kbd> Close
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <Lightning size={12} />
                {parsed.legs.length === 0
                  ? 'Market orders · IOC'
                  : `${parsed.legs.filter(l => l.ok).length} of ${parsed.legs.length} ready`}
              </span>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Mounted only while reviewing, so its pre-flight hooks stay idle */}
      {stage === 'ticket' && <QuickTicket markets={markets} />}
    </>
  );
}
