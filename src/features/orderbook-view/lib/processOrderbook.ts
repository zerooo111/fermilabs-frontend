import { Orderbook } from '@/entities/orderbook';

const PRICE_DECIMALS = 9; // 10^9 for price normalization
const DISPLAY_DECIMALS = 4; // Number of decimals to display
const DEFAULT_ORDERBOOK_ROWS = 10;

export type AggregatedOrder = {
  price: number;
  quantity: number;
  total: number; // Cumulative quantity
  volumeTotal: number; // Cumulative price * quantity
  depth: number;
};

export type ProcessedOrderbook = {
  buys: (AggregatedOrder | null)[];
  sells: (AggregatedOrder | null)[];
  spread: number;
  lastUpdated: Date;
  maxDepth: number;
};

const aggregateOrders = (
  orders: any[],
  sortFn: (a: number, b: number) => number,
  maxRows: number = DEFAULT_ORDERBOOK_ROWS
) => {
  const aggregated = new Map<number, number>();

  orders.forEach(order => {
    // Normalize price and quantity before aggregation
    const normalizedPrice = order.price;
    const normalizedQuantity = order.quantity;
    const existing = aggregated.get(normalizedPrice) || 0;
    aggregated.set(normalizedPrice, existing + normalizedQuantity);
  });

  let runningQuantity = 0;
  let runningVolume = 0;

  return Array.from(aggregated.entries())
    .sort(([a], [b]) => sortFn(a, b))
    .slice(0, maxRows)
    .map(([price, quantity]) => {
      runningQuantity += quantity;
      runningVolume += quantity * price;
      return {
        price,
        quantity,
        total: runningQuantity,
        volumeTotal: runningVolume,
        depth: 0, // Will be calculated after finding maxDepth
      };
    });
};

export const processOrderbook = (
  orderbook: Orderbook | null,
  maxRows: number = DEFAULT_ORDERBOOK_ROWS
): ProcessedOrderbook => {
  console.log('orderbook', orderbook);
  if (!orderbook || !orderbook.buys || !orderbook.sells) {
    return {
      buys: Array(maxRows).fill(null),
      sells: Array(maxRows).fill(null),
      spread: 0,
      lastUpdated: new Date(),
      maxDepth: 0,
    };
  }

  // Process buys and sells
  const buys = aggregateOrders(orderbook.buys, (a, b) => b - a, maxRows); // Descending
  const sells = aggregateOrders(orderbook.sells, (a, b) => a - b, maxRows); // Ascending
  console.log('buys', buys);
  console.log('sells', sells);
  // Calculate max depth based on cumulative quantity
  const maxDepth = Math.max(
    buys.length > 0 ? buys[buys.length - 1].total : 0,
    sells.length > 0 ? sells[sells.length - 1].total : 0
  );

  // Calculate depth percentages
  const calculateDepth = (orders: AggregatedOrder[]) => {
    orders.forEach(order => {
      order.depth = (order.total / maxDepth) * 100;
    });
  };

  calculateDepth(buys);
  calculateDepth(sells);

  // Fill remaining rows with null
  const filledBuys = [...buys, ...Array(Math.max(0, maxRows - buys.length)).fill(null)];
  const filledSells = [...sells, ...Array(Math.max(0, maxRows - sells.length)).fill(null)];

  const spread = Math.abs((filledBuys[0]?.price || 0) - (filledSells[0]?.price || 0));

  console.log('filledBuys', filledBuys);

  return {
    buys: filledBuys,
    sells: filledSells,
    spread,
    lastUpdated: orderbook.lastUpdated,
    maxDepth,
  };
};

export const formatPrice = (price: number): string => {
  // Handle potential NaN or invalid values
  if (!price || isNaN(price)) return '0.0000';

  // Format with consistent decimal places
  const normalizedPrice = price / Math.pow(10, PRICE_DECIMALS);
  return normalizedPrice.toFixed(DISPLAY_DECIMALS);
};

export const formatQuantity = (quantity: number): string => {
  // Handle potential NaN or invalid values
  if (!quantity || isNaN(quantity)) return '0.0000';

  // Format with consistent decimal places
  const normalizedQuantity = quantity / Math.pow(10, PRICE_DECIMALS);
  return normalizedQuantity.toFixed(DISPLAY_DECIMALS);
};
