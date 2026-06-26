/**
 * Wallet-connect lifecycle hook for the invite-only gate.
 *
 * On every wallet connect:
 *   1. Check localStorage for a non-expired session token. If present, hydrate
 *      Jotai and we're done (no network, no modal).
 *   2. Otherwise, ping /v1/access/status to know whether this wallet is
 *      whitelisted at all.
 *      - Whitelisted but no token: prompt for one signature ("welcome back"),
 *        exchange via /v1/access/session, store token. No modal needed.
 *      - Not whitelisted: open the InviteCodeModal.
 *
 * The hook is safe to mount once at the app root; it tracks the current
 * publicKey and re-runs only on wallet swaps.
 */
import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSetAtom } from 'jotai';
import { toast } from 'sonner';
import bs58 from 'bs58';

import {
  exchangeSession,
  fetchStatus,
  requestChallenge,
  AccessGateError,
} from '../api/accessClient';
import { readSession, writeSession, clearSession } from '../lib/cache';
import { accessSessionAtom, gateLoadingAtom, gateOpenAtom } from './accessAtoms';

export function useAccessGate() {
  const { connected, publicKey, signMessage } = useWallet();
  const setSession = useSetAtom(accessSessionAtom);
  const setLoading = useSetAtom(gateLoadingAtom);
  const setGateOpen = useSetAtom(gateOpenAtom);

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
        const status = await fetchStatus(wallet);
        if (cancelled) return;

        // Connected wallet has no access → open the gate so it's prompted for an
        // invite or referral code. Clear loading first so the modal shows the
        // code-entry step, not the "approve signature" spinner.
        if (!status.whitelisted) {
          setLoading(false);
          setGateOpen(true);
          return;
        }
        // Whitelisted but the adapter can't sign — nothing to do silently.
        if (!signMessage) return;

        const challenge = await requestChallenge(wallet, 'session');
        if (cancelled) return;
        const sigBytes = await signMessage(new TextEncoder().encode(challenge.message));
        const granted = await exchangeSession({
          wallet,
          nonce: challenge.nonce,
          signature: bs58.encode(sigBytes),
        });
        if (cancelled) return;

        setSession(prev => ({
          ...prev,
          [wallet]: { token: granted.token, expiresAt: granted.expires_at },
        }));
        writeSession({
          wallet,
          token: granted.token,
          expiresAt: granted.expires_at,
          cachedAt: Date.now(),
        });
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
  }, [connected, publicKey, signMessage, setSession, setLoading, setGateOpen]);

  // Disconnect: reset the per-wallet guard so a reconnect re-runs the status
  // check, and close the gate — the page is view-only without a wallet.
  // Watch !connected directly so we cover adapters that skip the transient
  // disconnecting state on a clean disconnect.
  useEffect(() => {
    if (!connected) {
      lastSeenWallet.current = null;
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
