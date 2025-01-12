/**
 * market.ts
 * Global market state management using Jotai
 */

import { atom } from 'jotai';
import { getMarketAddressFromUrl } from '../utils/market';

/**
 * Global atom for current market address
 * Initializes from URL params or defaults
 */
export const marketAddressAtom = atom<string>(getMarketAddressFromUrl());

marketAddressAtom.debugLabel = 'marketAddress';
