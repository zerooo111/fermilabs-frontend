import { atomWithStorage } from 'jotai/utils';

/** Favourited market ids, kept per browser. */
export const favoriteMarketIdsAtom = atomWithStorage<string[]>('market-selector:favorites', []);
