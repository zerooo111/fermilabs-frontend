/**
 * Jotai atoms for the invite-only access gate.
 *
 * - `accessSessionAtom`: { wallet -> { token, expiresAt } } in-memory mirror
 *   of localStorage. Single source of truth for "do we have a valid session
 *   for this wallet?"
 * - `gateOpenAtom`: whether the InviteCodeModal is mounted/visible.
 * - `gateLoadingAtom`: pre-flight status check is in flight; suppress UI
 *   write actions until known.
 */
import { atom } from 'jotai';

export interface AccessSession {
  token: string;
  expiresAt: number;
}

/** wallet base58 -> session */
export const accessSessionAtom = atom<Record<string, AccessSession>>({});

/** Modal visibility */
export const gateOpenAtom = atom<boolean>(false);

/** True while we're checking server status for a freshly-connected wallet */
export const gateLoadingAtom = atom<boolean>(false);

/**
 * Derived: returns `true` if the *current* wallet (passed in, since this is a
 * computed read) has a valid session. The hook layer applies this with the
 * connected publicKey from useWallet.
 */
export function makeHasSession(wallet: string | null) {
  return atom(get => {
    if (!wallet) return false;
    const s = get(accessSessionAtom)[wallet];
    if (!s) return false;
    return s.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000);
  });
}
