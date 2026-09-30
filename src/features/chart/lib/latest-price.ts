import { atom } from 'jotai';

import { calculatePerpsPriceChange } from './perps-chart';

/**
 * The selected market's latest price and change, as computed from the chart's
 * candles. Published by PerpsChartContainer so a market header rendered
 * outside the chart (the /perps-v2 market bar) shows the same figures.
 */
export const chartLatestPriceAtom = atom<ReturnType<typeof calculatePerpsPriceChange>>(null);
