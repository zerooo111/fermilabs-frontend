/**
 * Token decimals utility
 * Simplifies decimal logic based on token name
 */

/**
 * Get decimal places for a token based on its name
 * @param tokenName The name of the token (e.g., 'USDC', 'SOL', etc.)
 * @returns Number of decimal places (6 for USDC, 9 for all others)
 */
export function getTokenDecimals(tokenName?: string): number {
  if (!tokenName) return 9;

  // USDC uses 6 decimals, all other tokens use 9
  return tokenName.toUpperCase().includes('USDC') ? 6 : 9;
}
