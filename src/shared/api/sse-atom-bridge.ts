/**
 * SSE Atom Bridge — pure transform functions mapping SSE payloads to atom shapes.
 * This is the only file where SSE data format meets the frontend's internal format.
 */
import type { Orderbook, OrderbookItem } from '@/entities/orderbook/model';
import type { Order, Trade } from './useSequencerApi';
import type { Position } from '@/shared/hooks/usePositions';
import type { MarginAccount } from '@/shared/hooks/useAccount';
import type { Market, MarketKind } from '@/entities/market';
import type {
  SSEMarketUpdateEvent,
  SSEAccountUpdateEvent,
  SSETradesStreamSnapshot,
  SSEOpenOrder,
  SSETrade,
  SSEPosition,
} from './sse-types';
import { nativeToUiNumber } from '@/shared/lib/harness-market';

export interface MarketContext {
  name: string;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  baseLotSize: number;
  quoteLotSize: number;
}

function uiToNative(ui: number, scale: number): number {
  return Math.round(ui * scale);
}

function lotsToNative(
  priceLots: string,
  quoteLotSize: number,
  baseScale: number,
  baseLotSize: number
): number {
  return Number(
    (BigInt(priceLots) * BigInt(quoteLotSize) * BigInt(baseScale)) / BigInt(baseLotSize)
  );
}

function baseLotsToNative(baseLots: string, baseLotSize: number): number {
  return Number(BigInt(baseLots) * BigInt(baseLotSize));
}

function parseFiniteNumber(value: string | number | undefined, fallback: number = 0): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildMarketContext(data: SSEMarketUpdateEvent): MarketContext {
  const meta = data.metadata;
  return {
    name: meta.name,
    baseMint: meta.base_mint,
    quoteMint: meta.quote_mint,
    baseDecimals: meta.base_decimals,
    quoteDecimals: meta.quote_decimals,
    baseLotSize: Number(meta.base_lot_size),
    quoteLotSize: Number(meta.quote_lot_size),
  };
}

export function buildContextFromMarket(market: Market): MarketContext {
  return {
    name: market.name,
    baseMint: market.base_mint,
    quoteMint: market.quote_mint,
    baseDecimals: market.base_decimals,
    quoteDecimals: market.quote_decimals,
    baseLotSize: Number(market.base_lot_size),
    quoteLotSize: Number(market.quote_lot_size),
  };
}

// --- Orderbook ---

export function mapOrderbook(
  sseData: SSEMarketUpdateEvent['orderbook_summary'],
  baseDecimals: number,
  quoteDecimals: number
): Orderbook {
  const baseScale = 10 ** baseDecimals;
  const quoteScale = 10 ** quoteDecimals;

  const bids: OrderbookItem[] = sseData.bids.map(b => ({
    price: uiToNative(b.price_ui, quoteScale),
    quantity: uiToNative(b.qty_ui, baseScale),
  }));

  const asks: OrderbookItem[] = sseData.asks.map(a => ({
    price: uiToNative(a.price_ui, quoteScale),
    quantity: uiToNative(a.qty_ui, baseScale),
  }));

  return { bids, asks, lastUpdateId: Date.now(), lastUpdated: new Date() };
}

// --- Open Orders ---
// Each order carries its own `market` field. Use per-order market context
// so multi-market accounts are converted correctly.

export function mapOpenOrders(
  sseOrders: SSEOpenOrder[],
  ctxMap: Map<string, MarketContext>,
  fallbackCtx: MarketContext
): Order[] {
  return sseOrders.map(order => {
    const ctx = ctxMap.get(order.market) ?? fallbackCtx;
    const baseScale = 10 ** ctx.baseDecimals;
    const quoteScale = 10 ** ctx.quoteDecimals;

    return {
      order_id: order.order_id,
      market_id: order.market,
      market_name: ctx.name,
      owner: order.owner,
      side: order.side === 'bid' ? 'Buy' : ('Sell' as 'Buy' | 'Sell'),
      price:
        order.price_ui !== undefined
          ? uiToNative(order.price_ui, quoteScale)
          : lotsToNative(order.price_lots, ctx.quoteLotSize, baseScale, ctx.baseLotSize),
      quantity:
        order.qty_ui !== undefined
          ? uiToNative(order.qty_ui, baseScale)
          : baseLotsToNative(order.base_lots, ctx.baseLotSize),
      expiry: 0,
      timestamp: Number(order.sequence),
      base_mint: ctx.baseMint,
      quote_mint: ctx.quoteMint,
    };
  });
}

