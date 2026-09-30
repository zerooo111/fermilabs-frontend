// Simulated SOL-PERP market for the landing page terminal demo. Nothing here
// touches the network: prices are a mean-reverting random walk around a
// fixed anchor, and the book is rebuilt around the mid on every tick.

export type Candle = { o: number; h: number; l: number; c: number };
export type Level = { price: number; size: number; flash: number };
export type Book = { asks: Level[]; bids: Level[] };

export const ANCHOR = 119.35;
export const TICK = 0.01;
const LEVELS = 8;
const STEP = 0.03; // price between book levels

const round = (v: number, step = TICK) => Math.round(v / step) * step;

// Small seeded PRNG so the chart history looks the same on every visit
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function nextPrice(price: number, rand: () => number) {
  const drift = (ANCHOR - price) * 0.04;
  return round(price + drift + (rand() - 0.5) * 0.12);
}

export function makeHistory(n: number, rand: () => number): Candle[] {
  const candles: Candle[] = [];
  let price = ANCHOR - 2.4;
  for (let i = 0; i < n; i++) {
    const o = price;
    let h = o;
    let l = o;
    // Trend gently up toward the anchor so the chart ends where the book is
    for (let k = 0; k < 6; k++) {
      price = round(price + (ANCHOR - price) * 0.02 + (rand() - 0.48) * 0.42);
      h = Math.max(h, price);
      l = Math.min(l, price);
    }
    candles.push({ o, h: h + rand() * 0.12, l: l - rand() * 0.12, c: price });
  }
  const last = candles[candles.length - 1];
  last.c = ANCHOR;
  last.h = Math.max(last.h, ANCHOR);
  last.l = Math.min(last.l, ANCHOR);
  return candles;
}

export function makeBook(mid: number, rand: () => number, prev?: Book): Book {
  const level = (price: number, i: number, old?: Level): Level => {
    const base = 0.6 + i * 1.35 + rand() * 1.4;
    // Most levels keep their size; a few change each tick and flash
    const changed = !old || rand() < 0.28;
    return {
      price,
      size: changed ? round(base, 0.01) : old.size,
      flash: changed && old ? 1 : 0,
    };
  };
  const best = round(mid - STEP / 2, TICK);
  const asks = Array.from({ length: LEVELS }, (_, i) =>
    level(round(best + STEP * (i + 1)), i, prev?.asks[i])
  );
  const bids = Array.from({ length: LEVELS }, (_, i) =>
    level(round(best - STEP * i), i, prev?.bids[i])
  );
  return { asks, bids };
}

export const fmt = (v: number, d = 2) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
