import { atom } from 'jotai';

export const QUANTITY_THRESHOLD_OPTIONS = [
  { label: 'Show All', value: 0 },
  { label: '≥ 1.0', value: 1 },
  { label: '≥ 0.1', value: 0.1 },
  { label: '≥ 0.01', value: 0.01 },
  { label: '≥ 0.001', value: 0.001 },
] as const;

export type QuantityThreshold = (typeof QUANTITY_THRESHOLD_OPTIONS)[number]['value'];

export const quantityThresholdAtom = atom<QuantityThreshold>(QUANTITY_THRESHOLD_OPTIONS[0].value);
