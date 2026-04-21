/**
 * v2 read-layer snapshot fetchers.
 *
 * Thin wrappers over `/v2/snapshot/*` on the gateway. Response shapes mirror
 * the Redis key layout (see `docs/redis-read-layer/schema.md`) — pre-aggregation
 * happens in the adapters in `v2-adapter.ts`, not here.
 */
import axios from 'axios';
import { config, API_ROUTES_V2 } from '@/shared/config/constants';

const GATEWAY = () => config.devnet.gatewayUrl;
const VIEW = () => (config.devnet.v2View === 'confirmed' ? 'conf' : 'opt');

// ── Orderbook ─────────────────────────────────────────────────────────

export interface V2OrderDetail {
  owner: string;
  price: string;
  size: string;
  side: 'bid' | 'ask';
  ts_ms: number | null;
  client_id: string | null;
}

export interface V2OrderbookLevel {
  price: number;
  order_id: string;
  order: V2OrderDetail | null;
}

export interface V2OrderbookSnapshot {
  market: number;
  view: 'opt' | 'conf';
  depth: number;
  bids: V2OrderbookLevel[];
  asks: V2OrderbookLevel[];
}

export async function fetchV2Orderbook(
  marketId: string | number,
  opts: { depth?: number; signal?: AbortSignal } = {}
): Promise<V2OrderbookSnapshot> {
  const path = API_ROUTES_V2.snapshot_orderbook.replace('{marketId}', String(marketId));
  const params: Record<string, string | number> = { view: VIEW() };
  if (opts.depth) params.depth = opts.depth;
  const res = await axios.get<V2OrderbookSnapshot>(`${GATEWAY()}${path}`, {
    params,
    signal: opts.signal,
  });
  return res.data;
}

// ── Balance ───────────────────────────────────────────────────────────

export interface V2BalanceSnapshot {
  owner: string;
  view: 'opt' | 'conf';
  /** Redis HASH dump: field=asset mint, value=native amount string. */
  balances: Record<string, string>;
}

export async function fetchV2Balance(
  owner: string,
  opts: { signal?: AbortSignal } = {}
): Promise<V2BalanceSnapshot> {
  const path = API_ROUTES_V2.snapshot_balance.replace('{owner}', owner);
  const res = await axios.get<V2BalanceSnapshot>(`${GATEWAY()}${path}`, {
    params: { view: VIEW() },
    signal: opts.signal,
  });
  return res.data;
}

// ── Position ──────────────────────────────────────────────────────────

export interface V2PositionFields {
  base?: string;
  quote?: string;
  open_bid?: string;
  open_ask?: string;
  reserved?: string;
  ts_ms?: string;
  avg_price?: string;
  unrealized_pnl?: string;
  realized_pnl?: string;
  funding?: string;
}

export interface V2PositionSnapshot {
  owner: string;
  market: number;
  view: 'opt' | 'conf';
  position: V2PositionFields;
}

export async function fetchV2Position(
  owner: string,
  marketId: string | number,
  opts: { signal?: AbortSignal } = {}
): Promise<V2PositionSnapshot> {
  const path = API_ROUTES_V2.snapshot_position
    .replace('{owner}', owner)
    .replace('{marketId}', String(marketId));
  const res = await axios.get<V2PositionSnapshot>(`${GATEWAY()}${path}`, {
    params: { view: VIEW() },
    signal: opts.signal,
  });
  return res.data;
}

// ── Market metadata ───────────────────────────────────────────────────

export interface V2MarketMeta {
  oracle_price?: string;
  stable_price?: string;
  base_lot_size?: string;
  quote_lot_size?: string;
  long_funding?: string;
  short_funding?: string;
  maker_fee?: string;
  taker_fee?: string;
  settle_token_index?: string;
  market?: string;
  ts_ms?: string;
}

export interface V2MarketSnapshot {
  market: number;
  meta: V2MarketMeta;
}

export async function fetchV2Market(
  marketId: string | number,
  opts: { signal?: AbortSignal } = {}
): Promise<V2MarketSnapshot> {
  const path = API_ROUTES_V2.snapshot_market.replace('{marketId}', String(marketId));
  const res = await axios.get<V2MarketSnapshot>(`${GATEWAY()}${path}`, { signal: opts.signal });
  return res.data;
}

// ── Markets registry ──────────────────────────────────────────────────

export interface V2MarketsList {
  markets: Array<{ market: string; meta: V2MarketMeta }>;
}

export async function fetchV2Markets(opts: { signal?: AbortSignal } = {}): Promise<V2MarketsList> {
  const res = await axios.get<V2MarketsList>(`${GATEWAY()}${API_ROUTES_V2.markets}`, {
    signal: opts.signal,
  });
  return res.data;
}

// ── Trades ────────────────────────────────────────────────────────────

export interface V2TradeRow {
  /** Redis stream id. */
  id: string;
  maker?: string;
  taker?: string;
  price?: string;
  size?: string;
  side?: 'bid' | 'ask';
  ts_ms?: string;
  sequence?: string;
}

export interface V2TradesResponse {
  market: number;
  trades: V2TradeRow[];
}

export async function fetchV2Trades(
  marketId: string | number,
  opts: { limit?: number; signal?: AbortSignal } = {}
): Promise<V2TradesResponse> {
  const path = API_ROUTES_V2.trades.replace('{marketId}', String(marketId));
  const res = await axios.get<V2TradesResponse>(`${GATEWAY()}${path}`, {
    params: { limit: opts.limit ?? 50 },
    signal: opts.signal,
  });
  return res.data;
}

// ── Account composite (balance + per-market positions + margin) ───────

export interface V2AccountSnapshot {
  balances?: Record<string, string | unknown>;
  margin_summary?: Record<string, unknown>;
  positions?: Record<string, Record<string, string>>;
}

export async function fetchV2Account(
  owner: string,
  opts: { signal?: AbortSignal } = {}
): Promise<V2AccountSnapshot> {
  const path = API_ROUTES_V2.snapshot_account.replace('{owner}', owner);
  const res = await axios.get<V2AccountSnapshot>(`${GATEWAY()}${path}`, {
    params: { view: VIEW() },
    signal: opts.signal,
  });
  return res.data;
}

// ── Orders index (per-owner) ──────────────────────────────────────────

export interface V2OrdersRow {
  order_id: string;
  market: string;
  order?: V2OrderDetail | null;
}

export interface V2OrdersSnapshot {
  owner: string;
  view: 'opt' | 'conf';
  orders: V2OrdersRow[];
}

export async function fetchV2Orders(
  owner: string,
  opts: { signal?: AbortSignal } = {}
): Promise<V2OrdersSnapshot> {
  const path = API_ROUTES_V2.snapshot_orders.replace('{owner}', owner);
  const res = await axios.get<V2OrdersSnapshot>(`${GATEWAY()}${path}`, {
    params: { view: VIEW() },
    signal: opts.signal,
  });
  return res.data;
}
