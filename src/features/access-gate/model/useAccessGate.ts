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
  const { connected, publicKey, signMessage, disconnecting } = useWallet();
  const setSession = useSetAtom(accessSessionAtom);
  const setLoading = useSetAtom(gateLoadingAtom);
  const setGateOpen = useSetAtom(gateOpenAtom);

  // Guard against React StrictMode double-invocation triggering two
  // server-side challenge inserts for the same connect.
  const lastSeenWallet = useRef<string | null>(null);

  // Auth-flow effect: silently mint a session when a wallet connects.
  // Does NOT touch gateOpenAtom — gate visibility is owned by the page (via
  // its hasSession derivation) so we never race or override the page state.
  useEffect(() => {
    if (!connected || !publicKey) return;
    const wallet = publicKey.toBase58();
    if (lastSeenWallet.current === wallet) return;
    lastSeenWallet.current = wallet;

    let cancelled = false;

    const run = async () => {
      // 1. Cached session?
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

        // Not whitelisted, or wallet doesn't expose signMessage: open the
        // modal so the user can paste an invite code (or join the waitlist).
        if (!status.whitelisted || !signMessage) {
          setGateOpen(true);
          return;
        }

        // Whitelisted but no token: silent re-sign to mint a session.
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
        // Fall back to the manual redeem flow so the user isn't stuck.
        setGateOpen(true);
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
  useEffect(() => {
    if (disconnecting) {
      lastSeenWallet.current = null;
      setGateOpen(false);
    }
  }, [disconnecting, setGateOpen]);

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
