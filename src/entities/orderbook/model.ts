/**
 * Orderbook entity model
 * Defines orderbook-related state and operations
 */
import { atom, useAtomValue } from 'jotai';
import type { OrderbookDepthMode } from '@/shared/api/sse-types';

export type { OrderbookDepthMode };

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
  /** How `quantity` is expressed — echoed by the server, so it always matches the data. */
  depthMode: OrderbookDepthMode;
}

// Orderbook state atom — written to by SSE stream via useSSEStream
export const orderbookAtom = atom<Orderbook>({
  asks: [],
  bids: [],
  lastUpdateId: 0,
  lastUpdated: new Date(),
  depthMode: 'cumulative',
});

// Depth mode requested from the server for the orderbook panel.
export const orderbookDepthModeAtom = atom<OrderbookDepthMode>('cumulative');

// Orderbook hook — reads from atom (SSE populates it)
export const useOrderbook = () => {
  const orderbook = useAtomValue(orderbookAtom);
  return { orderbook };
};
