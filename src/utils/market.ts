/**
 * market.ts
 * Utilities for handling market address from URL parameters
 */

import { PublicKey } from '@solana/web3.js';
import { env } from './env';

/**
 * Validates if a string is a valid Solana address
 */
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Gets market address from URL or returns default
 * Validates the address format before returning
 */
export const getMarketAddressFromUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  const marketAddress = params.get('market');

  if (marketAddress && isValidSolanaAddress(marketAddress)) {
    return marketAddress;
  }

  // If no valid market address in URL, update URL with default
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('market', env.VITE_DEFAULT_MARKET_ADDRESS);
  window.history.replaceState({}, '', newUrl.toString());

  return env.VITE_DEFAULT_MARKET_ADDRESS;
};
