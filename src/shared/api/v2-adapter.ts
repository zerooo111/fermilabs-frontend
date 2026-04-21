/**
 * v2 shape adapters — translate thin `/v2/snapshot/*` responses into the
 * native-scaled atom shapes the UI already consumes.
 *
 * These mirror the transforms in `sse-atom-bridge.ts` but start from the
 * v2 (Redis key dump) shapes instead of the legacy harness-shaped SSE
 * payloads. Keeping the atom shapes unchanged means zero UI wiring
 * changes for the canary.
 */
import type { Orderbook, OrderbookItem } from '@/entities/orderbook/model';
import type { MarketContext } from './sse-atom-bridge';
import type { V2OrderbookSnapshot, V2OrderbookLevel } from './v2-api';

// ── Orderbook ─────────────────────────────────────────────────────────
// v2 snapshot delivers one entry per *order* (price + order_id + order detail).
// The UI atom expects aggregated price levels with quantity totals. Aggregate
// by price, sum base_lots, then convert lots → native.

function lotsPriceToNative(
  priceLots: bigint,
  quoteLotSize: number,
  baseDecimals: number,
  baseLotSize: number
): number {
  const baseScale = BigInt(10) ** BigInt(baseDecimals);
  // (price_lots * quote_lot_size * 10^base_decimals) / base_lot_size
  return Number((priceLots * BigInt(quoteLotSize) * baseScale) / BigInt(Math.max(1, baseLotSize)));
}

function baseLotsToNative(baseLots: bigint, baseLotSize: number): number {
  return Number(baseLots * BigInt(baseLotSize));
}

function aggregateSide(
  levels: V2OrderbookLevel[],
  ctx: MarketContext,
  dir: 'bids' | 'asks'
): OrderbookItem[] {
  // Aggregate by price_lots (bigint) to avoid float drift when summing.
  const byPrice = new Map<string, bigint>();
  const priceLotsByKey = new Map<string, bigint>();

  for (const lvl of levels) {
    const o = lvl.order;
    if (!o) continue;
    let priceLots: bigint;
    try {
      priceLots = BigInt(o.price);
    } catch {
      continue;
    }
    let sizeLots: bigint;
    try {
      sizeLots = BigInt(o.size);
    } catch {
      continue;
    }
    const key = priceLots.toString();
    byPrice.set(key, (byPrice.get(key) ?? 0n) + sizeLots);
    priceLotsByKey.set(key, priceLots);
  }

  const items: OrderbookItem[] = [];
  for (const [key, sizeLots] of byPrice.entries()) {
    const priceLots = priceLotsByKey.get(key)!;
    items.push({
      price: lotsPriceToNative(priceLots, ctx.quoteLotSize, ctx.baseDecimals, ctx.baseLotSize),
      quantity: baseLotsToNative(sizeLots, ctx.baseLotSize),
    });
  }
  // Bids: highest first. Asks: lowest first.
  items.sort((a, b) => (dir === 'bids' ? b.price - a.price : a.price - b.price));
  return items;
}

export function mapV2Orderbook(snap: V2OrderbookSnapshot, ctx: MarketContext): Orderbook {
  return {
    bids: aggregateSide(snap.bids, ctx, 'bids'),
    asks: aggregateSide(snap.asks, ctx, 'asks'),
    lastUpdateId: Date.now(),
    lastUpdated: new Date(),
  };
}
