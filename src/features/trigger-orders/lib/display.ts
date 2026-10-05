import { priceLotsToUi } from './triggerLegs';
import type { TriggerOrder, TriggerOrderState } from '../model/useTriggerOrders';

/**
 * Worst fill vs the trigger. A leg that fires is an IOC: if the price has
 * already moved further than this, it does not fill and the leg is spent.
 * Loose enough to ride out one late oracle update.
 */
export const TRIGGER_SLIPPAGE_BPS = 100;

/**
 * Good-til time. A cancel is off-chain and a signed leg stays valid until it
 * expires, so keep this short (the keeper's ceiling is 30 days).
 */
export const TRIGGER_EXPIRY_DAYS = 7;
export const TRIGGER_EXPIRY_SECS = TRIGGER_EXPIRY_DAYS * 24 * 60 * 60;

/** Shown next to SL/TP inputs (client-SL-TP.md, "Liveness"). */
export const TRIGGER_LATENCY_NOTE =
  `Triggers on the on-chain price, which can lag up to a minute. ` +
  `Closes within ${TRIGGER_SLIPPAGE_BPS / 100}% of your price or not at all. ` +
  `Expires in ${TRIGGER_EXPIRY_DAYS} days.`;

/** Appended to the note when the owner wallet (not one-click) signs each leg. */
export const TRIGGER_SIGN_NOTE = 'Approve each in your wallet after the order.';

export type LegMarket = {
  baseDecimals: number;
  quoteDecimals: number;
  baseLotSize: number;
  quoteLotSize: number;
};

/** i64::MAX base lots means "close the whole position". */
const ALL_LOTS_THRESHOLD = 2 ** 62;

/** UI amount → native integer, for the native-unit formatPrice / formatQuantity. */
export const toNative = (ui: number, decimals: number): number => Math.round(ui * 10 ** decimals);

export function legTriggerPrice(order: TriggerOrder, market: LegMarket): number {
  return priceLotsToUi(order.trigger_price_lots, market);
}

/** UI base size, or null when the leg closes the whole position. */
export function legSize(order: TriggerOrder, market: LegMarket): number | null {
  if (order.max_base_lots >= ALL_LOTS_THRESHOLD) return null;
  return (order.max_base_lots * market.baseLotSize) / 10 ** market.baseDecimals;
}

export const LEG_STATE_LABEL: Record<TriggerOrderState, string> = {
  pending: 'Waiting for fill',
  armed: 'Active',
  firing: 'Triggering',
  submitted: 'Triggered',
  cancelled: 'Cancelled',
  expired: 'Expired',
  failed: 'Failed',
  fire_unknown: 'Check order history',
};
