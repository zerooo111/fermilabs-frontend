/**
 * Hook that exposes the connected wallet's API keys plus create/revoke actions.
 *
 * All calls are gated on the access-gate session: we only act when the current
 * wallet has a non-expired session token (i.e. it's whitelisted and signed in).
 * The token is read from `accessSessionAtom` — the same in-memory mirror the
 * access gate populates from localStorage — so we never build a separate auth
 * flow here.
 *
 * On 401/403 the session is stale or the wallet lost access; we surface a
 * "reconnect" style error consistent with the access gate's fail-closed model.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';

import { accessSessionAtom } from '@/features/access-gate';
import {
  ApiKeysError,
  createKey as createKeyRequest,
  listKeys as listKeysRequest,
  revokeKey as revokeKeyRequest,
  type ApiKeyView,
  type CreatedKey,
} from '../api/keysClient';

/** Maps a raw error code to user-facing copy. */
const ERROR_COPY: Record<string, string> = {
  invalid_label: 'That label is not allowed. Use a short, plain-text name.',
  key_limit_reached: 'You already have the maximum of 3 active keys.',
  missing_wallet_auth: 'Your session expired. Reconnect your wallet to continue.',
  invalid_token: 'Your session expired. Reconnect your wallet to continue.',
  token_expired: 'Your session expired. Reconnect your wallet to continue.',
  wallet_not_whitelisted: 'This wallet no longer has access. Redeem an invite to continue.',
  invalid_id: 'That key could not be found.',
  not_found: 'That key could not be found.',
  network_error: 'Network error. Please retry.',
};

function messageFor(e: unknown): string {
  if (e instanceof ApiKeysError) {
    return ERROR_COPY[e.code] ?? `Request failed (${e.code}).`;
  }
  return 'Something went wrong. Please retry.';
}

export interface UseApiKeys {
  /** True when the current wallet has a valid (non-expired) session token. */
  authorized: boolean;
  keys: ApiKeyView[];
  loading: boolean;
  error: string | null;
  /**
   * Creates a key and returns the full one-time secret. The raw `api_key` is
   * only ever available in this return value — the panel must show it once and
   * then discard it; it is never written to the keys list or persisted.
   */
  createKey: (label: string) => Promise<CreatedKey | null>;
  revokeKey: (id: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useApiKeys(): UseApiKeys {
  const { publicKey } = useWallet();
  const session = useAtomValue(accessSessionAtom);

  const wallet = publicKey?.toBase58() ?? null;
  const entry = wallet ? session[wallet] : undefined;
  const token =
    entry && entry.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000) ? entry.token : null;
  const authorized = !!token;

  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest token so an in-flight request resolving after a wallet
  // swap doesn't write stale keys into state.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) {
      setKeys([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listKeysRequest(t);
      if (tokenRef.current !== t) return;
      setKeys(rows);
    } catch (e) {
      if (tokenRef.current !== t) return;
      setError(messageFor(e));
    } finally {
      if (tokenRef.current === t) setLoading(false);
    }
  }, []);

  // Refresh whenever the active token changes (wallet swap, sign-in, expiry).
  useEffect(() => {
    if (token) {
      void refresh();
    } else {
      setKeys([]);
      setError(null);
    }
  }, [token, refresh]);

  const createKey = useCallback(async (label: string): Promise<CreatedKey | null> => {
    const t = tokenRef.current;
    if (!t) {
      setError(ERROR_COPY.missing_wallet_auth);
      return null;
    }
    setError(null);
    try {
      const created = await createKeyRequest(t, label);
      // Optimistically insert the *redacted* view only — never let the raw
      // secret into the persisted list. Strip `api_key` before storing.
      const { api_key: _secret, ...view } = created;
      if (tokenRef.current === t) setKeys(prev => [view, ...prev]);
      // Return the full CreatedKey so the panel can show the secret once.
      return created;
    } catch (e) {
      if (tokenRef.current === t) setError(messageFor(e));
      return null;
    }
  }, []);

  const revokeKey = useCallback(async (id: number): Promise<boolean> => {
    const t = tokenRef.current;
    if (!t) {
      setError(ERROR_COPY.missing_wallet_auth);
      return false;
    }
    setError(null);
    try {
      await revokeKeyRequest(t, id);
      if (tokenRef.current !== t) return true;
      // Backend deactivates (active=false) rather than hard-deleting; mirror
      // that locally so the row stays visible but marked inactive.
      setKeys(prev => prev.map(k => (k.id === id ? { ...k, active: false } : k)));
      return true;
    } catch (e) {
      if (tokenRef.current === t) setError(messageFor(e));
      return false;
    }
  }, []);

  return { authorized, keys, loading, error, createKey, revokeKey, refresh };
}
