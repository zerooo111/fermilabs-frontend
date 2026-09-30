// Panels of the terminal demo, laid out like the real /perps page at a fixed
// design size (see TerminalDemo). Pure presentation: all state comes in as
// props.

import type { RefObject } from 'react';

import { type Book, type Candle, fmt } from './market';

export type Position = { side: 'buy' | 'sell'; size: number; entry: number };

const LEVERAGE = 5;
const BALANCE = 1250;
const GREEN = '#10b981'; // --color-success, as on /perps
const RED = '#ef4444'; // --color-danger, as on /perps

export function ChartPanel({
  candles,
  price,
  up,
}: {
  candles: Candle[];
  price: number;
  up: boolean;
}) {
  const W = 600;
  const H = 348;
  const AXIS = 62;
  const PAD = 18;
  const hi = Math.max(...candles.map(c => c.h)) + 0.15;
  const lo = Math.min(...candles.map(c => c.l)) - 0.15;
  const y = (v: number) => PAD + ((hi - v) / (hi - lo)) * (H - PAD * 2);
  const step = (W - AXIS) / candles.length;
  const ticks = Array.from({ length: 6 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 6);
  const py = y(price);

  return (
    <div className="flex w-[600px] shrink-0 flex-col border-r border-[#35654e]">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[#35654e] px-2 text-xs text-rock/50">
        {['1m', '5m', '15m', '1h', '4h', '1d'].map(t => (
          <span key={t} className={`px-2 py-1 ${t === '15m' ? 'bg-rock/10 text-rock' : ''}`}>
            {t}
          </span>
        ))}
        <span className="ml-auto pr-2 font-mono text-[11px] text-rock/40">SOL-PERP · 15m</span>
      </div>
      <svg width={W} height={H} className="block font-mono">
        {ticks.map(t => (
          <g key={t}>
            <line x1="0" x2={W - AXIS} y1={y(t)} y2={y(t)} stroke="rgb(248 247 231 / 0.07)" />
            <text x={W - AXIS + 8} y={y(t) + 4} fontSize="11" fill="rgb(248 247 231 / 0.55)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {candles.map((c, i) => {
          const x = i * step + step / 2;
          const color = c.c >= c.o ? GREEN : RED;
          const top = y(Math.max(c.o, c.c));
          const body = Math.max(1, Math.abs(y(c.o) - y(c.c)));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1" />
              <rect x={x - step * 0.32} y={top} width={step * 0.64} height={body} fill={color} />
            </g>
          );
        })}
        <line
          x1="0"
          x2={W - AXIS}
          y1={py}
          y2={py}
          stroke="rgb(248 247 231 / 0.55)"
          strokeDasharray="2 3"
        />
        <rect x={W - AXIS + 2} y={py - 9} width={AXIS - 4} height="18" fill={up ? GREEN : RED} />
        <text x={W - AXIS + 8} y={py + 4} fontSize="11" fill="#fff">
          {fmt(price)}
        </text>
      </svg>
    </div>
  );
}

export function BookPanel({
  book,
  price,
  up,
  wide,
}: {
  book: Book;
  price: number;
  up: boolean;
  wide: boolean;
}) {
  const cum = (levels: Book['asks']) => {
    let t = 0;
    return levels.map(l => (t += l.size));
  };
  const askCum = cum(book.asks);
  const bidCum = cum(book.bids);
  const max = Math.max(askCum[askCum.length - 1], bidCum[bidCum.length - 1]);
  const spread = book.asks[0].price - book.bids[0].price;

  const row = (l: Book['asks'][number], total: number, side: 'ask' | 'bid') => (
    <div
      // Remount when the size changes so the flash animation replays
      key={`${l.price}-${l.size}`}
      className={`relative flex h-[17px] items-center justify-between px-4 font-mono text-xs tabular-nums ${l.flash ? 'demo-flash' : ''}`}
    >
      <span
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{
          width: `${(total / max) * 100}%`,
          background: side === 'ask' ? 'rgb(239 68 68 / 0.25)' : 'rgb(16 185 129 / 0.25)',
        }}
      />
      <span className={`relative w-16 ${side === 'ask' ? 'text-danger' : 'text-success'}`}>
        {fmt(l.price)}
      </span>
      <span className="relative w-14 text-right">{fmt(l.size)}</span>
      <span className="relative w-20 text-right text-rock/70">{fmt(total * l.price)}</span>
    </div>
  );

  return (
    <div
      className={`flex shrink-0 flex-col border-r border-[#35654e] ${wide ? 'w-[320px]' : 'w-[300px]'}`}
    >
      <div className="flex h-9 shrink-0 items-center justify-center border-b border-[#35654e] text-sm">
        Orderbook
      </div>
      <div className="flex h-[26px] shrink-0 items-center justify-between border-b border-[#35654e] px-4 font-mono text-[11px] text-rock/50">
        <span className="w-16">Price</span>
        <span className="w-14 text-right">Size</span>
        <span className="w-20 text-right">Total</span>
      </div>
      <div className="flex flex-col py-1">
        {book.asks.map((l, i) => row(l, askCum[i], 'ask')).reverse()}
      </div>
      <div className="flex h-6 shrink-0 items-center justify-between border-y border-[#35654e] bg-rock/[0.03] px-4 font-mono text-xs">
        <span className={up ? 'text-success' : 'text-danger'}>{fmt(price)}</span>
        <span className="text-rock/50">Spread {fmt(spread)}</span>
      </div>
      <div className="flex flex-col py-1">{book.bids.map((l, i) => row(l, bidCum[i], 'bid'))}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round" />
    </svg>
  );
}

