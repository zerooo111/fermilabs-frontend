/**
 * @file processOrderbook.ts
 * @description Utilities for processing and formatting raw order book data for display.
 *
 * Order book data typically arrives from exchanges as arrays of price/quantity pairs.
 * Prices and quantities are often represented as scaled integers to avoid floating-point issues.
 * This module turns per-level or cumulative book sides into display rows (size, notional,
 * depth bar) using BN.js for notional precision, and formats values for UI rendering.
 * The approach aligns with standard practices seen on major crypto exchanges (e.g., Binance, Kraken).
 */
import { Orderbook, OrderbookItem, OrderbookDepthMode } from '@/entities/orderbook';
import BN from 'bn.js';

/**
 * Number of decimal places used for internal price representation (e.g., 1_000_000_000 means 9 decimals).
 * Exchanges often send prices/quantities as integers scaled by a power of 10.
 */

/** Number of decimal places to display in the UI for prices and quantities. */
export const DISPLAY_DECIMALS = 2;
/** Default number of rows to display on each side (bids/asks) of the order book. */
const DEFAULT_ORDERBOOK_ROWS = 12;

/** Minimum normalized quantity to display prominently. Quantities below this are de-emphasized. */
export const MIN_DISPLAY_QUANTITY = 0.0001;

/**
 * Create BN scale for decimal conversion
 * @param decimals Number of decimal places
 * @returns BN scale factor
 */
const createDecimalScale = (decimals: number): BN => {
  return new BN(10).pow(new BN(decimals));
};

/**
 * Safely converts a value to BN
 * @param value Number or string to convert
 * @returns BN instance or null if invalid
 */
export const toBN = (value: number | string): BN | null => {
  try {
    return new BN(value.toString());
  } catch {
    // Silent error handling
    return null;
  }
};

/**
 * Normalizes a BN value by the specified decimal scale
 * @param value BN value to normalize
 * @param scale Decimal scale to divide by
 * @returns Normalized number or 0 if invalid
 */
export const normalizeBN = (value: BN, scale: BN): number => {
  try {
    return Number(value.toString()) / Number(scale.toString());
  } catch {
    // Silent error handling
    return 0;
  }
};

/**
 * Formats a number to a human-readable string with appropriate precision
 * Uses different precision based on the number's magnitude
 * @param value The normalized value (after scaling)
 * @returns Formatted string
 */
