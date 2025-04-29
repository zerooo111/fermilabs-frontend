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

/**
 * Number of decimal places used for internal price representation (e.g., 1_000_000_000 means 9 decimals).
 * Exchanges often send prices/quantities as integers scaled by a power of 10.
 */
export const PRICE_DECIMALS = 9;
/** Number of decimal places to display in the UI for prices and quantities. */
export const DISPLAY_DECIMALS = 2;
/** Default number of rows to display on each side (bids/asks) of the order book. */
const DEFAULT_ORDERBOOK_ROWS = 12;

/** Minimum normalized quantity to display prominently. Quantities below this are de-emphasized. */
export const MIN_DISPLAY_QUANTITY = 0.0001;

/** Threshold for highlighting price levels close to last traded price (as percentage) */
export const PRICE_PROXIMITY_THRESHOLD = 0.001; // 0.1%

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
 * Calculates the percentage deviation between two prices
 */
const calculatePriceDeviation = (price: number, referencePrice: number): number => {
  if (referencePrice === 0) return 0;
  return ((price - referencePrice) / referencePrice) * 100;
};

/**
 * Determines if a price level is close to the reference price within the threshold
 */
const isNearPrice = (price: number, referencePrice: number): boolean => {
  const deviation = Math.abs(calculatePriceDeviation(price, referencePrice));
  return deviation <= PRICE_PROXIMITY_THRESHOLD * 100;
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
  const aggregated = new Map<number, number>();

  orders.forEach(order => {
    const priceLevel = Number(order.price);
    const quantity = Number(order.quantity);

    if (isNaN(priceLevel) || isNaN(quantity)) {
      console.warn('Invalid order data detected (NaN price or quantity): ', order);
      return; // Skip invalid orders
    }
    const existingQuantity = aggregated.get(priceLevel) || 0;
    aggregated.set(priceLevel, existingQuantity + quantity);
  });

  // Calculate running totals using BN.js to prevent potential overflow.
  let runningQuantity = new BN(0);
  let runningVolume = new BN(0);

  return Array.from(aggregated.entries())
    .sort(([priceA], [priceB]) => sortFn(priceA, priceB))
    .slice(0, maxRows)
    .map(([price, quantity]) => {
      const quantityBN = new BN(String(Math.round(quantity)));
      const priceBN = new BN(String(price));

      runningQuantity = runningQuantity.add(quantityBN);
      runningVolume = runningVolume.add(quantityBN.mul(priceBN));

      const aggregatedOrder: AggregatedOrder = {
        price,
        quantity,
        total: runningQuantity,
        volumeTotal: runningVolume,
        depth: 0,
      };

      // Add last traded price related information if available
      if (lastTradedPrice) {
        aggregatedOrder.priceDeviation = calculatePriceDeviation(price, lastTradedPrice);
        aggregatedOrder.isNearLastPrice = isNearPrice(price, lastTradedPrice);
      }

      return aggregatedOrder;
    });
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
    const normalizedQuantity = Number(order.quantity) / Math.pow(10, PRICE_DECIMALS);
    return normalizedQuantity >= quantityThreshold;
  });

  const filteredSells = orderbook.sells.filter(order => {
    const normalizedQuantity = Number(order.quantity) / Math.pow(10, PRICE_DECIMALS);
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

/**
 * Formats a scaled integer price for display using a fixed number of decimal places.
 * Ensures consistent width by padding with spaces if needed.
 *
 * @param price The scaled integer price (e.g., price * 10^PRICE_DECIMALS).
 * @returns A string representation formatted to DISPLAY_DECIMALS decimal places.
 */
export const formatPrice = (price: number): string => {
  // Ensure input is a valid number before processing
  if (typeof price !== 'number' || isNaN(price)) return (0).toFixed(DISPLAY_DECIMALS);

  const normalizedPrice = price / Math.pow(10, PRICE_DECIMALS);
  // Use padStart to ensure consistent width for the integer part
  const [integerPart, decimalPart] = normalizedPrice.toFixed(DISPLAY_DECIMALS).split('.');
  const paddedInteger = integerPart.padStart(2, ' ');
  return `${paddedInteger}.${decimalPart}`;
};

/**
 * Formats a scaled integer quantity for display using a fixed number of decimal places.
 * Ensures consistent width by padding with spaces if needed.
 *
 * @param quantity The scaled integer quantity (e.g., quantity * 10^PRICE_DECIMALS).
 * @returns A string representation formatted to DISPLAY_DECIMALS decimal places.
 */
export const formatQuantity = (quantity: number): string => {
  // Ensure input is a valid number
  if (typeof quantity !== 'number' || isNaN(quantity)) return (0).toFixed(DISPLAY_DECIMALS);

  const normalizedQuantity = quantity / Math.pow(10, PRICE_DECIMALS);
  // Use padStart to ensure consistent width for the integer part
  const [integerPart, decimalPart] = normalizedQuantity.toFixed(DISPLAY_DECIMALS).split('.');
  const paddedInteger = integerPart.padStart(2, ' ');
  return `${paddedInteger}.${decimalPart}`;
};

/**
 * Calculates and formats the total value (price * quantity) for display using a fixed number of decimal places.
 * Ensures consistent width by padding with spaces if needed.
 * Note: This uses the normalized number values, not the internal BN cumulative volume.
 *
 * @param price Scaled integer price.
 * @param quantity Scaled integer quantity.
 * @returns A string representation of the total value, formatted to DISPLAY_DECIMALS decimal places.
 */
export const formatTotal = (price: number, quantity: number): string => {
  // Ensure inputs are valid numbers
  if (typeof price !== 'number' || isNaN(price) || typeof quantity !== 'number' || isNaN(quantity))
    return (0).toFixed(DISPLAY_DECIMALS);

  // Normalize both before multiplication to avoid potential intermediate overflow
  const normalizedPrice = price / Math.pow(10, PRICE_DECIMALS);
  const normalizedQuantity = quantity / Math.pow(10, PRICE_DECIMALS);
  const total = normalizedPrice * normalizedQuantity;

  // Use padStart to ensure consistent width for the integer part
  const [integerPart, decimalPart] = total.toFixed(DISPLAY_DECIMALS).split('.');
  const paddedInteger = integerPart.padStart(3, ' ');
  return `${paddedInteger}.${decimalPart}`;
};
