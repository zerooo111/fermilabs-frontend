/**
 * Hook exposing the connected wallet's referral state plus the mint / bind /
 * claim actions.
 *
 * Auth mirrors `useApiKeys`: we read the access-gate session token from
 * `accessSessionAtom` (the in-memory mirror of the gate's localStorage) and
 * only act when the current wallet holds a non-expired token. On 401/403 the
 * session is stale or the wallet lost access; we surface a "reconnect" style
 * message consistent with the gate's fail-closed model.
 *
 * `me` and `referees` are per-wallet, session-scoped reads — they live in this
 * hook's local state and re-fetch on wallet swap / sign-in / expiry, rather
 * than in a global atom. Reads also lazily accrue on the backend (the /me and
 * /claim handlers seal closed epochs on access), so a refresh after a claim
 * reflects the new balance.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';

import { accessSessionAtom } from '@/features/access-gate';
import {
  ReferralsError,
  getMe,
  listReferees,
  createCode as createCodeRequest,
  bindCode as bindCodeRequest,
  claimRewards as claimRequest,
  type ReferralMe,
  type RefereeView,
  type ClaimResult,
} from '../api/referralsClient';

/** Maps a raw backend error code to user-facing copy. */
const ERROR_COPY: Record<string, string> = {
  // auth / gate
  missing_wallet_auth: 'Your session expired. Reconnect your wallet to continue.',
  invalid_token: 'Your session expired. Reconnect your wallet to continue.',
  token_expired: 'Your session expired. Reconnect your wallet to continue.',
  wallet_not_whitelisted: 'This wallet does not have access yet. Redeem an invite to continue.',
  // code creation
  invalid_code_length: 'Codes must be 4–20 characters.',
  invalid_code_chars: 'Use only letters, numbers, hyphens and underscores.',
  reserved_code: 'That code is reserved. Pick another.',
  code_taken: 'That code is already taken. Pick another.',
  code_limit_reached: 'You have reached the maximum number of referral codes.',
  code_gen_failed: 'Could not generate a code. Please retry.',
  // bind
  invalid_code: "That referral code doesn't exist.",
  self_referral: "You can't refer yourself.",
  already_bound: 'This wallet is already linked to a referrer.',
  already_trading: 'Referral codes must be applied before your first trade.',
  // claim
  below_min_claim: 'Your claimable balance is below the minimum payout.',
  // generic
  db_error: 'Something went wrong on our end. Please retry.',
  network_error: 'Network error. Please retry.',
};

function messageFor(e: unknown): string {
  if (e instanceof ReferralsError) {
    return ERROR_COPY[e.code] ?? `Request failed (${e.code}).`;
  }
  return 'Something went wrong. Please retry.';
}

export interface UseReferrals {
  /** True when the current wallet has a valid (non-expired) session token. */
  authorized: boolean;
  me: ReferralMe | null;
  referees: RefereeView[];
  loading: boolean;
  error: string | null;
  /** Mint a code (omit `code` for a random one). Returns the new code or null. */
  createCode: (code?: string) => Promise<string | null>;
  /** Attach a referrer's code to this wallet. Returns true on success. */
  bind: (code: string) => Promise<boolean>;
  /** Request a payout of the claimable balance. Returns the claim or null. */
  claim: () => Promise<ClaimResult | null>;
  refresh: () => Promise<void>;
  /** Last error code (machine-readable), for callers that branch on it. */
  lastErrorCode: string | null;
}

export function useReferrals(): UseReferrals {
  const { publicKey } = useWallet();
  const session = useAtomValue(accessSessionAtom);

  const wallet = publicKey?.toBase58() ?? null;
  const entry = wallet ? session[wallet] : undefined;
  const token =
    entry && entry.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000) ? entry.token : null;
  const authorized = !!token;

  const [me, setMe] = useState<ReferralMe | null>(null);
  const [referees, setReferees] = useState<RefereeView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  // Track the latest token so an in-flight request resolving after a wallet
  // swap doesn't write stale data into state.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const setErr = useCallback((e: unknown) => {
    setError(messageFor(e));
    setLastErrorCode(e instanceof ReferralsError ? e.code : null);
  }, []);

  const refresh = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) {
      setMe(null);
      setReferees([]);
      return;
    }
    setLoading(true);
    setError(null);
    setLastErrorCode(null);
    try {
      // /me lazily accrues on the backend, so fetch it first, then the list.
      const summary = await getMe(t);
      if (tokenRef.current !== t) return;
      setMe(summary);
      const rows = summary.referee_count > 0 ? await listReferees(t) : [];
      if (tokenRef.current !== t) return;
      setReferees(rows);
    } catch (e) {
      if (tokenRef.current !== t) return;
      setErr(e);
    } finally {
      if (tokenRef.current === t) setLoading(false);
    }
  }, [setErr]);

  // Refresh whenever the active token changes (wallet swap, sign-in, expiry).
  useEffect(() => {
    if (token) {
      void refresh();
    } else {
      setMe(null);
      setReferees([]);
      setError(null);
      setLastErrorCode(null);
    }
  }, [token, refresh]);

  const createCode = useCallback(
    async (code?: string): Promise<string | null> => {
      const t = tokenRef.current;
      if (!t) {
        setError(ERROR_COPY.missing_wallet_auth);
        return null;
      }
      setError(null);
      setLastErrorCode(null);
      try {
        const created = await createCodeRequest(t, code);
        if (tokenRef.current === t) {
          // Optimistically reflect the new code in the summary.
          setMe(prev => (prev ? { ...prev, codes: [...prev.codes, created.code] } : prev));
        }
        return created.code;
      } catch (e) {
        if (tokenRef.current === t) setErr(e);
        return null;
      }
    },
    [setErr]
  );

  const bind = useCallback(
    async (code: string): Promise<boolean> => {
      const t = tokenRef.current;
      if (!t) {
        setError(ERROR_COPY.missing_wallet_auth);
        return false;
      }
      setError(null);
      setLastErrorCode(null);
      try {
        await bindCodeRequest(t, code);
        return true;
      } catch (e) {
        if (tokenRef.current === t) setErr(e);
        return false;
      }
    },
    [setErr]
  );

  const claim = useCallback(async (): Promise<ClaimResult | null> => {
    const t = tokenRef.current;
    if (!t) {
      setError(ERROR_COPY.missing_wallet_auth);
      return null;
    }
    setError(null);
    setLastErrorCode(null);
    try {
      const result = await claimRequest(t);
      // A claim moves the balance into a pending claim; re-read to reflect it.
      void refresh();
      return result;
    } catch (e) {
      if (tokenRef.current === t) setErr(e);
      return null;
    }
  }, [refresh, setErr]);

  return {
    authorized,
    me,
    referees,
    loading,
    error,
    createCode,
    bind,
    claim,
    refresh,
    lastErrorCode,
  };
}
