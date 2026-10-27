import { atom } from 'jotai';
import type { OrderbookDepthMode } from '@/entities/orderbook';

// Price grouping (tick, in quote units): every quote is collapsed onto the nearest
// multiple of this and their sizes summed. 0 keeps one row per price level.
export const PRICE_GROUP_OPTIONS = [
  { label: 'No grouping', value: 0 },
  { label: '0.01', value: 0.01 },
  { label: '0.1', value: 0.1 },
  { label: '1', value: 1 },
  { label: '10', value: 10 },
] as const;

export type PriceGroup = (typeof PRICE_GROUP_OPTIONS)[number]['value'];

export const priceGroupAtom = atom<PriceGroup>(PRICE_GROUP_OPTIONS[0].value);

export const DEPTH_MODE_OPTIONS: { label: string; value: OrderbookDepthMode }[] = [
  { label: 'Cumulative', value: 'cumulative' },
  { label: 'Isolated', value: 'level' },
];
