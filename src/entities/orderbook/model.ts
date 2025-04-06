/**
 * Orderbook entity model
 * Defines orderbook-related state and operations
 */
import { atom, useAtom, useAtomValue } from 'jotai';
import { useCallback, useRef, useEffect } from 'react';
import { selectedMarketAtom } from '../market';
import { useQuery } from '@tanstack/react-query';
import { useSequencerApi } from '@/shared/api/useSequencerApi';

// Orderbook types
export interface OrderbookItem {
  market_id: string;
  base_mint: string;
  quote_mint: string;
  price: number;
  size: number;
  [key: string]: any;
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

      const filteredBuys = orderbook.buys.filter(
        (it: OrderbookItem) =>
          it.base_mint === selectedMarket.base_mint && it.quote_mint === selectedMarket.quote_mint
      );

      const filteredSells = orderbook.sells.filter(
        (it: OrderbookItem) =>
          it.base_mint === selectedMarket.base_mint && it.quote_mint === selectedMarket.quote_mint
      );

      setOrderbook({
        buys: filteredBuys,
        sells: filteredSells,
        lastUpdated: new Date(),
      });
    }
    return orderbook;
  }, [selectedMarket, setOrderbook, fetchOrderbook]);

  // Setup query for orderbook data
  const useOrderbookQuery = () => {
    return useQuery({
      queryKey: ['orderbook', selectedMarket?.uuid],
      queryFn: loadOrderbook,
      refetchInterval: 1000,
      enabled: !!selectedMarket,
      staleTime: 0,
      gcTime: 0,
    });
  };

  return {
    orderbook,
    setOrderbook,
    loadOrderbook,
    useOrderbookQuery,
  };
};
