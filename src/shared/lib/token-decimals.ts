/**
 * Token registry and decimals utility
 * Maps mint addresses to token metadata and simplifies decimal logic
 */

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Known token mint addresses on Solana
 * Maps mint address to token information
 */
export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  // USDC (Circle)
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  },
  // Devnet/test USDC used by the FIFO perps e2e deployment
  Cpd41XpM9H7mjfyPgNsh3UscD2A1WmGaCW1xnjuzZn55: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  },
  // USDC placeholder for perps base mint
  '11111111111111111111111111111111': {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
  },
  // Native SOL (wrapped)
  So11111111111111111111111111111111111111112: {
    name: 'Wrapped SOL',
    symbol: 'SOL',
    decimals: 9,
  },
};

/**
 * Get token info from mint address
 * @param mint The mint address of the token
 * @returns TokenInfo if found, null otherwise
 */
export function getTokenFromMint(mint: string): TokenInfo | null {
  return TOKEN_REGISTRY[mint] ?? null;
}

/**
 * Get token name/symbol from mint address
 * @param mint The mint address of the token
 * @returns Token symbol if found, null otherwise
 */
export function getTokenNameFromMint(mint: string): string | null {
  return TOKEN_REGISTRY[mint]?.symbol ?? null;
}

/**
 * Get decimals from mint address
 * @param mint The mint address of the token
 * @returns Decimals if found, null otherwise
 */
export function getDecimalsFromMint(mint: string): number | null {
  return TOKEN_REGISTRY[mint]?.decimals ?? null;
}

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
