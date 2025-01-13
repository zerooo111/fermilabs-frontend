/**
 * fermiClient.ts
 * Global fermi client state management using Jotai
 */
import { FermiClient } from '@/solana/fermiClient';
import { atom } from 'jotai';

/**
 * Global atom for current fermi client
 * Initializes from URL params or defaults
 */
export const fermiClientAtom = atom<FermiClient | null>(null);

fermiClientAtom.debugLabel = 'fermiClient';
