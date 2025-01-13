/**
 * market.ts
 * Global market state management using Jotai
 */

import { atom } from 'jotai';
import { getMarketAddressFromUrl } from '../utils/market';
import { MarketAccount } from '@/solana/fermiClient';

/**
 * Global atom for current market address
 * Initializes from URL params or defaults
 */
export const marketAddressAtom = atom<string>(getMarketAddressFromUrl());

export const marketAccountAtom = atom<MarketAccount | null>(null);

marketAddressAtom.debugLabel = 'marketAddress';
marketAccountAtom.debugLabel = 'marketAccount';
