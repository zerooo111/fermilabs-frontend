// A scripted, simulated replica of the Fermi Trade terminal for the landing
// page. The market ticks on its own; a cursor types an order size, opens a
// position, watches the PnL move, then closes it, alternating long and short.
// Rendered at a fixed design size and scaled to fit, like a screenshot that
// happens to be alive.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../lib/dither';
import {
  ANCHOR,
  type Book,
  type Candle,
  fmt,
  makeBook,
  makeHistory,
  nextPrice,
  rng,
} from './market';
import { BookPanel, ChartPanel, PositionsPanel, TradePanel, type Position } from './panels';

const FULL = { w: 1200, h: 720 };
const COMPACT = { w: 640, h: 720 };
const CANDLES = 64;
const TICK_MS = 380;
const TICKS_PER_CANDLE = 9;
const OPEN_24H = ANCHOR - 1.54;

type Side = 'buy' | 'sell';
type Toast = { id: number; title: string; detail: 'fill' | 'close'; latency: number; sig: string };
type Cursor = { x: number; y: number; dur: number; down: boolean; visible: boolean };

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const fakeSig = () =>
  Array.from({ length: 14 }, () => B58[Math.floor(Math.random() * B58.length)]).join('');

export default function TerminalDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const buyRef = useRef<HTMLButtonElement>(null);
  const sellRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [scale, setScale] = useState(1);
  const [compact, setCompact] = useState(false);
  const design = compact ? COMPACT : FULL;

  // Market
  const randRef = useRef(rng(7));
  const [candles, setCandles] = useState<Candle[]>(() => makeHistory(CANDLES, randRef.current));
  const [price, setPrice] = useState(ANCHOR);
  const [prevPrice, setPrevPrice] = useState(ANCHOR);
  const [book, setBook] = useState<Book>(() => makeBook(ANCHOR, randRef.current));

  // Trading
  const [size, setSize] = useState('');
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState<Side | 'close' | null>(null);
  const [submitting, setSubmitting] = useState<Side | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [cursor, setCursor] = useState<Cursor>({
    x: 820,
    y: 560,
    dur: 0,
    down: false,
    visible: false,
  });

  const visibleRef = useRef(false);
  const priceRef = useRef(price);
  priceRef.current = price;
  const bookRef = useRef(book);
  bookRef.current = book;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Fit the design size into the container
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const width = wrap.clientWidth;
      const isCompact = width < 720;
      setCompact(isCompact);
      setScale(width / (isCompact ? COMPACT.w : FULL.w));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Market ticks while on screen
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let timer = 0;
    let n = 0;
    const tick = () => {
      n++;
      const prev = priceRef.current;
      const next = nextPrice(prev, Math.random);
      priceRef.current = next;
      setPrevPrice(prev);
      setPrice(next);
      setCandles(cs => {
        const copy = cs.slice();
        if (n % TICKS_PER_CANDLE === 0) {
          copy.shift();
          copy.push({ o: next, h: next, l: next, c: next });
        } else {
          const last = { ...copy[copy.length - 1] };
          last.c = next;
          last.h = Math.max(last.h, next);
          last.l = Math.min(last.l, next);
          copy[copy.length - 1] = last;
        }
        return copy;
      });
      setBook(b => makeBook(next, randRef.current, b));
    };
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      window.clearInterval(timer);
      if (entry.isIntersecting && !prefersReducedMotion())
        timer = window.setInterval(tick, TICK_MS);
    });
    io.observe(wrap);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  // Centre of an element in design coordinates
  const pointOf = useCallback((el: Element | null) => {
    const stage = stageRef.current;
    if (!el || !stage) return null;
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = scaleRef.current;
    return { x: (r.left - s.left + r.width * 0.55) / k, y: (r.top - s.top + r.height * 0.6) / k };
  }, []);

  // The scripted session
  useEffect(() => {
    if (prefersReducedMotion()) {
      setPosition({ side: 'buy', size: 25, entry: ANCHOR - 0.08 });
      return;
    }
    let cancelled = false;
    const timers = new Set<number>();
    // Waits only count while the demo is on screen
    const pause = (ms: number) =>
      new Promise<void>(resolve => {
        const wait = () => {
          const id = window.setTimeout(() => {
            timers.delete(id);
            if (visibleRef.current) resolve();
            else wait();
          }, ms);
          timers.add(id);
        };
        wait();
      });
    const move = async (el: Element | null, dur: number) => {
      const p = pointOf(el);
      if (!p) return;
      setCursor(c => ({ ...c, x: p.x, y: p.y, dur, visible: true }));
      await pause(dur + 60);
    };
    const moveTo = async (x: number, y: number, dur: number) => {
      setCursor(c => ({ ...c, x, y, dur, visible: true }));
      await pause(dur + 60);
    };
    const click = async (what: Side | 'close' | null) => {
      setCursor(c => ({ ...c, down: true }));
      setPressed(what);
      await pause(130);
      setCursor(c => ({ ...c, down: false }));
      setPressed(null);
    };

    const run = async () => {
      let side: Side = 'buy';
      let toastId = 0;
      await pause(700);
      while (!cancelled) {
        await moveTo(compact ? 420 : 760, compact ? 250 : 330, 700);
        if (cancelled) return;
        await pause(250);

        await move(sizeRef.current, 650);
        if (cancelled) return;
        await click(null);
        setFocused(true);
        const qty = side === 'buy' ? '25' : '40';
        for (let i = 1; i <= qty.length; i++) {
          await pause(150);
          setSize(qty.slice(0, i));
        }
        await pause(280);
        setFocused(false);

        await move(side === 'buy' ? buyRef.current : sellRef.current, 550);
        if (cancelled) return;
        await click(side);
        setSubmitting(side);
        await pause(220);
        if (cancelled) return;

        // Fill against the best opposite level, which shrinks and flashes
        const b = bookRef.current;
        const level = side === 'buy' ? b.asks[0] : b.bids[0];
        const qn = Number(qty);
        setBook(prev => {
          const key = side === 'buy' ? 'asks' : 'bids';
          const levels = prev[key].slice();
          levels[0] = { ...levels[0], size: Math.max(0.12, levels[0].size * 0.35), flash: 1 };
          return { ...prev, [key]: levels };
        });
        setSubmitting(null);
        setSize('');
        setPosition({ side, size: qn, entry: level.price });
        setToast({
          id: ++toastId,
          title: `Market ${side === 'buy' ? 'buy' : 'sell'} filled · ${qn} SOL @ ${fmt(level.price)}`,
          detail: 'fill',
          latency: 28 + Math.random() * 34,
          sig: fakeSig(),
        });
        await pause(2600);
        setToast(null);
        await pause(900);

        await move(closeRef.current, 700);
        if (cancelled) return;
        await click('close');
        const exit = priceRef.current;
        const pnl = (exit - level.price) * qn * (side === 'buy' ? 1 : -1);
        setPosition(null);
        setToast({
          id: ++toastId,
          title: `Position closed · ${pnl >= 0 ? '+' : '-'}$${fmt(Math.abs(pnl))}`,
          detail: 'close',
          latency: 28 + Math.random() * 34,
          sig: fakeSig(),
        });
        await pause(2200);
        setToast(null);
        side = side === 'buy' ? 'sell' : 'buy';
      }
    };
    void run();
    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [compact, pointOf]);

  const change = ((price - OPEN_24H) / OPEN_24H) * 100;
  const up = price >= prevPrice;

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      style={{ height: design.h * scale }}
      role="img"
      aria-label="Animated demo of the Fermi Trade terminal: a trader opens and closes a SOL-PERP position with instant fills"
    >
      <div
        ref={stageRef}
        aria-hidden="true"
        className="demo-stage absolute top-0 left-0 flex origin-top-left flex-col overflow-hidden border border-[#436f59] bg-dark-forest font-sans text-rock shadow-[0_40px_120px_-30px_rgb(0_0_0/0.55)] select-none"
        style={{ width: design.w, height: design.h, transform: `scale(${scale})` }}
      >
        {/* Window chrome */}
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[#35654e] bg-[rgb(21_70_49)] px-3">
          <span className="size-2.5 rounded-full bg-rock/15" />
          <span className="size-2.5 rounded-full bg-rock/15" />
          <span className="size-2.5 rounded-full bg-rock/15" />
          <span className="mx-auto rounded-sm bg-rock/5 px-10 py-0.5 font-mono text-[11px] text-rock/45">
            app.fermi.trade/perps
          </span>
        </div>

        {/* App header */}
        <div className="flex h-12 shrink-0 items-center gap-6 border-b border-[#35654e] px-5">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-3 w-auto" />
            <span className="text-[19px]">Fermi Trade</span>
            <span className="border border-amber-200/60 px-1 text-[9px] font-semibold tracking-wider text-amber-200">
              BETA
            </span>
          </div>
          <span className="text-[15px]">Perps</span>
          {!compact && <span className="text-[15px] text-rock/50">Referrals</span>}
          <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">
            Mainnet
          </span>
          <div className="ml-auto flex items-center gap-3 font-mono text-xs">
            {!compact && <span className="text-rock/50">1,250.00 USDC</span>}
            <span className="border border-[#35654e] bg-rock/5 px-2.5 py-1.5">7xKq…9fQa</span>
          </div>
        </div>

        {/* Market bar */}
        <div className="flex h-[52px] shrink-0 items-stretch border-b border-[#35654e] text-xs">
          <div className="flex w-44 items-center justify-between border-r border-[#35654e] px-3 text-sm">
            SOL-PERP <span className="text-rock/50">⌄</span>
          </div>
          {[
            ['Mark Price', fmt(price), up ? 'text-success' : 'text-danger'],
            ['Oracle Price', fmt(price + 0.02), 'text-rock'],
            [
              '24h Change',
              `${change >= 0 ? '+' : ''}${fmt(change)}%`,
              change >= 0 ? 'text-success' : 'text-danger',
            ],
            ...(compact
              ? []
              : [
                  ['Funding Rate', '0.0012%', 'text-rock'],
                  ['Open Interest', '48,210 SOL', 'text-rock'],
                  ['24h Volume', '$6.42M', 'text-rock'],
                ]),
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className="flex flex-col justify-center border-r border-[#35654e] px-3"
            >
              <span className="text-rock/55">{label}</span>
              <span className={`font-mono text-[15px] tabular-nums ${tone}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex h-[380px] shrink-0 border-b border-[#35654e]">
          {!compact && <ChartPanel candles={candles} price={price} up={up} />}
          <BookPanel book={book} price={price} up={up} wide={compact} />
          <TradePanel
            sizeRef={sizeRef}
            buyRef={buyRef}
            sellRef={sellRef}
            size={size}
            focused={focused}
            pressed={pressed}
            submitting={submitting}
            price={price}
            wide={compact}
          />
        </div>

        {/* Bottom */}
        <PositionsPanel
          position={position}
          price={price}
          closeRef={closeRef}
          pressed={pressed === 'close'}
          compact={compact}
        />

        {/* Toast */}
        {toast && (
          <div
            key={toast.id}
            className="demo-toast absolute right-4 bottom-4 flex w-[340px] flex-col gap-1.5 border border-[#436f59] bg-dark-forest/80 px-4 py-3 font-mono shadow-[0_12px_40px_-12px_rgb(0_0_0/0.5)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 text-[13px]">
              <svg
                viewBox="0 0 16 16"
                className="size-4 shrink-0 text-green-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="6.5" />
                <path d="M5 8.2 7 10.2 11 6" />
              </svg>
              {toast.title}
            </div>
            <div className="flex items-center gap-3 pl-6 text-xs">
              <span className="text-green-400 tabular-nums">{toast.latency.toFixed(1)} ms</span>
              <span className="flex h-3 items-end gap-px">
                {[1.5, 2, 2.5, 3, 3.5].map(h => (
                  <span
                    key={h}
                    className="w-[2px] rounded-full bg-green-400"
                    style={{ height: h * 4 }}
                  />
                ))}
              </span>
              <span className="text-rock/20">·</span>
              <span className="text-rock/40">
                {toast.sig.slice(0, 8)}…{toast.sig.slice(-6)}
              </span>
            </div>
          </div>
        )}

        {/* Cursor */}
        <svg
          viewBox="0 0 20 24"
          className="pointer-events-none absolute top-0 left-0 z-10 h-6 w-5 drop-shadow-[0_2px_4px_rgb(0_0_0/0.5)]"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${cursor.down ? 0.86 : 1})`,
            transition: `transform ${cursor.down ? 90 : cursor.dur}ms cubic-bezier(0.45, 0, 0.2, 1), opacity 300ms`,
            opacity: cursor.visible ? 1 : 0,
          }}
        >
          <path
            d="M2 1.5v18l5-4.6 3.2 7 3-1.4-3.1-6.8H17z"
            fill="#fff"
            stroke="#185038"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
