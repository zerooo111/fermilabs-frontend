/**
 * explorer.ts
 * Utilities for Solana explorer URLs
 */

import { env } from './env';

const EXPLORER_BASE_URL = 'https://explorer.solana.com';

/**
 * Get explorer URL for a transaction
 */
export const getExplorerUrl = (signature: string): string => {
  return `${EXPLORER_BASE_URL}/tx/${signature}?cluster=${env.VITE_SOLANA_CLUSTER}`;
};
