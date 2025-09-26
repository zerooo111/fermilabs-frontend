/**
 * Perp configuration and limits
 * Defines trading limits and constraints for perpetual contracts
 */

export interface PerpLimits {
  // Leverage limits
  maxLeverage: number;
  minLeverage: number;

  // Position size limits
  maxPositionSize: number; // Maximum position size in base tokens
  minPositionSize: number; // Minimum position size in base tokens

  // Order size limits
  maxOrderSize: number; // Maximum order size in base tokens
  minOrderSize: number; // Minimum order size in base tokens

  // Price limits (percentage deviation from market price)
  maxPriceDeviation: number; // Maximum price deviation for limit orders (as percentage)

  // Maintenance margin requirements
  maintenanceMarginRatio: number; // Minimum maintenance margin as ratio of position value

  // Liquidation thresholds
  liquidationThreshold: number; // Position gets liquidated when margin falls below this ratio
}

export const perpLimits: PerpLimits = {
  // Leverage constraints
  maxLeverage: 100, // Maximum 100x leverage
  minLeverage: 1, // Minimum 1x leverage (no leverage)

  // Position size constraints (in base tokens)
  maxPositionSize: 1000000, // Maximum 1M base tokens position
  minPositionSize: 0.01, // Minimum 0.01 base tokens position

  // Order size constraints
  maxOrderSize: 100000, // Maximum 100K base tokens per order
  minOrderSize: 0.01, // Minimum 0.01 base tokens per order

  // Price limits for limit orders (5% deviation from market price)
  maxPriceDeviation: 0.05,

  // Margin requirements
  maintenanceMarginRatio: 0.05, // 5% maintenance margin
  liquidationThreshold: 0.03, // 3% liquidation threshold
};

/**
 * Validate leverage value against perp limits
 */
export function validateLeverage(
  leverage: number,
  minLeverage?: number,
  maxLeverage?: number
): { isValid: boolean; error?: string } {
  const min = minLeverage ?? perpLimits.minLeverage;
  const max = maxLeverage ?? perpLimits.maxLeverage;

  if (leverage < min) {
    return { isValid: false, error: `Leverage must be at least ${min}x` };
  }
  if (leverage > max) {
    return { isValid: false, error: `Leverage cannot exceed ${max}x` };
  }
  return { isValid: true };
}

/**
 * Validate position/order size against perp limits
 */
export function validatePositionSize(
  size: number,
  isOrderSize: boolean = false
): { isValid: boolean; error?: string } {
  const minSize = isOrderSize ? perpLimits.minOrderSize : perpLimits.minPositionSize;
  const maxSize = isOrderSize ? perpLimits.maxOrderSize : perpLimits.maxPositionSize;
  const sizeType = isOrderSize ? 'order' : 'position';

  if (size < minSize) {
    return { isValid: false, error: `${sizeType} size must be at least ${minSize}` };
  }
  if (size > maxSize) {
    return { isValid: false, error: `${sizeType} size cannot exceed ${maxSize}` };
  }
  return { isValid: true };
}

/**
 * Validate price against market price with deviation limits
 */
export function validatePriceLimit(
  price: number,
  marketPrice: number
): { isValid: boolean; error?: string } {
  if (!marketPrice || marketPrice <= 0) {
    return { isValid: true }; // Skip validation if no market price available
  }

  const deviation = Math.abs(price - marketPrice) / marketPrice;
  if (deviation > perpLimits.maxPriceDeviation) {
    const maxAllowedPrice = marketPrice * (1 + perpLimits.maxPriceDeviation);
    const minAllowedPrice = marketPrice * (1 - perpLimits.maxPriceDeviation);
    return {
      isValid: false,
      error: `Price must be between ${minAllowedPrice.toFixed(4)} and ${maxAllowedPrice.toFixed(4)} (${(perpLimits.maxPriceDeviation * 100).toFixed(1)}% from market price)`,
    };
  }
  return { isValid: true };
}

/**
 * Get recommended leverage limits for display
 */
export function getLeverageLimits() {
  return {
    min: perpLimits.minLeverage,
    max: perpLimits.maxLeverage,
    recommended: [1, 2, 5, 10, 25, 50, 100],
  };
}

/**
 * Get position size limits for display
 */
export function getPositionSizeLimits() {
  return {
    min: perpLimits.minPositionSize,
    max: perpLimits.maxPositionSize,
    recommended: [0.1, 1, 10, 100, 1000],
  };
}
