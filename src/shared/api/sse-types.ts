/**
 * SSE stream type definitions
 * Matches the gateway /state/stream/frontend endpoint shape
 */

export type SSEConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// --- Event: connected ---
export interface SSEConnectedEvent {
  ts_ms: number;
  mode: string;
  view: 'optimistic' | 'confirmed';
  owner: string;
  mango_account: string | null;
  market: string;
}

// --- Event: market_update (also nested in snapshot) ---
export interface SSEOrderbookLevel {
  price_lots: string;
  base_lots: string;
  price_ui: number;
  qty_ui: number;
}

export interface SSEOrderbookSummary {
  depth: number;
  bids: SSEOrderbookLevel[];
  asks: SSEOrderbookLevel[];
}

export interface SSEMarketMetadata {
  market_index: number;
  name: string;
  base_symbol: string;
  quote_symbol: string;
  base_mint: string;
  quote_mint: string;
  perp_market: string;
  oracle: string;
  bids: string;
  asks: string;
  event_queue: string;
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: string;
  quote_lot_size: string;
  open_interest: string;
}

export interface SSEMarketMetrics {
  market: string;
  oracle_price_ui: number;
  mark_price_ui: number;
  funding_rate_daily_pct: number;
  funding_rate_hourly_pct: number;
  open_interest_base_lots: string;
  open_interest_base_ui: number;
  best_bid_ui: number;
  best_ask_ui: number;
  updated_ts_ms: number;
}

export interface SSETradeSummary {
  market: string;
  view: string;
  window_ms: number;
  trade_count: number;
  last_trade_ts_ms: number;
  last_price_lots: string;
  last_price_ui: number;
  open_price_lots: string;
  open_price_ui: number;
  high_price_lots: string;
  high_price_ui: number;
  low_price_lots: string;
  low_price_ui: number;
  change_24h_pct: number;
  volume_base_lots: string;
  volume_quote_lots: string;
  volume_base_ui: number;
  volume_quote_ui: number;
}

export interface SSEMarketUpdateEvent {
  market: string;
  view: string;
  metadata: SSEMarketMetadata;
  metrics: SSEMarketMetrics;
  trade_summary: SSETradeSummary;
  orderbook_summary: SSEOrderbookSummary;
  orderbook: unknown | null;
}

// --- Event: account_update (also nested in snapshot) ---
export interface SSEAccountMetricsTotals {
  equity_native_quote?: string;
  pnl_native_quote?: string;
  assets_native_quote?: string;
  liabs_native_quote?: string;
  init_health_native_quote?: string;
  maint_health_native_quote?: string;
  margin_usage_fraction?: number;
}

export interface SSEAccountMetricsFields {
  margin_used: number;
  health_init: string;
  health_maint: string;
  pnl_realized: string | null;
  pnl_unrealized: string;
  equity: string;
  liquidation_price_by_market: Record<string, number> | null;
}

export interface SSEAccountMetrics {
  status?: string;
  source?: string;
  updated_ts_ms?: number;
  account_count?: number;
  mango_account?: string | null;
  totals?: SSEAccountMetricsTotals;
  accounts?: unknown[];
  fields?: SSEAccountMetricsFields;
}

export interface SSEOpenOrder {
  order_id: string;
  owner: string;
  mango_account: string;
  market: string;
  side: 'bid' | 'ask';
  price_lots: string;
  base_lots: string;
  quote_lots: string;
  client_order_id: string;
  sequence: string;
  status: string;
  // UI fields if provided
  price_ui?: number;
  qty_ui?: number;
}

export interface SSETrade {
  trade_id: string;
  market: string;
  price_lots: string;
  base_lots: string;
  quote_lots: string;
  taker_side: 'bid' | 'ask';
  maker_owner: string;
  taker_owner: string;
  ts_ms: number;
  // UI fields if provided
  price_ui?: number;
  qty_ui?: number;
}

export interface SSEPosition {
  market: string;
  base_position_lots: string;
  quote_position_native: string;
  base_position_ui?: number;
  average_entry_price_ui?: number;
  mark_price_ui?: number;
  unrealized_pnl_ui?: number;
  pnl_unrealized_ui?: number;
  pnl_unrealized_native_quote?: string;
  realized_pnl_ui?: number;
}

export interface SSEAccountUpdateEvent {
  owner: string;
  mango_account: string | null;
  view: string;
  positions_scope: string;
  positions: SSEPosition[];
  open_orders: SSEOpenOrder[];
  trades: SSETrade[];
  account_metrics?: SSEAccountMetrics;
}

// --- Event: snapshot ---
export interface SSESnapshotEvent {
  view: string;
  owner: SSEAccountUpdateEvent;
  market: SSEMarketUpdateEvent;
}

// --- Event: trades stream snapshot/update ---
export interface SSETradesStreamSnapshot {
  view: string;
  market: string;
  data: SSETrade[];
}

// --- Callback types ---
export interface SSETradesCallbacks {
  onConnected?: (data: SSEConnectedEvent) => void;
  onSnapshot?: (data: SSETradesStreamSnapshot) => void;
  onTrade?: (data: SSETradesStreamSnapshot) => void;
  onStateChange?: (state: SSEConnectionState) => void;
}

export interface SSECallbacks {
  onConnected?: (data: SSEConnectedEvent) => void;
  onSnapshot?: (data: SSESnapshotEvent) => void;
  onAccountUpdate?: (data: SSEAccountUpdateEvent) => void;
  onMarketUpdate?: (data: SSEMarketUpdateEvent) => void;
  onStateChange?: (state: SSEConnectionState) => void;
  onError?: (error: Error) => void;
}
