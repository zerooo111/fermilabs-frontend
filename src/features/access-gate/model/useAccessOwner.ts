import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';

import { accessSessionAtom } from './accessAtoms';

/**
 * The connected wallet's base58 address, but only once it holds a valid access
 * session (redeemed invite / re-signed whitelist). Account-scoped reads key off
 * this instead of `publicKey` so a connected-but-ungated wallet stays view-only
 * and doesn't poll account, fee or simulate endpoints it can't use yet.
 */
export function useAccessOwner(): string | null {
  const { publicKey } = useWallet();
  const session = useAtomValue(accessSessionAtom);

  const wallet = publicKey?.toBase58() ?? null;
  if (!wallet) return null;
  const entry = session[wallet];
  if (!entry?.token) return null;
  return entry.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000) ? wallet : null;
}
