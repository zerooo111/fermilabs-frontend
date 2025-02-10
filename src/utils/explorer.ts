/**
 * explorer.ts
 * Utilities for Solana explorer URLs
 */

/**
 * Get explorer URL for a transaction
 */
export const getExplorerUrl = (signature: string): string => {
  return signature;
  // return `${EXPLORER_BASE_URL}/tx/${signature}?cluster=${config.devnet.}`;
};
