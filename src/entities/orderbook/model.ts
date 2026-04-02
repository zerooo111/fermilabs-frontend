/**
 * Orderbook entity model
 * Defines orderbook-related state and operations
 */
import { atom, useAtomValue } from 'jotai';

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

// Orderbook state atom — written to by SSE stream via useSSEStream
export const orderbookAtom = atom<Orderbook>({
  asks: [],
  bids: [],
  lastUpdateId: 0,
  lastUpdated: new Date(),
});

// Orderbook hook — reads from atom (SSE populates it)
export const useOrderbook = () => {
  const orderbook = useAtomValue(orderbookAtom);
  return { orderbook };
};
