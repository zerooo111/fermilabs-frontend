/**
 * @file processOrderbook.ts
 * @description Utilities for processing and formatting raw order book data for display.
 *
 * Order book data typically arrives from exchanges as arrays of price/quantity pairs.
 * Prices and quantities are often represented as scaled integers to avoid floating-point issues.
 * This module aggregates orders at the same price level, calculates cumulative totals (depth)
 * using BN.js for precision, normalizes values for display, and formats them into a structure
 * suitable for UI rendering.
 * The approach aligns with standard practices seen on major crypto exchanges (e.g., Binance, Kraken).
 */
import { Orderbook, OrderbookItem } from '@/entities/orderbook';
import BN from 'bn.js';
import { BASE_DECIMALS, QUOTE_DECIMALS } from '@/shared/config/constants';

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

/** Threshold for highlighting price levels close to last traded price (as percentage) */
export const PRICE_PROXIMITY_THRESHOLD = 0.001; // 0.1%

/** BN constants for decimal scaling */
export const BASE_DECIMAL_SCALE = new BN(10).pow(new BN(BASE_DECIMALS));
export const QUOTE_DECIMAL_SCALE = new BN(10).pow(new BN(QUOTE_DECIMALS));

/**
 * Safely converts a value to BN
 * @param value Number or string to convert
 * @returns BN instance or null if invalid
 */
