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
import type { SSEMarketMetrics, SSEMarketMetadata } from './sse-types';
import type { Market, MarketKind } from '@/entities/market';
import type { Order } from './useSequencerApi';
import type { Position } from '@/shared/hooks/usePositions';
import type { MarginAccount } from '@/shared/hooks/useAccount';
import type { TokenBalance } from './useSequencerApi';
import { lotsQuoteToNative } from '@/shared/lib/harness-market';

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

// ── Meta event ────────────────────────────────────────────────────────
// Composite stream's `event: meta` payload:
//   { market: number, meta: Record<string, string> }
// where meta fields are the raw v1:meta:market:<id> hash from Redis.
// We turn it into the three legacy shapes the UI already consumes:
//   - SSEMarketMetrics  (mark/oracle/funding/open_interest)
//   - SSEMarketMetadata (name, symbols, mints, PDAs, decimals, lot sizes)
//   - Market patch       (mark_price, index_price, funding bps on marketsAtom entry)

export interface V2MetaEvent {
  market: number | string;
  meta: Record<string, string>;
}

const num = (v: string | undefined, fallback = 0): number => {
  if (v === undefined) return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function metaFieldNumber(meta: Record<string, string>, key: string, fallback = 0): number {
  return num(meta[key], fallback);
}

/**
 * Derive oracle_price_ui from the native `oracle_price` stored in the meta
 * hash. The harness writes native-scaled oracle (~$859) but the UI expects
 * price-per-base-unit (~$85.9). Conversion is `oracle / 10^(quote_decimals -
 * base_decimals)`, matching `buildMarketRuntimeMetrics` on the harness side.
 */
function nativePriceToUi(nativePrice: number, meta: Record<string, string>): number {
  const baseDecimals = metaFieldNumber(meta, 'base_decimals');
  const quoteDecimals = metaFieldNumber(meta, 'quote_decimals');
  const diff = quoteDecimals - baseDecimals;
  if (!Number.isFinite(nativePrice)) return 0;
  if (diff === 0) return nativePrice;
  return nativePrice / Math.pow(10, diff);
}

export function mapV2MetaToMetadata(event: V2MetaEvent): SSEMarketMetadata {
  const m = event.meta;
  return {
    market_index: Number(event.market ?? m.market ?? 0),
    name: m.name ?? `Market ${event.market}`,
    base_symbol: m.base_symbol ?? '',
    quote_symbol: m.quote_symbol ?? '',
    base_mint: m.base_mint ?? '',
    quote_mint: m.quote_mint ?? '',
    perp_market: m.perp_market ?? '',
    oracle: m.oracle ?? '',
    bids: m.bids ?? '',
    asks: m.asks ?? '',
    event_queue: m.event_queue ?? '',
    base_decimals: metaFieldNumber(m, 'base_decimals'),
    quote_decimals: metaFieldNumber(m, 'quote_decimals'),
    base_lot_size: m.base_lot_size ?? '1',
    quote_lot_size: m.quote_lot_size ?? '1',
    open_interest: m.open_interest ?? '0',
  };
}

/**
 * Client-side best_bid / best_ask come from the `book` event and are
 * fed in here so metrics shows a full snapshot when meta updates. Both
 * optional; undefined → 0.
 */
export function mapV2MetaToMetrics(
  event: V2MetaEvent,
  bestBidUi?: number | null,
  bestAskUi?: number | null
): SSEMarketMetrics {
  const m = event.meta;
  const marketStr = String(event.market ?? m.market ?? '');
  const oracleNative = metaFieldNumber(m, 'oracle_price');
  const markFromMeta = m.mark_price !== undefined ? num(m.mark_price) : NaN;
  // Mirror stores mark_price already in UI scale; oracle_price in native.
  const markPriceUi = Number.isFinite(markFromMeta)
    ? markFromMeta
    : nativePriceToUi(oracleNative, m);
  const oraclePriceUi = nativePriceToUi(oracleNative, m);
  const openInterestBaseLots = m.open_interest ?? '0';
  const baseLotSize = metaFieldNumber(m, 'base_lot_size', 1);
  const baseDecimals = metaFieldNumber(m, 'base_decimals');
  const openInterestBaseUi =
    (Number(openInterestBaseLots) * baseLotSize) / Math.pow(10, baseDecimals);
  return {
    market: marketStr,
    oracle_price_ui: oraclePriceUi,
    mark_price_ui: markPriceUi,
    funding_rate_daily_pct: metaFieldNumber(m, 'funding_rate_daily'),
    funding_rate_hourly_pct: metaFieldNumber(m, 'funding_rate_hourly'),
    open_interest_base_lots: openInterestBaseLots,
    open_interest_base_ui: openInterestBaseUi,
    best_bid_ui: bestBidUi ?? 0,
    best_ask_ui: bestAskUi ?? 0,
    updated_ts_ms: metaFieldNumber(m, 'ts_ms'),
  };
}

export function mapV2MetaToMarket(event: V2MetaEvent): Market {
  const meta = event.meta;
  const marketStr = String(event.market ?? meta.market ?? '');
  const quoteDecimals = metaFieldNumber(meta, 'quote_decimals');
  const quoteScale = Math.pow(10, quoteDecimals);
  const oraclePriceUi = nativePriceToUi(metaFieldNumber(meta, 'oracle_price'), meta);
  const markPriceUi = num(meta.mark_price, oraclePriceUi);
  const fundingHourlyPct = metaFieldNumber(meta, 'funding_rate_hourly');
  const updatedTsMs = metaFieldNumber(meta, 'ts_ms', Date.now());
  return {
    uuid: marketStr,
    name: meta.name || `Market ${marketStr}`,
    base_mint: meta.base_mint ?? '',
    quote_mint: meta.quote_mint ?? '',
    created_at: 0,
    kind: 'perp' as MarketKind,
    perp_config: null,
    perp_state: {
      mark_price: Math.round(markPriceUi * quoteScale),
      mark_price_timestamp: updatedTsMs,
      index_price: Math.round(oraclePriceUi * quoteScale),
      index_price_timestamp: updatedTsMs,
      last_premium_rate_bps: 0,
      last_funding_rate_bps: Math.round(fundingHourlyPct * 100),
      funding_rate_bps: Math.round(fundingHourlyPct * 100),
      last_funding_timestamp: updatedTsMs,
      next_funding_timestamp: null,
    },
    base_decimals: metaFieldNumber(meta, 'base_decimals'),
    quote_decimals: quoteDecimals,
    base_lot_size: metaFieldNumber(meta, 'base_lot_size', 1),
    quote_lot_size: metaFieldNumber(meta, 'quote_lot_size', 1),
    price_decimals: quoteDecimals,
    open_interest: Number(meta.open_interest ?? 0),
  };
}

// ── Account event ─────────────────────────────────────────────────────
// Composite stream's `event: account` payload:
//   {
//     owner, market, view,
//     balances: Record<asset, string>,
//     margin_summary: { account_count, totals: {equity/assets/liabs/...},
//                       ... per-account rows },
//     positions: Array<{ market: string, fields: {base, quote, open_bid,
//                      open_ask, reserved, ts_ms} }>,
//     orders:   Array<{ order_id, market, order: {owner, price, size,
//                      side, ts_ms, client_id} }>,
//   }

export interface V2AccountEvent {
  owner: string;
  market: number | string;
  view: 'opt' | 'conf';
  balances?: Record<string, string>;
  margin_summary?: {
    account_count?: number;
    totals?: {
      equity_native_quote?: string;
      pnl_native_quote?: string;
      assets_native_quote?: string;
      liabs_native_quote?: string;
      init_health_native_quote?: string;
      maint_health_native_quote?: string;
      margin_usage_fraction?: number;
    };
  } | null;
  positions?: Array<{
    market: string;
    fields: {
      base?: string;
      quote?: string;
      open_bid?: string;
      open_ask?: string;
      reserved?: string;
      ts_ms?: string;
      avg_entry_price?: string;
      avg_entry_price_per_base_lot?: string;
      average_entry_price?: string;
      mark_price_ui?: string;
      market_name?: string;
      // Redis stores all values as strings — use parseFloat() when reading
      pnl_unrealized_ui?: string;
      trade_pnl_ui?: string;
      pnl_unrealized_native_quote?: string;
      trade_pnl_native_quote?: string;
    };
  }>;
  orders?: Array<{
    order_id: string;
    market: string;
    order: {
      owner?: string;
      price?: string;
      size?: string;
      side?: 'bid' | 'ask';
      ts_ms?: number | string;
      client_id?: string | number | null;
    } | null;
  }>;
  // Per-asset token balances, mirrored verbatim from the harness's
  // optimistic-collateral computation (same shape as legacy
  // `optimistic_collateral`). Null until the harness mirror extension lands.
  tokens?: {
    source?: string;
    usdc_mint?: string;
    usdc_ui_balance?: number;
    tokens?: Array<{
      token_index: number;
      mint: string;
      ui_balance: number;
      ui_deposits: number;
      ui_borrows: number;
    }>;
  } | null;
  // Aggregate reserves across markets (same shape as legacy `totals`).
  totals?: {
    total_open_order_base_lots_bid?: string;
    total_open_order_base_lots_ask?: string;
    total_quote_reserved_lots?: string;
  } | null;
}

function lotsPriceToUi(priceLots: number, ctx: MarketContext): number {
  const baseScale = Math.pow(10, ctx.baseDecimals);
  const quoteScale = Math.pow(10, ctx.quoteDecimals);
  return (priceLots * ctx.quoteLotSize * baseScale) / (Math.max(1, ctx.baseLotSize) * quoteScale);
}

export function mapV2AccountOrders(
  event: V2AccountEvent,
  ctxMap: Map<string, MarketContext>,
  fallbackCtx: MarketContext
): Order[] {
  const orders = event.orders ?? [];
  return orders
    .map(row => {
      const detail = row.order;
      if (!detail) return null;
      const ctx = ctxMap.get(row.market) ?? fallbackCtx;
      const baseScale = Math.pow(10, ctx.baseDecimals);
      const priceLots = num(detail.price);
      const sizeLots = num(detail.size);
      const priceNative = (priceLots * ctx.quoteLotSize * baseScale) / Math.max(1, ctx.baseLotSize);
      const sizeNative = sizeLots * ctx.baseLotSize;
      return {
        order_id: row.order_id,
        market_id: row.market,
        market_name: ctx.name,
        owner: detail.owner ?? event.owner,
        side: detail.side === 'bid' ? 'Buy' : ('Sell' as 'Buy' | 'Sell'),
        price: priceNative,
        quantity: sizeNative,
        expiry: 0,
        timestamp: typeof detail.ts_ms === 'number' ? detail.ts_ms : Number(detail.ts_ms ?? 0),
        base_mint: ctx.baseMint,
        quote_mint: ctx.quoteMint,
      } satisfies Order;
    })
    .filter((o): o is Order => o !== null);
}

export function mapV2AccountPositions(
  event: V2AccountEvent,
  ctxMap: Map<string, MarketContext>,
  markPriceByMarket: Map<string, number>
): Position[] {
  const rows = event.positions ?? [];
  return rows
    .map(p => {
      const ctx = ctxMap.get(p.market);
      const baseDecimals = ctx?.baseDecimals ?? 6;
      const quoteDecimals = ctx?.quoteDecimals ?? 6;
      const baseLotSize = ctx?.baseLotSize ?? 1;
      const baseScale = Math.pow(10, baseDecimals);
      const quoteScale = Math.pow(10, quoteDecimals);
      const baseLots = BigInt(p.fields.base ?? '0');
      if (baseLots === 0n) return null;
      const basePositionNative = Number(baseLots * BigInt(baseLotSize));
      const basePositionUi = basePositionNative / baseScale;
      // Prefer the live market mark price (updated on every onMeta SSE event)
      // over the stale value embedded in the position payload.
      const markPriceUi =
        markPriceByMarket.get(p.market) ??
        (p.fields.mark_price_ui !== undefined ? parseFloat(p.fields.mark_price_ui) : 0);
      const markPriceNative = Math.round(markPriceUi * quoteScale);
      const apiAvgEntryPrice = p.fields.avg_entry_price ?? p.fields.average_entry_price;
      const avgEntryUi = apiAvgEntryPrice !== undefined ? parseFloat(apiAvgEntryPrice) : null;
      // Always compute PnL from known-correct entry and mark prices.
      // The server's pnl_unrealized_ui field has a backend scaling bug that
      // produces wrong values for some markets (e.g. ETH, BTC) while SOL
      // appears correct. Using the formula is consistent and unambiguous.
      // Guard: if entry is unknown, PnL is 0 rather than mark * size nonsense.
      const unrealizedPnlNative =
        avgEntryUi !== null && markPriceUi !== 0
          ? Math.round((markPriceUi - avgEntryUi) * basePositionUi * quoteScale)
          : 0;
      return {
        owner: event.owner,
        market_id: p.market,
        market_name: p.fields.market_name || ctx?.name || `Market ${p.market}`,
        base_position: String(basePositionNative),
        avg_entry_price: String(avgEntryUi !== null ? Math.round(avgEntryUi * quoteScale) : 0),
        mark_price: String(Math.round(markPriceNative)),
        realized_pnl: '0',
        unrealized_pnl: String(unrealizedPnlNative),
        cumulative_funding: '0',
        base_decimals: baseDecimals,
        quote_decimals: quoteDecimals,
        base_mint: ctx?.baseMint || '',
        quote_mint: ctx?.quoteMint || '',
      } satisfies Position;
    })
    .filter((p): p is Position => p !== null);
}

// ── REST account snapshot → Position[] ───────────────────────────────
// /v2/snapshot/account/{owner} returns the full Redis hash per market:
//   positions: { "<marketId>": { base, quote, avg_entry_price,
//                                pnl_unrealized_ui, trade_pnl_ui, ... } }
// All values are strings (Redis stores everything as strings).
export function mapV2AccountSnapshotPositions(
  snapshot: import('./v2-api').V2AccountSnapshot,
  owner: string,
  ctxMap: Map<string, MarketContext>,
  markPriceByMarket: Map<string, number>
): Position[] {
  const posMap = (snapshot.positions ?? {}) as Record<string, Record<string, string>>;
  return Object.entries(posMap)
    .map(([marketId, fields]) => {
      const baseLots = BigInt(fields.base ?? '0');
      if (baseLots === 0n) return null;
      const ctx = ctxMap.get(marketId);
      const baseDecimals = ctx?.baseDecimals ?? 6;
      const quoteDecimals = ctx?.quoteDecimals ?? 6;
      const baseLotSize = ctx?.baseLotSize ?? 1;
      const baseScale = Math.pow(10, baseDecimals);
      const quoteScale = Math.pow(10, quoteDecimals);
      const basePositionNative = Number(baseLots * BigInt(baseLotSize));
      const basePositionUi = basePositionNative / baseScale;
      const markPriceUi = markPriceByMarket.get(marketId) ?? 0;
      const markPriceNative = Math.round(markPriceUi * quoteScale);
      const avgEntryUi =
        fields.avg_entry_price !== undefined ? parseFloat(fields.avg_entry_price) : null;
      // Always compute from entry + mark — server pnl_unrealized_ui is unreliable.
      const unrealizedPnlNative =
        avgEntryUi !== null && markPriceUi !== 0
          ? Math.round((markPriceUi - avgEntryUi) * basePositionUi * quoteScale)
          : 0;
      return {
        owner,
        market_id: marketId,
        market_name: fields.market_name || ctx?.name || `Market ${marketId}`,
        base_position: String(basePositionNative),
        avg_entry_price: String(avgEntryUi !== null ? Math.round(avgEntryUi * quoteScale) : 0),
        mark_price: String(markPriceNative),
        realized_pnl: '0',
        unrealized_pnl: String(unrealizedPnlNative),
        cumulative_funding: '0',
        base_decimals: baseDecimals,
        quote_decimals: quoteDecimals,
        base_mint: ctx?.baseMint || '',
        quote_mint: ctx?.quoteMint || '',
      } satisfies Position;
    })
    .filter((p): p is Position => p !== null);
}

export function mapV2AccountMargin(event: V2AccountEvent, quoteDecimals: number): MarginAccount {
  const totals = event.margin_summary?.totals ?? {};
  const quoteScale = Math.pow(10, quoteDecimals);
  const toUi = (v?: string) => (v === undefined ? 0 : Number(v) / quoteScale);
  const equity = toUi(totals.equity_native_quote);
  const assets = toUi(totals.assets_native_quote);
  const liabs = toUi(totals.liabs_native_quote);
  const initHealth = toUi(totals.init_health_native_quote);
  const maintHealth = toUi(totals.maint_health_native_quote);
  const unrealizedPnl = toUi(totals.pnl_native_quote);
  const equityOrAssets = equity !== 0 ? equity : assets;
  return {
    owner: event.owner,
    usdc_collateral: equity,
    positions: [],
    reservations: [],
    realized_pnl_total: 0,
    equity_snapshot: equity,
    realized_pnl_snapshot: 0,
    unrealized_pnl: unrealizedPnl,
    funding_accrued_snapshot: 0,
    initial_margin_snapshot: Math.max(equityOrAssets - initHealth, 0),
    maintenance_margin_snapshot: Math.max(equityOrAssets - maintHealth, 0),
    free_collateral_snapshot: Math.max(initHealth, 0),
    available_withdrawal_snapshot: Math.max(initHealth, 0),
    per_market_delta_snapshot: [],
    portfolio_leverage_limit_snapshot: 0,
    margin_usage_fraction:
      typeof totals.margin_usage_fraction === 'number'
        ? totals.margin_usage_fraction
        : assets > 0
          ? Math.max(liabs / assets, 0)
          : 0,
  };
}

// Best-bid / best-ask are derived from the `book` event's top-of-book,
// `/v2/snapshot/account/:owner` → `{ [mint]: { available, reserved } }`,
// the same shape the legacy `/state/balances` composer produced. Lets the
// vault + MyAssets panels flip to v2 without changing their consumers.
//
// `event.tokens` is the legacy `optimistic_collateral` object mirrored
// verbatim into Redis; `event.totals` is the legacy `totals` object. If
// either is missing (harness mirror extension not yet deployed for this
// owner), that portion simply contributes nothing — callers still get an
// empty `{}` and can fall back / show loading state.
export function mapV2AccountBalances(
  event: V2AccountEvent,
  ctx: {
    baseMint: string;
    baseDecimals: number;
    quoteMint: string;
    quoteDecimals: number;
  }
): Record<string, TokenBalance> {
  const balances: Record<string, TokenBalance> = {};
  const add = (mint: string, availableDelta: bigint, reservedDelta: bigint) => {
    if (!mint) return;
    const current = balances[mint] || { available: '0', reserved: '0' };
    const available = BigInt(current.available || '0') + availableDelta;
    const reserved = BigInt(current.reserved || '0') + reservedDelta;
    balances[mint] = { available: available.toString(), reserved: reserved.toString() };
  };
  const toNativeString = (ui: number, decimals: number): string => {
    if (!Number.isFinite(ui)) return '0';
    const scaled = ui * Math.pow(10, Math.max(0, decimals));
    if (!Number.isFinite(scaled)) return '0';
    return Math.round(scaled).toString();
  };

  const tokensEntry = event.tokens ?? null;
  const usdcMint = tokensEntry?.usdc_mint || '';
  for (const token of tokensEntry?.tokens ?? []) {
    const decimals =
      token.mint === usdcMint
        ? 6
        : token.mint === ctx.quoteMint
          ? Math.max(0, ctx.quoteDecimals)
          : token.mint === ctx.baseMint
            ? Math.max(0, ctx.baseDecimals)
            : 9;
    const availableNative = BigInt(toNativeString(token.ui_balance, decimals));
    add(token.mint, availableNative, 0n);
    // Preserve compatibility with frontend configs whose quote mint differs
    // from the harness USDC mint (legacy placeholder configs).
    if (token.mint === usdcMint && usdcMint && usdcMint !== ctx.quoteMint) {
      add(ctx.quoteMint, availableNative, 0n);
    }
  }

  const quoteReservedNative = BigInt(
    lotsQuoteToNative(event.totals?.total_quote_reserved_lots || '0')
  );
  const quoteMintFromHarness = tokensEntry?.usdc_mint || ctx.quoteMint;
  add(quoteMintFromHarness, 0n, quoteReservedNative);
  if (quoteMintFromHarness !== ctx.quoteMint) {
    add(ctx.quoteMint, 0n, quoteReservedNative);
  }

  return balances;
}

// since the meta event today only carries hash fields. Reuse the same
// orderbook shape we already aggregate for `orderbookAtom`.
export function bestBidAskFromBook(
  snap: V2OrderbookSnapshot,
  ctx: MarketContext
): { bestBidUi: number | null; bestAskUi: number | null } {
  const firstBid = snap.bids.find(l => l.order !== null);
  const firstAsk = snap.asks.find(l => l.order !== null);
  const parseSide = (lvl?: V2OrderbookLevel): number | null => {
    if (!lvl || !lvl.order) return null;
    const pl = Number(lvl.order.price);
    if (!Number.isFinite(pl)) return null;
    return lotsPriceToUi(pl, ctx);
  };
  return {
    bestBidUi: parseSide(firstBid),
    bestAskUi: parseSide(firstAsk),
  };
}
