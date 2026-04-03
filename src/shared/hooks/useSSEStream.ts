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
import {
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
} from '@/shared/api/sse-types';
import { config } from '@/shared/config/constants';

const DEFAULT_CTX: MarketContext = {
  name: '',
  baseMint: '',
  quoteMint: '',
  baseDecimals: config.devnet.baseDecimals,
  quoteDecimals: config.devnet.quoteDecimals,
  baseLotSize: config.devnet.baseLotSize,
  quoteLotSize: config.devnet.quoteLotSize,
};

export function useSSEStream() {
  const { publicKey } = useWallet();
  const marketId = useAtomValue(selectedMarketIdAtom);

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
    setRecentTrades(mapRecentTrades(data, ctx));
  }

  function handleTradeIncremental(data: import('@/shared/api/sse-types').SSETradesStreamSnapshot) {
    const ctx = ctxMapRef.current.get(data.market) ?? DEFAULT_CTX;
    const newTrades = mapRecentTrades(data, ctx);
    setRecentTrades(prev => [...newTrades, ...prev].slice(0, 100));
  }

  tradesClient.callbacks.onSnapshot = handleTradesSnapshot;
  tradesClient.callbacks.onTrade = handleTradeIncremental;

  // --- Initial connection (runs once) ---
  useEffect(() => {
    if (marketId) {
      client.connect(marketId, publicKey?.toBase58() ?? null);
      tradesClient.connect(marketId);
    }
    return () => {
      client.disconnect();
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

    if (client.getState() === 'disconnected') {
      client.connect(marketId, publicKey?.toBase58() ?? null);
    } else {
      client.switchMarket(marketId);
    }

    // Switch trades stream too
    if (tradesClient.getState() === 'disconnected') {
      tradesClient.connect(marketId);
    } else {
      tradesClient.switchMarket(marketId);
    }
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

    if (client.getState() !== 'disconnected') {
      client.switchOwner(ownerStr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);
}
