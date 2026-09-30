import { atom } from 'jotai';
import type { OrderbookDepthMode } from '@/entities/orderbook';

// Minimum per-level size (in base units) shown in the orderbook.
export const QUANTITY_THRESHOLD_OPTIONS = [
  { label: 'All sizes', value: 0 },
  { label: '≥ 0.01', value: 0.01 },
  { label: '≥ 0.1', value: 0.1 },
  { label: '≥ 1', value: 1 },
  { label: '≥ 10', value: 10 },
] as const;

export type QuantityThreshold = (typeof QUANTITY_THRESHOLD_OPTIONS)[number]['value'];

export const quantityThresholdAtom = atom<QuantityThreshold>(QUANTITY_THRESHOLD_OPTIONS[0].value);

export const DEPTH_MODE_OPTIONS: { label: string; value: OrderbookDepthMode }[] = [
  { label: 'Cumulative', value: 'cumulative' },
  { label: 'Isolated', value: 'level' },
];
