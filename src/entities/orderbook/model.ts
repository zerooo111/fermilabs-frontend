/**
 * Orderbook entity model
 * Defines orderbook-related state and operations
 */
import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useRef, useEffect } from 'react';
import { selectedMarketAtom } from '../market';
import { useSequencerApi } from '@/shared/api/useSequencerApi';

// Orderbook types
export interface OrderbookItem {
  price: number;
  quantity: number;
}

export interface Orderbook {
  asks: OrderbookItem[];
  bids: OrderbookItem[];
  lastUpdateId: number;
  lastUpdated: Date;
}

// Orderbook state atom
export const orderbookAtom = atom<Orderbook>({
  asks: [],
  bids: [],
  lastUpdateId: 0,
  lastUpdated: new Date(),
});

// Orderbook hooks
export const useOrderbook = () => {
  const [orderbook, setOrderbook] = useAtom(orderbookAtom);
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const lastUpdateTimeRef = useRef<number>(0);
  const { fetchOrderbookDepth } = useSequencerApi();

  // Clear orderbook when market changes
  useEffect(() => {
    setOrderbook({
      asks: [],
      bids: [],
      lastUpdateId: 0,
      lastUpdated: new Date(),
    });
    lastUpdateTimeRef.current = 0; // Reset the update time
  }, [selectedMarket?.uuid, setOrderbook]);

  const loadOrderbook = useCallback(async () => {
    if (!selectedMarket || !setOrderbook || !fetchOrderbookDepth) return null;

    const currentTime = Date.now();
    const fetchStartTime = currentTime;

    // Only proceed if this is a newer request
    if (fetchStartTime <= lastUpdateTimeRef.current) {
      return null;
    }

    const depthData = await fetchOrderbookDepth(selectedMarket.uuid, selectedMarket);

    // Check if this response is still relevant
    if (fetchStartTime > lastUpdateTimeRef.current) {
      lastUpdateTimeRef.current = fetchStartTime;

      // Transform depth data to orderbook items
      // Keep as raw integers (not floats) - they will be scaled by decimals in formatting
      const asks: OrderbookItem[] = depthData.asks.map(([price, quantity]) => ({
        price: Number(price),
        quantity: Number(quantity),
      }));

      const bids: OrderbookItem[] = depthData.bids.map(([price, quantity]) => ({
        price: Number(price),
        quantity: Number(quantity),
      }));

      setOrderbook({
        asks,
        bids,
        lastUpdateId: depthData.lastUpdateId,
        lastUpdated: new Date(),
      });
    }
    return depthData;
  }, [selectedMarket, setOrderbook, fetchOrderbookDepth]);

  return {
    orderbook,
    setOrderbook,
    loadOrderbook,
  };
};
