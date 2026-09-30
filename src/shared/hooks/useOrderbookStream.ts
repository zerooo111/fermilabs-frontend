/**
 * useOrderbookStream — feeds `orderbookAtom` from /state/stream/frontend
 * with the selected `depth_mode`. Market-only (no owner), so it runs
 * alongside whichever read layer serves account data.
 * Mount once in PerpsPage.
 */
import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { selectedMarketIdAtom } from '@/entities/market';
import { orderbookAtom, orderbookDepthModeAtom } from '@/entities/orderbook/model';
import { orderbookConnectionStateAtom } from '@/shared/api/sse-atoms';
import { getOrderbookSSEClient } from '@/shared/api/sse-client';
import { buildMarketContext, mapOrderbook } from '@/shared/api/sse-atom-bridge';
import type { SSEMarketUpdateEvent } from '@/shared/api/sse-types';

// Levels requested per side. Above the panel's max visible rows (30) so the
// min-size filter still has levels left to show.
const ORDERBOOK_STREAM_DEPTH = 50;

export function useOrderbookStream() {
  const marketId = useAtomValue(selectedMarketIdAtom);
  const depthMode = useAtomValue(orderbookDepthModeAtom);
  const setOrderbook = useSetAtom(orderbookAtom);
  const setConnectionState = useSetAtom(orderbookConnectionStateAtom);

  const marketIdRef = useRef(marketId);
  marketIdRef.current = marketId;

  const client = getOrderbookSSEClient();

  function handleMarketUpdate(data: SSEMarketUpdateEvent) {
    if (data.market !== marketIdRef.current || !data.orderbook_summary) return;
    const ctx = buildMarketContext(data);
    setOrderbook(mapOrderbook(data.orderbook_summary, ctx.baseDecimals, ctx.quoteDecimals));
  }

  client.callbacks.onStateChange = setConnectionState;
  client.callbacks.onMarketUpdate = handleMarketUpdate;
  client.callbacks.onSnapshot = data => {
    if (data.market) handleMarketUpdate(data.market);
  };

  // Clear the previous market's book so it never renders under the new market.
  const prevMarketRef = useRef(marketId);
  useEffect(() => {
    if (prevMarketRef.current === marketId) return;
    prevMarketRef.current = marketId;
    setOrderbook(prev => ({ ...prev, bids: [], asks: [], lastUpdateId: 0 }));
  }, [marketId, setOrderbook]);

  // (Re)connect whenever the market or depth mode changes. On a mode switch the
  // old book stays up until the new snapshot lands; it carries its own
  // depthMode, so it keeps rendering correctly in the meantime.
  useEffect(() => {
    if (!marketId) return;
    client.setOrderbookParams(depthMode, ORDERBOOK_STREAM_DEPTH);
    client.disconnect();
    client.connect(marketId);
  }, [client, marketId, depthMode]);

  useEffect(() => () => client.disconnect(), [client]);
}
