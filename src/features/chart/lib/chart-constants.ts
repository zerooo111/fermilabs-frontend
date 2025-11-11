/**
 * Chart configuration constants
 * Centralized configuration for chart components
 */
export const CHART_CONFIG = {
  REFETCH_INTERVAL_MS: 5000,
  MAX_INCREMENTAL_CANDLES: 5,
  MIN_CHART_HEIGHT: 400,
  PRICE_SCALE_MARGIN_TOP: 0.1,
  PRICE_SCALE_MARGIN_BOTTOM: 0.1,
} as const;
