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
  order_count: number;
  price: number;
  quantity: number;
  total_quantity: number;
}

export interface Orderbook {
  buys: OrderbookItem[];
  sells: OrderbookItem[];
  lastUpdated: Date;
}

// Orderbook state atom
export const orderbookAtom = atom<Orderbook>({
  buys: [],
  sells: [],
  lastUpdated: new Date(),
});

// Orderbook hooks
export const useOrderbook = () => {
  const [orderbook, setOrderbook] = useAtom(orderbookAtom);
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const lastUpdateTimeRef = useRef<number>(0);
  const { fetchOrderbook } = useSequencerApi();

  // Clear orderbook when market changes
  useEffect(() => {
    setOrderbook({
      buys: [],
      sells: [],
      lastUpdated: new Date(),
    });
    lastUpdateTimeRef.current = 0; // Reset the update time
  }, [selectedMarket?.uuid, setOrderbook]);

  const loadOrderbook = useCallback(async () => {
    if (!selectedMarket || !setOrderbook || !fetchOrderbook) return null;

    const currentTime = Date.now();
    const fetchStartTime = currentTime;

    // Only proceed if this is a newer request
    if (fetchStartTime <= lastUpdateTimeRef.current) {
      return null;
    }

    const orderbook = await fetchOrderbook(selectedMarket.uuid);

    // Check if this response is still relevant
    if (fetchStartTime > lastUpdateTimeRef.current) {
      lastUpdateTimeRef.current = fetchStartTime;

      // No need to filter by mint since the API already returns market-specific data
      const filteredBuys = orderbook.buys;
      const filteredSells = orderbook.sells;

      setOrderbook({
        buys: filteredBuys,
        sells: filteredSells,
        lastUpdated: new Date(),
      });
    }
    return orderbook;
  }, [selectedMarket, setOrderbook, fetchOrderbook]);

  return {
    orderbook,
    setOrderbook,
    loadOrderbook,
  };
};