// --- User Trades ---

export function mapWalletTradesForMarket(sseTrades: SSETrade[], market: Market): Trade[] {
  const ctx = buildContextFromMarket(market);
  const ctxMap = new Map([[market.uuid, ctx]]);
  return mapUserTrades(sseTrades, ctxMap, ctx);
}

export function mapUserTrades(
  sseTrades: SSETrade[],
  ctxMap: Map<string, MarketContext>,
  fallbackCtx: MarketContext
): Trade[] {
  return sseTrades.map(trade => {
    const ctx = ctxMap.get(trade.market) ?? fallbackCtx;
    const baseScale = 10 ** ctx.baseDecimals;
    const quoteScale = 10 ** ctx.quoteDecimals;

    return {
      id: trade.trade_id,
      buyer_owner: trade.taker_side === 'bid' ? trade.taker_owner : trade.maker_owner,
      seller_owner: trade.taker_side === 'ask' ? trade.taker_owner : trade.maker_owner,
      price:
        trade.price_ui !== undefined
          ? uiToNative(trade.price_ui, quoteScale)
          : lotsToNative(trade.price_lots, ctx.quoteLotSize, baseScale, ctx.baseLotSize),
      quantity:
        trade.qty_ui !== undefined
          ? uiToNative(trade.qty_ui, baseScale)
          : baseLotsToNative(trade.base_lots, ctx.baseLotSize),
      timestamp: Math.floor(trade.ts_ms / 1000),
      base_mint: ctx.baseMint,
      quote_mint: ctx.quoteMint,
    };
  });
}

// --- Positions ---

export function mapPositions(
  ssePositions: SSEPosition[],
  owner: string,
  ctxMap: Map<string, MarketContext>,
  markPriceByMarket: Map<string, number>
): Position[] {
  return ssePositions
    .filter(p => BigInt(p.base_position_lots || '0') !== 0n)
    .map(p => {
      const meta = ctxMap.get(p.market);
      const baseDecimals = meta?.baseDecimals ?? 6;
      const quoteDecimals = meta?.quoteDecimals ?? 6;
      const baseLotSize = meta?.baseLotSize ?? 1;
      const quoteScale = 10 ** quoteDecimals;
      const baseScale = 10 ** baseDecimals;
      const basePositionNative =
        p.base_position_ui !== undefined
          ? uiToNative(p.base_position_ui, baseScale)
          : baseLotsToNative(p.base_position_lots, baseLotSize);
      const quotePositionNative = parseFiniteNumber(p.quote_position_native);
      const markPriceNative =
        p.mark_price_ui !== undefined
          ? uiToNative(p.mark_price_ui, quoteScale)
          : uiToNative(markPriceByMarket.get(p.market) ?? 0, quoteScale);
      const basePositionUi = basePositionNative / baseScale;
      const quotePositionUi = quotePositionNative / quoteScale;
      const markPriceUi = markPriceNative / quoteScale;
      const averageEntryPriceUi =
        basePositionUi !== 0 ? Math.abs(quotePositionUi / basePositionUi) : 0;
      const unrealizedPnlUi = quotePositionUi + basePositionUi * markPriceUi;

      return {
        owner,
        market_id: p.market,
        market_name: meta?.name || `Market ${p.market}`,
        base_position: String(basePositionNative),
        average_entry_price: String(
          p.average_entry_price_ui !== undefined
            ? uiToNative(p.average_entry_price_ui, quoteScale)
            : uiToNative(averageEntryPriceUi, quoteScale)
        ),
        mark_price: String(markPriceNative),
        realized_pnl:
          p.realized_pnl_ui !== undefined ? String(uiToNative(p.realized_pnl_ui, quoteScale)) : '0',
        unrealized_pnl: String(
          p.unrealized_pnl_ui !== undefined
            ? uiToNative(p.unrealized_pnl_ui, quoteScale)
            : uiToNative(unrealizedPnlUi, quoteScale)
        ),
        cumulative_funding: '0',
        base_decimals: baseDecimals,
        quote_decimals: quoteDecimals,
        base_mint: meta?.baseMint || '',
        quote_mint: meta?.quoteMint || '',
      } satisfies Position;
    });
}