const formatWithPrecision = (value: number): string => {
  if (value === 0) return '0.00';

  const abs = Math.abs(value);

  // For very small numbers, show more decimals
  if (abs < 0.0001) return value.toFixed(8);
  if (abs < 0.01) return value.toFixed(6);
  if (abs < 1) return value.toFixed(4);
  if (abs < 100) return value.toFixed(2);

  // For larger numbers, use comma grouping
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formats a scaled integer price for display using appropriate precision.
 * @param price The scaled integer price
 * @param quoteTokenName The quote token name for decimal determination
 * @returns A string representation with dynamic precision.
 */
export const formatPrice = (price: number, quoteDecimals: number): string => {
  const priceBN = toBN(price);
  if (!priceBN) return '0.00';

  try {
    const scale = createDecimalScale(quoteDecimals);
    const normalizedPrice = normalizeBN(priceBN, scale);
    return formatWithPrecision(normalizedPrice);
  } catch {
    // Silent error handling
    return '0.00';
  }
};

/**
 * Formats a scaled integer quantity for display using appropriate precision.
 * @param quantity The scaled integer quantity
 * @param baseTokenName The base token name for decimal determination
 * @returns A string representation with dynamic precision.
 */
export const formatQuantity = (quantity: number, baseDecimals: number): string => {
  const quantityBN = toBN(quantity);
  if (!quantityBN) return '0.00';

  try {
    const scale = createDecimalScale(baseDecimals);
    const normalizedQuantity = normalizeBN(quantityBN, scale);
    return formatWithPrecision(normalizedQuantity);
  } catch {
    // Silent error handling
    return '0.00';
  }
};

/**
 * Formats a notional value (sum of price_raw * quantity_raw) in quote units.
 * The raw value is scaled by (quoteDecimals + baseDecimals).
 */
export const formatNotional = (
  notional: BN,
  quoteDecimals: number,
  baseDecimals: number
): string => {
  try {
    const totalScale = createDecimalScale(baseDecimals).mul(createDecimalScale(quoteDecimals));
    return formatWithPrecision(normalizeBN(notional, totalScale));
  } catch {
    // Silent error handling
    return '0.00';
  }
};

/**
 * Calculates and formats the total value (price * quantity) using BN.js for precision
 * @param price Scaled integer price (in quote token units with quoteDecimals scaling)
 * @param quantity Scaled integer quantity (in base token units with baseDecimals scaling)
 * @param quoteDecimals Number of decimals for the quote token
 * @param baseDecimals Number of decimals for the base token
 * @returns Formatted string with appropriate precision
 *
 * Formula: total = (price_raw * quantity_raw) / (10^quoteDecimals * 10^baseDecimals)
 * Example: price=115000000000 (115k USDC, 6 decimals), quantity=1500000000 (1.5 SOL, 9 decimals)
 *          total = (115000000000 * 1500000000) / (10^6 * 10^9) = 172,500 USDC
 */
export const formatTotal = (
  price: number,
  quantity: number,
  quoteDecimals: number,
  baseDecimals: number
): string => {
  const priceBN = toBN(price);
  const quantityBN = toBN(quantity);
  if (!priceBN || !quantityBN) return '0.00';
  return formatNotional(priceBN.mul(quantityBN), quoteDecimals, baseDecimals);
};

/** Represents a single price level in the processed order book. */
export type AggregatedOrder = {
  /** The price level (scaled integer). */
  price: number;
  /**
   * Displayed quantity (scaled integer): the level's own size in `level` mode,
   * or the size resting from the best price down to this level in `cumulative` mode.
   */
  quantity: number;
  /** Notional (price_raw * quantity_raw) matching `quantity` — per level or cumulative. */
  total: BN;
  /** The visual depth percentage (0-100) of `quantity` relative to the largest visible one. */
  depth: number;
};

/** Represents the fully processed order book data ready for UI consumption. */
export type ProcessedOrderbook = {
  /** Array of buy levels (bids), sorted descending by price. Null entries used for padding. */
  buys: (AggregatedOrder | null)[];
  /** Array of sell levels (asks), sorted ascending by price. Null entries used for padding. */
  sells: (AggregatedOrder | null)[];
  /** The difference between the best ask and best bid price. */
  spread: number;
  /** Timestamp of the last update received from the source. */
  lastUpdated: Date;
};

/**
 * Converts one side of the book (best price first) into display levels.
 * Per-level sizes drive the min-size filter in both modes; in cumulative mode
 * they are recovered by differencing the server's running totals, and the
 * displayed quantity stays the server's cumulative value.
 */
const buildSide = (
  orders: OrderbookItem[],
  sortFn: (a: number, b: number) => number,
  depthMode: OrderbookDepthMode,
  maxRows: number,
  minLevelQuantity: number
): AggregatedOrder[] => {
  const sorted = [...orders].sort((a, b) => sortFn(a.price, b.price));

  let prevCumulative = 0;
  let runningNotional = new BN(0);
  const levels: AggregatedOrder[] = [];

  for (const order of sorted) {
    const levelQuantity =
      depthMode === 'cumulative' ? Math.max(0, order.quantity - prevCumulative) : order.quantity;
    prevCumulative = order.quantity;

    const levelNotional = new BN(order.price).mul(new BN(levelQuantity));
    runningNotional = runningNotional.add(levelNotional);

    if (levelQuantity === 0 || levelQuantity < minLevelQuantity) continue;

    const cumulative = depthMode === 'cumulative';
    levels.push({
      price: order.price,
      quantity: cumulative ? order.quantity : levelQuantity,
      total: cumulative ? runningNotional : levelNotional,
      depth: 0,
    });
    if (levels.length >= maxRows) break;
  }

  return levels;
};

/**
 * Processes the raw order book data into a display-ready format.
 *
 * @param orderbook The order book; `orderbook.depthMode` says how its quantities are expressed.
 * @param maxRows The maximum number of rows to display per side (bids/asks).
 * @param quantityThreshold Minimum per-level size (normalized). Use 0 to show all levels.
 * @param baseDecimals Base token decimals, used to normalize the threshold.
 */
export const processOrderbook = (
  orderbook: Orderbook | null,
  maxRows: number = DEFAULT_ORDERBOOK_ROWS,
  quantityThreshold: number = 0,
  baseDecimals: number = 0
): ProcessedOrderbook => {
  if (!orderbook || !orderbook.asks || !orderbook.bids) {
    return {
      buys: Array(maxRows).fill(null),
      sells: Array(maxRows).fill(null),
      spread: 0,
      lastUpdated: new Date(0),
    };
  }

  const minLevelQuantity = quantityThreshold * Math.pow(10, baseDecimals);
  const bids = buildSide(
    orderbook.bids,
    (a, b) => b - a,
    orderbook.depthMode,
    maxRows,
    minLevelQuantity
  );
  const asks = buildSide(
    orderbook.asks,
    (a, b) => a - b,
    orderbook.depthMode,
    maxRows,
    minLevelQuantity
  );

  const maxQuantity = Math.max(0, ...bids.map(o => o.quantity), ...asks.map(o => o.quantity));
  for (const order of [...bids, ...asks]) {
    order.depth = maxQuantity > 0 ? (order.quantity / maxQuantity) * 100 : 0;
  }

  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const spread = bestAsk !== undefined && bestBid !== undefined ? bestAsk - bestBid : 0;

  return {
    buys: [...bids, ...Array(Math.max(0, maxRows - bids.length)).fill(null)],
    sells: [...asks, ...Array(Math.max(0, maxRows - asks.length)).fill(null)],
    spread,
    lastUpdated: orderbook.lastUpdated,
  };
};
