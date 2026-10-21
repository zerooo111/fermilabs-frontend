/**
 * Wallet-connect lifecycle hook for the invite-only gate.
 *
 * On every wallet connect:
 *   1. Check localStorage for a non-expired session token. If present, hydrate
 *      Jotai and we're done (no network, no modal).
 *   2. Otherwise trade the Privy login's identity token for a session: Privy's
 *      login already had the wallet sign, so no second signature. A wallet
 *      without access gets a points-only session and, in the trading app, the
 *      InviteCodeModal.
 *   3. Without an identity token, ping /v1/access/status to know whether this wallet is
 *      whitelisted at all.
 *      - Whitelisted but no token: prompt for one signature ("welcome back"),
 *        exchange via /v1/access/session, store token. No modal needed.
 *      - Not whitelisted: open the InviteCodeModal, except on points pages
 *        (`gateScopeAtom`), where the wallet can sign in for points only. The
 *        modal opens once the user moves on to the trading app.
 *
 * The hook is safe to mount once at the app root; it tracks the current
 * publicKey and re-runs only on wallet swaps.
 */
import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';
import bs58 from 'bs58';

import { privyIdentityToken } from '@/entities/wallet';
import {
  exchangePointsSession,
  exchangePrivySession,
  exchangeSession,
  fetchStatus,
  requestChallenge,
  AccessGateError,
} from '../api/accessClient';
import { readSession, writeSession, clearSession } from '../lib/cache';
import {
  accessSessionAtom,
  gateLoadingAtom,
  gateOpenAtom,
  gateScopeAtom,
  pointsSessionAtom,
  type AccessSession,
} from './accessAtoms';

/**
 * Signs a fresh session challenge with an already-whitelisted wallet and caches
 * the token. Throws `AccessGateError` (e.g. `wallet_not_whitelisted`). Callers
 * mirror the result into `accessSessionAtom`.
 */