// --- Account Metrics → MarginAccount ---

export function mapAccountMetrics(
  sseAccount: SSEAccountUpdateEvent,
  quoteDecimals: number
): MarginAccount {
  const totals = sseAccount.account_metrics.totals;

  const equity = nativeToUiNumber(totals.equity_native_quote || '0', quoteDecimals);
  const assets = nativeToUiNumber(totals.assets_native_quote || '0', quoteDecimals);
  const liabs = nativeToUiNumber(totals.liabs_native_quote || '0', quoteDecimals);
  const initHealth = nativeToUiNumber(totals.init_health_native_quote || '0', quoteDecimals);
  const maintHealth = nativeToUiNumber(totals.maint_health_native_quote || '0', quoteDecimals);
  const unrealizedPnl = nativeToUiNumber(totals.pnl_native_quote || '0', quoteDecimals);
  const equityOrAssets = equity !== 0 ? equity : assets;

  return {
    owner: sseAccount.owner,
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

// --- Market → Market atom update ---

export function mapMarketFromSSE(sseMarket: SSEMarketUpdateEvent): Market {
  const meta = sseMarket.metadata;
  const metrics = sseMarket.metrics;
  const quoteScale = 10 ** meta.quote_decimals;

  return {
    uuid: sseMarket.market,
    name: meta.name || `Market ${sseMarket.market}`,
    base_mint: meta.base_mint,
    quote_mint: meta.quote_mint,
    created_at: 0,
    kind: 'perp' as MarketKind,
    perp_config: null,
    perp_state: {
      mark_price: uiToNative(metrics.mark_price_ui, quoteScale),
      mark_price_timestamp: metrics.updated_ts_ms,
      index_price: uiToNative(metrics.oracle_price_ui, quoteScale),
      index_price_timestamp: metrics.updated_ts_ms,
      last_premium_rate_bps: 0,
      last_funding_rate_bps: Math.round(metrics.funding_rate_hourly_pct * 100),
      funding_rate_bps: Math.round(metrics.funding_rate_hourly_pct * 100),
      last_funding_timestamp: metrics.updated_ts_ms,
      next_funding_timestamp: null,
    },
    base_decimals: meta.base_decimals,
    quote_decimals: meta.quote_decimals,
    base_lot_size: Number(meta.base_lot_size),
    quote_lot_size: Number(meta.quote_lot_size),
    price_decimals: meta.quote_decimals,
    open_interest: Number(meta.open_interest),
  };
}

// --- Trades stream → recent market trades for Trades.tsx ---
// Trades.tsx uses a local Trade type with native-scaled price/quantity.

export interface RecentTrade {
  id: string;
  price: number;
  quantity: number;
  timestamp: number;
  buyer_owner: string;
  seller_owner: string;
}

export function mapRecentTrades(
  snapshot: SSETradesStreamSnapshot,
  ctx: MarketContext
): RecentTrade[] {
  const baseScale = 10 ** ctx.baseDecimals;
  const quoteScale = 10 ** ctx.quoteDecimals;

  return snapshot.data.map(trade => ({
    id: trade.trade_id,
    price:
      trade.price_ui !== undefined
        ? uiToNative(trade.price_ui, quoteScale)
        : lotsToNative(trade.price_lots, ctx.quoteLotSize, baseScale, ctx.baseLotSize),
    quantity:
      trade.qty_ui !== undefined
        ? uiToNative(trade.qty_ui, baseScale)
        : baseLotsToNative(trade.base_lots, ctx.baseLotSize),
    timestamp: Math.floor(trade.ts_ms / 1000),
    buyer_owner: trade.taker_side === 'bid' ? trade.taker_owner : trade.maker_owner,
    seller_owner: trade.taker_side === 'ask' ? trade.taker_owner : trade.maker_owner,
  }));
}
