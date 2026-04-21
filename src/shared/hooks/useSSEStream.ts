/**
 * useSSEStream — React hook wiring the SSE client to Jotai atoms.
 * Mount once in PerpsPage to initialize the real-time data stream.
 *
 * Callback lifecycle: We mutate `client.callbacks` directly so the
 * SSE client always reads the latest handlers without needing to
 * re-register on every render.
 */
import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useWallet } from '@solana/wallet-adapter-react';
import { selectedMarketIdAtom, marketsAtom } from '@/entities/market';
import { orderbookAtom } from '@/entities/orderbook/model';
import {
  sseConnectionStateAtom,
  marketMetricsAtom,
  marketTradeSummaryAtom,
  userOpenOrdersAtom,
  userTradesAtom,
  userPositionsAtom,
  accountMetricsAtom,
  recentMarketTradesAtom,
} from '@/shared/api/sse-atoms';
import { getSSEClient, getTradesSSEClient } from '@/shared/api/sse-client';
import { getV2CompositeClient } from '@/shared/api/v2-composite-sse-client';
import { fetchV2Orderbook, fetchV2Trades } from '@/shared/api/v2-api';
import type { V2OrderbookSnapshot } from '@/shared/api/v2-api';
import { mapV2Orderbook } from '@/shared/api/v2-adapter';
import {
  buildContextFromMarket,
  buildMarketContext,
  mapOrderbook,
  mapOpenOrders,
  mapUserTrades,
  mapPositions,
  mapAccountMetrics,
  mapMarketFromSSE,
  mapRecentTrades,
} from '@/shared/api/sse-atom-bridge';
import type { MarketContext } from '@/shared/api/sse-atom-bridge';
import type {
  SSESnapshotEvent,
  SSEAccountUpdateEvent,
  SSEMarketUpdateEvent,
  SSETrade,
  SSETradesStreamSnapshot,
} from '@/shared/api/sse-types';
import { config } from '@/shared/config/constants';

const RECENT_TRADES_PREFETCH_LIMIT = 50;
const RECENT_TRADES_MAX = 50;

const DEFAULT_CTX: MarketContext = {
  name: '',
  baseMint: '',
  quoteMint: '',
  baseDecimals: config.devnet.baseDecimals,
  quoteDecimals: config.devnet.quoteDecimals,
  baseLotSize: config.devnet.baseLotSize,
  quoteLotSize: config.devnet.quoteLotSize,
};