export async function signInSession(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<AccessSession> {
  const challenge = await requestChallenge(wallet, 'session');
  const sigBytes = await signMessage(new TextEncoder().encode(challenge.message));
  const granted = await exchangeSession({
    wallet,
    nonce: challenge.nonce,
    signature: bs58.encode(sigBytes),
  });
  writeSession({
    wallet,
    token: granted.token,
    expiresAt: granted.expires_at,
    cachedAt: Date.now(),
  });
  return { token: granted.token, expiresAt: granted.expires_at };
}

/**
 * A session from the Privy login, no signature: `access` for a whitelisted
 * wallet, `points` otherwise. Null when there's no identity token or the
 * gateway won't take it; callers then fall back to a signed challenge.
 */
async function privySession(
  wallet: string
): Promise<{ scope: 'access' | 'points'; session: AccessSession } | null> {
  const identityToken = await privyIdentityToken();
  if (!identityToken) return null;
  try {
    const granted = await exchangePrivySession({ wallet, identity_token: identityToken });
    const scope = granted.whitelisted ? 'access' : 'points';
    writeSession(
      { wallet, token: granted.token, expiresAt: granted.expires_at, cachedAt: Date.now() },
      scope
    );
    return { scope, session: { token: granted.token, expiresAt: granted.expires_at } };
  } catch {
    return null;
  }
}

/**
 * Signs in to claim points: a whitelisted wallet gets its full access session
 * (so trading works too), any other wallet a points-only session. Uses the
 * Privy login when it can, else one signature. Callers mirror the result into
 * the atom for `scope`.
 */
export async function signInForPoints(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<{ scope: 'access' | 'points'; session: AccessSession }> {
  const viaPrivy = await privySession(wallet);
  if (viaPrivy) return viaPrivy;

  const { whitelisted } = await fetchStatus(wallet);
  if (whitelisted) return { scope: 'access', session: await signInSession(wallet, signMessage) };

  const challenge = await requestChallenge(wallet, 'points');
  const sigBytes = await signMessage(new TextEncoder().encode(challenge.message));
  const granted = await exchangePointsSession({
    wallet,
    nonce: challenge.nonce,
    signature: bs58.encode(sigBytes),
  });
  writeSession(
    { wallet, token: granted.token, expiresAt: granted.expires_at, cachedAt: Date.now() },
    'points'
  );
  return { scope: 'points', session: { token: granted.token, expiresAt: granted.expires_at } };
}

export function useAccessGate() {
  const { connected, publicKey, signMessage } = useWallet();
  const [sessions, setSession] = useAtom(accessSessionAtom);
  const setPointsSession = useSetAtom(pointsSessionAtom);
  const setLoading = useSetAtom(gateLoadingAtom);
  const setGateOpen = useSetAtom(gateOpenAtom);
  const scope = useAtomValue(gateScopeAtom);
  // The connected wallet when the server said it isn't whitelisted.
  const [needsInvite, setNeedsInvite] = useState<string | null>(null);

  // Guard against React StrictMode double-invocation triggering two
  // server-side challenge inserts for the same connect.
  const lastSeenWallet = useRef<string | null>(null);

  // Auth-flow effect: on every wallet connect, verify access. A cached/valid
  // session hydrates silently; a whitelisted wallet silently re-signs; a wallet
  // that is NOT whitelisted gets the invite modal opened so it's prompted for a
  // code (invite or referral) instead of reaching a trade UI that would only
  // fail server-side. We close the gate once a session is hydrated.
  useEffect(() => {
    if (!connected || !publicKey) return;
    const wallet = publicKey.toBase58();
    if (lastSeenWallet.current === wallet) return;
    lastSeenWallet.current = wallet;

    let cancelled = false;

    const run = async () => {
      const points = readSession(wallet, 'points');
      if (points) {
        setPointsSession(prev => ({
          ...prev,
          [wallet]: { token: points.token, expiresAt: points.expiresAt },
        }));
      }

      const cached = readSession(wallet);
      if (cached) {
        setSession(prev => ({
          ...prev,
          [wallet]: { token: cached.token, expiresAt: cached.expiresAt },
        }));
        setGateOpen(false);
        return;
      }

      setLoading(true);
      try {
        // The Privy login already proved the wallet: no second signature.
        const viaPrivy = await privySession(wallet);
        if (cancelled) return;
        if (viaPrivy?.scope === 'access') {
          setSession(prev => ({ ...prev, [wallet]: viaPrivy.session }));
          setGateOpen(false);
          return;
        }
        if (viaPrivy) {
          setPointsSession(prev => ({ ...prev, [wallet]: viaPrivy.session }));
          setLoading(false);
          setNeedsInvite(wallet);
          return;
        }

        const status = await fetchStatus(wallet);
        if (cancelled) return;

        // Connected wallet has no access → the effect below opens the gate so
        // it's prompted for an invite or referral code. Clear loading first so
        // the modal shows the code-entry step, not the "approve signature" spinner.
        if (!status.whitelisted) {
          setLoading(false);
          setNeedsInvite(wallet);
          return;
        }
        // Whitelisted but the adapter can't sign — nothing to do silently.
        if (!signMessage) return;

        const granted = await signInSession(wallet, signMessage);
        if (cancelled) return;

        setSession(prev => ({ ...prev, [wallet]: granted }));
        setGateOpen(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AccessGateError) {
          if (e.code === 'bad_signature' || e.code === 'invalid_challenge') {
            toast.error('Sign-in failed. Please try connecting again.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, signMessage, setSession, setPointsSession, setLoading, setGateOpen]);

  // A wallet without access is asked for a code in the trading app, not on
  // points pages; moving from one to the other opens the gate then.
  const wallet = publicKey?.toBase58();
  useEffect(() => {
    if (scope !== 'trade' || !connected || !wallet || needsInvite !== wallet) return;
    if (sessions[wallet]) return;
    setGateOpen(true);
  }, [scope, connected, wallet, needsInvite, sessions, setGateOpen]);

  // Disconnect: reset the per-wallet guard so a reconnect re-runs the status
  // check, and close the gate — the page is view-only without a wallet.
  // Watch !connected directly so we cover adapters that skip the transient
  // disconnecting state on a clean disconnect.
  useEffect(() => {
    if (!connected) {
      lastSeenWallet.current = null;
      setNeedsInvite(null);
      setGateOpen(false);
    }
  }, [connected, setGateOpen]);

  // Helper exposed for the modal to call after a successful redeem and for
  // an "I have another code" flow.
  return {
    storeSession: (wallet: string, token: string, expiresAt: number) => {
      setSession(prev => ({ ...prev, [wallet]: { token, expiresAt } }));
      writeSession({ wallet, token, expiresAt, cachedAt: Date.now() });
    },
    forgetSession: (wallet: string) => {
      setSession(prev => {
        const { [wallet]: _, ...rest } = prev;
        return rest;
      });
      clearSession(wallet);
    },
  };
}

/**
 * Read accessor used by request layers. Returns the bearer token for the
 * given wallet if a non-expired one exists. Reads from localStorage so it
 * works even outside React (e.g. inside an axios interceptor).
 */
export function getWalletAuthToken(wallet: string): string | null {
  const cached = readSession(wallet);
  return cached?.token ?? null;
}
