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
  // When enabled, subscribe to /v2/stream/frontend/:market?owner=X as a
  // single composite stream. Events are used as invalidation signals:
  //   - `book`    → debounced refetch /v2/snapshot/orderbook
  //   - `trade`   → debounced refetch /v2/trades
  //   - `intent`  → debounced refetch /v2/trades (new fills often show up here first)
  //   - `account` → (future: refetch /v2/snapshot/account + /v2/snapshot/orders)
  //   - `meta`    → currently no-op; market metrics still driven by the v1 path
  //                 fallback until metricsAtom has a v2 source of truth.
  // One SSE connection replaces the prior event/trades dual-stream plus the
  // explicit REST poll loop.
  const v2Enabled = config.devnet.useV2ReadLayer;
  const v2Composite = getV2CompositeClient();
  const currentMarketRef = useRef<string | null>(marketId);
  currentMarketRef.current = marketId;

  const orderbookRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderbookRefetchAbortRef = useRef<AbortController | null>(null);
  const tradesRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tradesRefetchAbortRef = useRef<AbortController | null>(null);

  function scheduleOrderbookRefetch() {
    if (!v2Enabled) return;
    if (orderbookRefetchTimerRef.current) return;
    orderbookRefetchTimerRef.current = setTimeout(async () => {
      orderbookRefetchTimerRef.current = null;
      const mid = currentMarketRef.current;
      if (!mid) return;
      const market = markets.find(m => m.uuid === mid);
      const ctx = market ? buildContextFromMarket(market) : ctxMapRef.current.get(mid);
      if (!ctx) return;
      orderbookRefetchAbortRef.current?.abort();
      const controller = new AbortController();
      orderbookRefetchAbortRef.current = controller;
      try {
        const snap = await fetchV2Orderbook(mid, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setOrderbook(mapV2Orderbook(snap, ctx));
      } catch {
        /* transient; next event will re-trigger */
      }
    }, 50);
  }

  function scheduleTradesRefetch() {
    if (!v2Enabled) return;
    if (tradesRefetchTimerRef.current) return;
    tradesRefetchTimerRef.current = setTimeout(async () => {
      tradesRefetchTimerRef.current = null;
      const mid = currentMarketRef.current;
      if (!mid) return;
      const market = markets.find(m => m.uuid === mid);
      const ctx = market ? buildContextFromMarket(market) : ctxMapRef.current.get(mid);
      if (!ctx) return;
      tradesRefetchAbortRef.current?.abort();
      const controller = new AbortController();
      tradesRefetchAbortRef.current = controller;
      try {
        const resp = await fetchV2Trades(mid, {
          limit: RECENT_TRADES_MAX,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        // The v2 /trades response shape is `{market, trades: [{id, maker, taker, price, size, side, ts_ms}]}`.
        // Translate to RecentTrade (native-scaled price/qty using market ctx).
        const baseScale = 10 ** ctx.baseDecimals;
        const mapped = resp.trades.map(t => {
          const priceLots = t.price ? BigInt(t.price) : 0n;
          const sizeLots = t.size ? BigInt(t.size) : 0n;
          const price = Number(
            (priceLots * BigInt(ctx.quoteLotSize) * BigInt(baseScale)) /
              BigInt(Math.max(1, ctx.baseLotSize))
          );
          const quantity = Number(sizeLots * BigInt(ctx.baseLotSize));
          const takerSide = t.side === 'bid' ? 'bid' : 'ask';
          return {
            id: t.id,
            price,
            quantity,
            timestamp: Math.floor(Number(t.ts_ms ?? 0) / 1000),
            buyer_owner: takerSide === 'bid' ? (t.taker ?? '') : (t.maker ?? ''),
            seller_owner: takerSide === 'ask' ? (t.taker ?? '') : (t.maker ?? ''),
          };
        });
        setRecentTrades(prev => mergeRecentTrades(mapped, prev));
      } catch {
        /* transient; next event will re-trigger */
      }
    }, 100);
  }

  v2Composite.callbacks.onStateChange = setConnectionState;
  v2Composite.callbacks.onBook = () => scheduleOrderbookRefetch();
  v2Composite.callbacks.onTrade = () => scheduleTradesRefetch();
  v2Composite.callbacks.onIntent = () => scheduleTradesRefetch();
  v2Composite.callbacks.onResync = () => {
    scheduleOrderbookRefetch();
    scheduleTradesRefetch();
  };
  v2Composite.callbacks.onReady = () => {
    // Eager seed: gateway already pushed the first book+meta; kick a trades
    // refetch too so the panel is populated immediately.
    scheduleTradesRefetch();
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
        // Seed orderbook immediately — don't wait for the first event.
        scheduleOrderbookRefetch();
      } else {
        client.connect(marketId, publicKey?.toBase58() ?? null);
        tradesClient.connect(marketId);
      }
    }
    return () => {
      tradesPrefetchAbortRef.current?.abort();
      orderbookRefetchAbortRef.current?.abort();
      tradesRefetchAbortRef.current?.abort();
      if (orderbookRefetchTimerRef.current) clearTimeout(orderbookRefetchTimerRef.current);
      if (tradesRefetchTimerRef.current) clearTimeout(tradesRefetchTimerRef.current);
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
      scheduleOrderbookRefetch();
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