function mergeRecentTrades(
  incoming: import('@/shared/api/sse-atom-bridge').RecentTrade[],
  existing: import('@/shared/api/sse-atom-bridge').RecentTrade[]
) {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming.slice(0, RECENT_TRADES_MAX);

  const merged = [...incoming, ...existing];
  const deduped = new Map<string, (typeof merged)[number]>();

  for (const trade of merged) {
    if (!deduped.has(trade.id)) {
      deduped.set(trade.id, trade);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, RECENT_TRADES_MAX);
}

export function useSSEStream() {
  const { publicKey } = useWallet();
  const marketId = useAtomValue(selectedMarketIdAtom);
  const markets = useAtomValue(marketsAtom);

  const setConnectionState = useSetAtom(sseConnectionStateAtom);
  const setOrderbook = useSetAtom(orderbookAtom);
  const setMarketMetrics = useSetAtom(marketMetricsAtom);
  const setTradeSummary = useSetAtom(marketTradeSummaryAtom);
  const setUserOrders = useSetAtom(userOpenOrdersAtom);
  const setUserTrades = useSetAtom(userTradesAtom);
  const setUserPositions = useSetAtom(userPositionsAtom);
  const setAccountMetrics = useSetAtom(accountMetricsAtom);
  const setMarkets = useSetAtom(marketsAtom);
  const setRecentTrades = useSetAtom(recentMarketTradesAtom);

  // Per-market metadata cache — shared across handlers via ref.
  const ctxMapRef = useRef(new Map<string, MarketContext>());

  // Abort controller for the in-flight recent-trades prefetch, so rapid
  // market switches cancel stale requests.
  const tradesPrefetchAbortRef = useRef<AbortController | null>(null);

  // Latest mark prices per market — populated from market_update metrics.
  const markPriceRef = useRef(new Map<string, number>());

  // --- Handlers ---
  // These are defined as regular functions so they always close over
  // the latest setter refs from Jotai (which are stable) and read
  // mutable refs for dynamic data.

  function handleMarketUpdate(data: SSEMarketUpdateEvent) {
    const ctx = buildMarketContext(data);
    ctxMapRef.current.set(data.market, ctx);
    markPriceRef.current.set(data.market, data.metrics.mark_price_ui);

    if (data.orderbook_summary) {
      setOrderbook(mapOrderbook(data.orderbook_summary, ctx.baseDecimals, ctx.quoteDecimals));
    }

    setMarketMetrics(data.metrics);
    setTradeSummary(data.trade_summary);

    const newMarket = mapMarketFromSSE(data);
    setMarkets(prev => {
      const idx = prev.findIndex(m => m.uuid === data.market);
      if (idx >= 0) {
        const existing = prev[idx];
        // Skip update if key trading fields haven't changed
        if (
          existing.perp_state?.mark_price === newMarket.perp_state?.mark_price &&
          existing.perp_state?.index_price === newMarket.perp_state?.index_price &&
          existing.open_interest === newMarket.open_interest
        ) {
          return prev;
        }
        const updated = [...prev];
        updated[idx] = { ...existing, ...newMarket };
        return updated;
      }
      return [...prev, newMarket];
    });
  }

  function handleAccountUpdate(data: SSEAccountUpdateEvent) {
    if (!data?.owner) return;
    const ctxMap = ctxMapRef.current;
    const fallback = ctxMap.values().next().value ?? DEFAULT_CTX;

    setUserOrders(mapOpenOrders(data.open_orders ?? [], ctxMap, fallback));
    setUserTrades(mapUserTrades(data.trades ?? [], ctxMap, fallback));
    setUserPositions(mapPositions(data.positions ?? [], data.owner, ctxMap, markPriceRef.current));

    const quoteDecimals = fallback.quoteDecimals;
    setAccountMetrics(mapAccountMetrics(data, quoteDecimals));
  }

  function handleSnapshot(data: SSESnapshotEvent) {
    if (data.market) handleMarketUpdate(data.market);
    if (data.owner) handleAccountUpdate(data.owner);
  }

  // --- v2 read-layer (Phase 5) ------------------------------
  // Single SSE connection carries every piece of live data. Events are
  // treated as DATA DELIVERIES, not invalidation signals — we update
  // atoms from the event payload directly, no REST refetches on hot path.
  // REST is only used for cold start, market switch, and resync recovery.
  const v2Enabled = config.devnet.useV2ReadLayer;
  const v2Composite = getV2CompositeClient();
  const currentMarketRef = useRef<string | null>(marketId);
  currentMarketRef.current = marketId;

  // Cold-start / market-switch / resync paths still use REST because we
  // need a full snapshot to seed atoms. These are not hot; they fire at
  // most on connect, owner switch, and broadcast lag.
  const coldLoadAbortRef = useRef<AbortController | null>(null);

  async function coldLoadV2(mid: string) {
    const market = markets.find(m => m.uuid === mid);
    const ctx = market ? buildContextFromMarket(market) : ctxMapRef.current.get(mid);
    if (!ctx) return;
    coldLoadAbortRef.current?.abort();
    const controller = new AbortController();
    coldLoadAbortRef.current = controller;
    try {
      const [book, trades] = await Promise.all([
        fetchV2Orderbook(mid, { signal: controller.signal }),
        fetchV2Trades(mid, { limit: RECENT_TRADES_MAX, signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setOrderbook(mapV2Orderbook(book, ctx));
      const mapped = trades.trades.map(t => mapV2TradeToRecent(t, ctx));
      setRecentTrades(prev => mergeRecentTrades(mapped, prev));
    } catch {
      /* transient; next event or reconnect will re-seed */
    }
  }

  function mapV2TradeToRecent(
    t: {
      id?: string;
      maker?: string;
      taker?: string;
      price?: string;
      size?: string;
      side?: string;
      ts_ms?: string | number;
    },
    ctx: MarketContext
  ) {
    const baseScale = 10 ** ctx.baseDecimals;
    const priceLots = t.price ? BigInt(t.price) : 0n;
    const sizeLots = t.size ? BigInt(t.size) : 0n;
    const price = Number(
      (priceLots * BigInt(ctx.quoteLotSize) * BigInt(baseScale)) /
        BigInt(Math.max(1, ctx.baseLotSize))
    );
    const quantity = Number(sizeLots * BigInt(ctx.baseLotSize));
    const takerSide = t.side === 'bid' ? 'bid' : 'ask';
    return {
      id: t.id ?? '',
      price,
      quantity,
      timestamp: Math.floor(Number(t.ts_ms ?? 0) / 1000),
      buyer_owner: takerSide === 'bid' ? (t.taker ?? '') : (t.maker ?? ''),
      seller_owner: takerSide === 'ask' ? (t.taker ?? '') : (t.maker ?? ''),
    };
  }

  v2Composite.callbacks.onStateChange = setConnectionState;

  // Book event carries the full enriched orderbook (price + order_id + size
  // per level). Consume it directly — no REST refetch on the hot path.
  v2Composite.callbacks.onBook = data => {
    const mid = currentMarketRef.current;
    if (!mid) return;
    const market = markets.find(m => m.uuid === mid);
    const ctx = market ? buildContextFromMarket(market) : ctxMapRef.current.get(mid);
    if (!ctx) return;
    setOrderbook(mapV2Orderbook(data as V2OrderbookSnapshot, ctx));
  };

  // Trade event carries the full trade fields. Map + prepend — no REST.
  v2Composite.callbacks.onTrade = data => {
    const mid = currentMarketRef.current;
    if (!mid) return;
    const market = markets.find(m => m.uuid === mid);
    const ctx = market ? buildContextFromMarket(market) : ctxMapRef.current.get(mid);
    if (!ctx) return;
    const mapped = mapV2TradeToRecent(data as Parameters<typeof mapV2TradeToRecent>[0], ctx);
    setRecentTrades(prev => mergeRecentTrades([mapped], prev));
  };

  v2Composite.callbacks.onResync = () => {
    // Broadcast lag — events may have been dropped. Re-seed atoms via REST.
    const mid = currentMarketRef.current;
    if (mid) void coldLoadV2(mid);
  };
  v2Composite.callbacks.onReady = () => {
    // Eager initial burst (book+meta) already shipped via the `book`/`meta`
    // event handlers before `ready`. Seed trades via REST once so the panel
    // isn't empty while we wait for the first live trade.
    const mid = currentMarketRef.current;
    if (mid) void coldLoadV2(mid);
  };

  // --- Wire callbacks into the singleton clients via mutable ref ---
  const client = getSSEClient();
  client.callbacks.onStateChange = setConnectionState;
  client.callbacks.onSnapshot = handleSnapshot;
  client.callbacks.onMarketUpdate = handleMarketUpdate;
  client.callbacks.onAccountUpdate = handleAccountUpdate;

  // Trades stream — wire handlers via mutable callbacks
  const tradesClient = getTradesSSEClient();

  function handleTradesSnapshot(data: import('@/shared/api/sse-types').SSETradesStreamSnapshot) {
    const ctx = ctxMapRef.current.get(data.market) ?? DEFAULT_CTX;
    const snapshotTrades = mapRecentTrades(data, ctx);
    setRecentTrades(prev => mergeRecentTrades(snapshotTrades, prev));
  }

  function handleTradeIncremental(data: import('@/shared/api/sse-types').SSETradesStreamSnapshot) {
    const ctx = ctxMapRef.current.get(data.market) ?? DEFAULT_CTX;
    const newTrades = mapRecentTrades(data, ctx);
    setRecentTrades(prev => mergeRecentTrades(newTrades, prev));
  }

  tradesClient.callbacks.onSnapshot = handleTradesSnapshot;
  tradesClient.callbacks.onTrade = handleTradeIncremental;

  // --- REST prefetch for recent trades ---
  // Seeds the panel immediately on market switch so users don't see an
  // empty flash while the SSE trades stream handshakes. Only writes if
  // the atom is still empty — a faster SSE snapshot always wins.
  async function prefetchRecentTrades(targetMarketId: string) {
    // Build context synchronously from marketsAtom. If lot sizes aren't
    // known yet (markets still loading), fall back to whatever SSE will
    // provide via ctxMapRef shortly — skip the prefetch in that case.
    const market = markets.find(m => m.uuid === targetMarketId);
    const ctx = market ? buildContextFromMarket(market) : ctxMapRef.current.get(targetMarketId);
    if (!ctx) return;

    // Cancel any previous in-flight prefetch (stale market).
    tradesPrefetchAbortRef.current?.abort();
    const controller = new AbortController();
    tradesPrefetchAbortRef.current = controller;

    try {
      // v2 path (Redis-backed) is preferred; legacy /market/:id/trades/recent
      // kept as fallback until we fully retire /state/*.
      const path = config.devnet.useV2ReadLayer
        ? `/v2/trades/${encodeURIComponent(targetMarketId)}?limit=${RECENT_TRADES_PREFETCH_LIMIT}`
        : `/market/${targetMarketId}/trades/recent?limit=${RECENT_TRADES_PREFETCH_LIMIT}`;
      const url = `${config.devnet.gatewayUrl}${path}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return;
      const body = await res.json();
      // v2 returns {market, trades: [...]}; legacy returns the array directly.
      const trades = (Array.isArray(body) ? body : (body?.trades ?? [])) as SSETrade[];
      if (controller.signal.aborted) return;
      if (!Array.isArray(trades) || trades.length === 0) return;

      const snapshot: SSETradesStreamSnapshot = {
        view: 'rest',
        market: targetMarketId,
        data: trades,
      };
      const mapped = mapRecentTrades(snapshot, ctx);

      // Only seed if atom is still empty — SSE snapshot always takes precedence.
      setRecentTrades(prev => (prev.length === 0 ? mapped.slice(0, RECENT_TRADES_MAX) : prev));
    } catch {
      /* aborted or network error — SSE stream will seed the panel instead */
    }
  }

  // --- Initial connection (runs once) ---
  useEffect(() => {
    if (marketId) {
      prefetchRecentTrades(marketId);
      if (v2Enabled) {
        v2Composite.connect(marketId, publicKey?.toBase58() ?? null);
        // Seed orderbook immediately via REST so the UI renders before the
        // first composite event arrives (typically within one RTT but can
        // be slower on cold connect).
        void coldLoadV2(marketId);
      } else {
        client.connect(marketId, publicKey?.toBase58() ?? null);
        tradesClient.connect(marketId);
      }
    }
    return () => {
      tradesPrefetchAbortRef.current?.abort();
      coldLoadAbortRef.current?.abort();
      client.disconnect();
      v2Composite.disconnect();
      tradesClient.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Market switch ---
  const prevMarketRef = useRef(marketId);
  useEffect(() => {
    if (!marketId) return;
    if (prevMarketRef.current === marketId) return;
    prevMarketRef.current = marketId;

    if (v2Enabled) {
      if (v2Composite.getState() === 'disconnected') {
        v2Composite.connect(marketId, publicKey?.toBase58() ?? null);
      } else {
        v2Composite.switchMarket(marketId);
      }
      void coldLoadV2(marketId);
    } else {
      if (client.getState() === 'disconnected') {
        client.connect(marketId, publicKey?.toBase58() ?? null);
      } else {
        client.switchMarket(marketId);
      }
      if (tradesClient.getState() === 'disconnected') {
        tradesClient.connect(marketId);
      } else {
        tradesClient.switchMarket(marketId);
      }
    }

    // Clear stale trades and seed with REST prefetch for instant paint.
    setRecentTrades([]);
    prefetchRecentTrades(marketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  // --- Wallet connect/disconnect ---
  const prevOwnerRef = useRef(publicKey?.toBase58() ?? null);
  useEffect(() => {
    const ownerStr = publicKey?.toBase58() ?? null;
    if (prevOwnerRef.current === ownerStr) return;
    prevOwnerRef.current = ownerStr;

    if (!ownerStr) {
      // Clear user-specific atoms on disconnect
      setUserOrders([]);
      setUserTrades([]);
      setUserPositions([]);
      setAccountMetrics(null);
    }

    if (v2Enabled) {
      // ?owner= is bound at connect time on the gateway; reopen the stream
      // so the account-scoped events fire for the new wallet.
      v2Composite.switchOwner(ownerStr);
    } else if (client.getState() !== 'disconnected') {
      client.switchOwner(ownerStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);
}
