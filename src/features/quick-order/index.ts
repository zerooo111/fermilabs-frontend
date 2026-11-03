/**
 * Quick multi-order feature
 * ⌘K palette that turns one typed line into a basket of market orders, and
 * the quick ticket that reviews and sends it.
 */
export { QuickOrderPalette } from './ui/QuickOrderPalette';
export { MAX_BASKET_LEGS, parseQuickOrder, describeLeg } from './model/parse';
export type { QuickOrderLeg, QuickOrderMarket, QuickOrderParse } from './model/parse';