export function TradePanel({
  sizeRef,
  buyRef,
  sellRef,
  size,
  focused,
  pressed,
  submitting,
  price,
  wide,
}: {
  sizeRef: RefObject<HTMLDivElement>;
  buyRef: RefObject<HTMLButtonElement>;
  sellRef: RefObject<HTMLButtonElement>;
  size: string;
  focused: boolean;
  pressed: 'buy' | 'sell' | 'close' | null;
  submitting: 'buy' | 'sell' | null;
  price: number;
  wide: boolean;
}) {
  const qty = Number(size) || 0;
  const summary: [string, string][] = [
    ['Size', qty ? `${fmt(qty)} SOL` : '—'],
    ['Margin', qty ? `$${fmt((qty * price) / LEVERAGE)}` : '—'],
    ['Est. Liq. Price', qty ? fmt(price * (1 - 0.9 / LEVERAGE)) : '—'],
    ['Fee', '0.01%'],
  ];

  return (
    <div className={`flex shrink-0 flex-col ${wide ? 'w-[320px]' : 'w-[300px]'}`}>
      <div className="grid h-11 shrink-0 grid-cols-2 border-b border-[#35654e] text-sm">
        <span className="flex items-center justify-center text-rock/50">Limit</span>
        <span className="flex items-center justify-center border-b-2 border-rock">Market</span>
      </div>
      <div className="flex flex-col gap-3 p-3.5 text-sm">
        <div className="flex flex-col gap-1.5">
          <span>Size</span>
          <div
            ref={sizeRef}
            className={`flex h-9 items-center justify-between border px-3 font-mono transition-colors duration-150 ${
              focused ? 'border-[#a3b89c] bg-rock/[0.04]' : 'border-[#436f59]'
            }`}
          >
            <span className={size ? 'text-rock' : 'text-rock/35'}>
              {size || '0.00'}
              {focused && (
                <span className="demo-caret ml-px inline-block h-4 w-px translate-y-0.5 bg-rock" />
              )}
            </span>
            <span className="text-xs">SOL</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Leverage</span>
          <span className="font-mono">{LEVERAGE}×</span>
        </div>
        <div className="relative h-1 bg-rock/10">
          <span className="absolute inset-y-0 left-0 w-1/4 bg-rock" />
          <span className="absolute top-1/2 left-1/4 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dark-forest bg-rock" />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(['buy', 'sell'] as const).map(side => (
            <button
              key={side}
              ref={side === 'buy' ? buyRef : sellRef}
              type="button"
              tabIndex={-1}
              className={`flex h-[38px] items-center justify-center gap-2 text-sm font-medium text-white transition-transform duration-100 ${
                pressed === side ? 'scale-95 brightness-125' : ''
              }`}
              style={{ background: side === 'buy' ? GREEN : RED }}
            >
              {submitting === side ? (
                <>
                  <Spinner />
                  {side === 'buy' ? 'Buying...' : 'Selling...'}
                </>
              ) : side === 'buy' ? (
                'Buy / Long'
              ) : (
                'Sell / Short'
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 border border-[#35654e] p-3 text-xs">
          {summary.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-rock/70">{k}</span>
              <span className="font-mono tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PositionsPanel({
  position,
  price,
  closeRef,
  pressed,
  compact,
}: {
  position: Position | null;
  price: number;
  closeRef: RefObject<HTMLButtonElement>;
  pressed: boolean;
  compact: boolean;
}) {
  const pnl = position
    ? (price - position.entry) * position.size * (position.side === 'buy' ? 1 : -1)
    : 0;
  const margin = position ? (position.size * position.entry) / LEVERAGE : 0;
  const cols = compact
    ? ['Side', 'Size', 'Entry', 'PnL', '']
    : ['Side', 'Market', 'Size', 'Entry Price', 'Mark Price', 'PnL', 'Actions'];
  const grid = compact
    ? 'grid-cols-[70px_1fr_1fr_1fr_70px]'
    : 'grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_90px]';
  const pnlTone = pnl >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-6 border-b border-[#35654e] px-4 text-sm">
          <span className="border-b-2 border-rock py-2.5">Positions ({position ? 1 : 0})</span>
          <span className="text-rock/50">Open Orders</span>
          {!compact && <span className="text-rock/50">Trade History</span>}
        </div>
        <div
          className={`grid ${grid} h-8 shrink-0 items-center border-b border-[#35654e] px-4 text-xs text-rock/50`}
        >
          {cols.map((c, i) => (
            <span key={c || i} className={i > 1 ? 'text-right' : ''}>
              {c}
            </span>
          ))}
        </div>
        {position ? (
          <div
            className={`demo-row-in grid ${grid} h-10 items-center border-b border-[#35654e] px-4 font-mono text-xs tabular-nums`}
          >
            <span>
              <span
                className={`px-1.5 py-0.5 font-sans ${
                  position.side === 'buy'
                    ? 'bg-success/15 text-success'
                    : 'bg-danger/15 text-danger'
                }`}
              >
                {position.side === 'buy' ? 'Long' : 'Short'}
              </span>
            </span>
            {!compact && <span className="font-sans">SOL-PERP</span>}
            <span className="text-right">{fmt(position.size)}</span>
            <span className="text-right">{fmt(position.entry)}</span>
            {!compact && <span className="text-right">{fmt(price)}</span>}
            <span className={`text-right ${pnlTone}`}>
              {pnl >= 0 ? '+' : '-'}${fmt(Math.abs(pnl))}
            </span>
            <span className="text-right">
              <button
                ref={closeRef}
                type="button"
                tabIndex={-1}
                className={`border border-[#436f59] px-2.5 py-1 font-sans text-xs transition-transform duration-100 ${
                  pressed ? 'scale-95 bg-rock/15' : ''
                }`}
              >
                Close
              </button>
            </span>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-rock/35">
            No open positions
          </div>
        )}
      </div>
      {!compact && (
        <div className="flex w-[300px] shrink-0 flex-col gap-2.5 border-l border-[#35654e] p-4 text-xs">
          <span className="mb-1 text-sm">Account</span>
          {(
            [
              ['Equity', `$${fmt(BALANCE + pnl)}`, ''],
              [
                'Unrealized PnL',
                `${pnl >= 0 ? '+' : '-'}$${fmt(Math.abs(pnl))}`,
                position ? pnlTone : '',
              ],
              ['Margin Used', `$${fmt(margin)}`, ''],
              ['Free Collateral', `$${fmt(BALANCE + pnl - margin)}`, ''],
            ] as const
          ).map(([k, v, tone]) => (
            <div key={k} className="flex justify-between">
              <span className="text-rock/60">{k}</span>
              <span className={`font-mono tabular-nums ${tone}`}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
