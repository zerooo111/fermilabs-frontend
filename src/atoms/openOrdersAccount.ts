import { PublicKey } from '@solana/web3.js';
import { atom } from 'jotai';

export const openOrdersAccountAddressAtom = atom<PublicKey | null>(null);
