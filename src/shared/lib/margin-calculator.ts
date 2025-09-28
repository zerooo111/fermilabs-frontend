import { BN } from '@coral-xyz/anchor';

/**
 * Margin calculation utilities for perpetual orders
 * Matches the Rust backend logic in balance_manager.rs
 */

const BASIS_POINTS = 10_000;

export interface MarginCalculationInput {
  price: number | BN;
  quantity: number | BN;
  leverage?: number;
  marketInitialMarginBps?: number; // Market's initial margin in basis points
}

export interface MarginCalculationResult {
  requiredMargin: BN;
  marginRatioBps: number;
  notional: BN;
  impliedMarginFromLeverage: number;
  usedMarginRatio: number;
}

/**
 * Calculate required margin for a perpetual order
 *
 * Formula from Rust backend:
 * required_margin = (notional * margin_ratio_bps) / BASIS_POINTS
 *
 * Where margin_ratio_bps is the higher of:
 * 1. Market's initial_margin setting (in basis points)
 * 2. Implied margin from leverage: BASIS_POINTS / leverage
 *
 * @param input - Order parameters
 * @returns Margin calculation result
 */
export function calculatePerpMargin(input: MarginCalculationInput): MarginCalculationResult {
  const { price, quantity, leverage, marketInitialMarginBps = 0 } = input;

  // Convert to BN for precise calculations
  const priceBig = new BN(price.toString());
  const quantityBig = new BN(quantity.toString());

  // Step 1: Calculate notional value
  const notional = priceBig.mul(quantityBig);

  // Step 2: Start with market's initial margin ratio
  let marginRatioBps = marketInitialMarginBps;

  // Step 3: Calculate implied margin from leverage if provided
  let impliedMarginFromLeverage = 0;
  if (leverage && leverage > 0) {
    impliedMarginFromLeverage = Math.floor(BASIS_POINTS / leverage);
    // Use the higher of market margin or leverage-implied margin
    marginRatioBps = Math.max(marginRatioBps, impliedMarginFromLeverage);
  }

  // Step 4: Calculate required margin
  const requiredMargin =
    marginRatioBps === 0
      ? new BN(0)
      : notional.mul(new BN(marginRatioBps)).div(new BN(BASIS_POINTS));

  return {
    requiredMargin,
    marginRatioBps,
    notional,
    impliedMarginFromLeverage,
    usedMarginRatio: marginRatioBps / BASIS_POINTS, // Convert to decimal (e.g., 0.5 for 50%)
  };
}