export const toBN = (value: number | string): BN | null => {
  try {
    return new BN(value.toString());
  } catch (e) {
    console.error('Error converting to BN:', e);
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
  } catch (e) {
    console.error('Error normalizing BN:', e);
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
 * @returns A string representation with dynamic precision.
 */
export const formatPrice = (price: number): string => {
  const priceBN = toBN(price);
  if (!priceBN) return '0.00';

  try {
    const normalizedPrice = normalizeBN(priceBN, BASE_DECIMAL_SCALE);
    return formatWithPrecision(normalizedPrice);
  } catch (e) {
    console.error('Error formatting price:', e);
    return '0.00';
  }
};

/**
 * Formats a scaled integer quantity for display using appropriate precision.
 * @param quantity The scaled integer quantity
 * @returns A string representation with dynamic precision.
 */
export const formatQuantity = (quantity: number): string => {
  const quantityBN = toBN(quantity);
  if (!quantityBN) return '0.00';

  try {
    const normalizedQuantity = normalizeBN(quantityBN, QUOTE_DECIMAL_SCALE);
    return formatWithPrecision(normalizedQuantity);
  } catch (e) {
    console.error('Error formatting quantity:', e);
    return '0.00';
  }
};

/**
 * Calculates and formats the total value (price * quantity) using BN.js for precision
 * @param price Scaled integer price
 * @param quantity Scaled integer quantity
 * @returns Formatted string with appropriate precision
 */
export const formatTotal = (price: number, quantity: number): string => {
  const priceBN = toBN(price);
  const quantityBN = toBN(quantity);
  if (!priceBN || !quantityBN) return '0.00';

  try {
    // Calculate total in scaled form
    const totalBN = priceBN.mul(quantityBN);

    // Normalize by both decimal scales
    const totalScale = BASE_DECIMAL_SCALE.mul(QUOTE_DECIMAL_SCALE);
    const normalizedTotal = normalizeBN(totalBN, totalScale);

    return formatWithPrecision(normalizedTotal);
  } catch (e) {
    console.error('Error formatting total:', e);
    return '0.00';
  }
};

/** Represents a single aggregated price level in the processed order book. */
export type AggregatedOrder = {
  /** The price level (represented as a scaled integer internally, normalized for display). */
  price: number;
  /** The total quantity of orders at this price level (scaled integer). */
  quantity: number;
  /** The cumulative quantity from the best price up to this level (uses BN.js to prevent overflow). */
  total: BN;
  /** The cumulative volume (sum of price * quantity) from the best price up to this level (uses BN.js to prevent overflow). */
  volumeTotal: BN;
  /** The visual depth percentage (0-100) based on cumulative quantity relative to max depth. */
  depth: number;
  /** Percentage deviation from the last traded price */
  priceDeviation?: number;
  /** Whether this price level is close to the last traded price */
  isNearLastPrice?: boolean;
};

/** Represents the fully processed order book data ready for UI consumption. */
export type ProcessedOrderbook = {
  /** Array of aggregated buy orders (bids), sorted descending by price. Null entries used for padding. */
  buys: (AggregatedOrder | null)[];
  /** Array of aggregated sell orders (asks), sorted ascending by price. Null entries used for padding. */
  sells: (AggregatedOrder | null)[];
  /** The difference between the best ask and best bid price. */
  spread: number;
  /** Timestamp of the last update received from the source. */
  lastUpdated: Date;
  /** The maximum cumulative quantity across both bids and asks, used for depth calculation (uses BN.js). */
  maxDepth: BN;
  /** The price level closest to the last traded price */
  nearestPriceLevel?: number;
};

/**
 * Aggregates raw orders by price level, calculates running totals using BN.js, sorts, and truncates.
 *
 * @param orders Raw array of orders (OrderbookItem) from the source.
 * @param sortFn Sorting function for price levels (descending for bids, ascending for asks).
 * @param maxRows Maximum number of aggregated levels to return.
 * @param lastTradedPrice Optional last traded price for additional processing
 * @returns An array of aggregated order book levels.
 */
const aggregateOrders = (
  orders: OrderbookItem[],
  sortFn: (a: number, b: number) => number,
  maxRows: number = DEFAULT_ORDERBOOK_ROWS,
  lastTradedPrice?: number
): AggregatedOrder[] => {
  // Use a Map to efficiently aggregate quantities for the same price level.
  const aggregated = new Map<string, BN>();

  orders.forEach(order => {
    const priceBN = toBN(order.price);
    const quantityBN = toBN(order.quantity);

    if (!priceBN || !quantityBN) {
      console.warn('Invalid order data detected:', order);
      return;
    }

    const priceKey = priceBN.toString();
    const existingQuantity = aggregated.get(priceKey) || new BN(0);
    aggregated.set(priceKey, existingQuantity.add(quantityBN));
  });

  // Calculate running totals using BN.js
  let runningQuantity = new BN(0);
  let runningVolume = new BN(0);

  return Array.from(aggregated.entries())
    .map(([priceStr, quantity]) => ({
      priceBN: new BN(priceStr),
      price: Number(priceStr),
      quantityBN: quantity,
      quantity: Number(quantity.toString()),
    }))
    .sort((a, b) => sortFn(a.price, b.price))
    .slice(0, maxRows)
    .map(({ priceBN, price, quantityBN, quantity }) => {
      runningQuantity = runningQuantity.add(quantityBN);
      runningVolume = runningVolume.add(quantityBN.mul(priceBN));

      const aggregatedOrder: AggregatedOrder = {
        price,
        quantity,
        total: runningQuantity,
        volumeTotal: runningVolume,
        depth: 0,
      };

      if (lastTradedPrice) {
        const lastTradedPriceBN = toBN(lastTradedPrice);
        if (lastTradedPriceBN) {
          const deviation = calculatePriceDeviation(priceBN, lastTradedPriceBN);
          aggregatedOrder.priceDeviation = deviation;
          aggregatedOrder.isNearLastPrice = Math.abs(deviation) <= PRICE_PROXIMITY_THRESHOLD * 100;
        }
      }

      return aggregatedOrder;
    });
};

/**
 * Calculates the percentage deviation between two prices using BN
 */
const calculatePriceDeviation = (price: BN, referencePrice: BN): number => {
  if (referencePrice.isZero()) return 0;

  try {
    // Convert to normalized numbers for percentage calculation
    const p1 = normalizeBN(price, QUOTE_DECIMAL_SCALE);
    const p2 = normalizeBN(referencePrice, QUOTE_DECIMAL_SCALE);
    return ((p1 - p2) / p2) * 100;
  } catch (e) {
    console.error('Error calculating price deviation:', e);
    return 0;
  }
};

/**
 * Processes the raw order book data into a display-ready format.
 * Handles aggregation, sorting, depth calculation, padding, and spread calculation.
 *
 * @param orderbook The raw order book data from the source, or null if not yet loaded.
 * @param maxRows The maximum number of rows to display per side (bids/asks).
 * @param lastTradedPrice Optional last traded price for additional processing.
 * @param quantityThreshold Optional minimum quantity threshold (normalized value).
 * @returns A ProcessedOrderbook object ready for the UI.
 */
export const processOrderbook = (
  orderbook: Orderbook | null,
  maxRows: number = DEFAULT_ORDERBOOK_ROWS,
  lastTradedPrice?: number,
  quantityThreshold: number = MIN_DISPLAY_QUANTITY
): ProcessedOrderbook => {
  if (!orderbook || !orderbook.buys || !orderbook.sells) {
    return {
      buys: Array(maxRows).fill(null),
      sells: Array(maxRows).fill(null),
      spread: 0,
      lastUpdated: new Date(0),
      maxDepth: new BN(0),
    };
  }

  // Filter out orders below the quantity threshold
  const filteredBuys = orderbook.buys.filter(order => {
    const normalizedQuantity = Number(order.quantity) / Math.pow(10, BASE_DECIMALS);
    return normalizedQuantity >= quantityThreshold;
  });

  const filteredSells = orderbook.sells.filter(order => {
    const normalizedQuantity = Number(order.quantity) / Math.pow(10, BASE_DECIMALS);
    return normalizedQuantity >= quantityThreshold;
  });

  const buys = aggregateOrders(filteredBuys, (a, b) => b - a, maxRows, lastTradedPrice);
  const sells = aggregateOrders(filteredSells, (a, b) => a - b, maxRows, lastTradedPrice);

  const lastBuyTotal = buys.length > 0 ? buys[buys.length - 1].total : new BN(0);
  const lastSellTotal = sells.length > 0 ? sells[sells.length - 1].total : new BN(0);
  const maxDepth = lastBuyTotal.gt(lastSellTotal) ? lastBuyTotal : lastSellTotal;

  const calculateDepth = (orders: AggregatedOrder[]) => {
    orders.forEach(order => {
      if (maxDepth.isZero()) {
        order.depth = 0;
      } else {
        try {
          const depthBN = order.total.mul(new BN(10000)).div(maxDepth);
          order.depth = depthBN.toNumber() / 100;
        } catch (e) {
          console.error('Error calculating depth percentage:', e);
          order.depth = 0;
        }
      }
    });
  };

  calculateDepth(buys);
  calculateDepth(sells);

  const filledBuys = [...buys, ...Array(Math.max(0, maxRows - buys.length)).fill(null)];
  const filledSells = [...sells, ...Array(Math.max(0, maxRows - sells.length)).fill(null)];

  const bestAsk = filledSells[0]?.price;
  const bestBid = filledBuys[0]?.price;
  const spread = bestAsk !== undefined && bestBid !== undefined ? bestAsk - bestBid : 0;

  let nearestPriceLevel: number | undefined;
  if (lastTradedPrice) {
    const allPriceLevels = [...buys, ...sells]
      .filter((order): order is AggregatedOrder => order !== null)
      .map(order => order.price);

    if (allPriceLevels.length > 0) {
      nearestPriceLevel = allPriceLevels.reduce((nearest, current) => {
        const currentDiff = Math.abs(current - lastTradedPrice);
        const nearestDiff = Math.abs(nearest - lastTradedPrice);
        return currentDiff < nearestDiff ? current : nearest;
      });
    }
  }

  return {
    buys: filledBuys,
    sells: filledSells,
    spread,
    lastUpdated: orderbook.lastUpdated,
    maxDepth,
    nearestPriceLevel,
  };
};
