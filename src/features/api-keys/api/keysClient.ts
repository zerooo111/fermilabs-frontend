/**
 * REST client for /v1/keys/* endpoints.
 *
 * Every call is authenticated with the access-gate session token via the
 * `X-Wallet-Auth` header (the same HMAC token cached by the access gate —
 * see `features/access-gate/lib/cache.ts`). The backend gate is the source of
 * truth: a stale/expired token fails closed with 401, a non-whitelisted wallet
 * with 403. Errors are returned as `{ error: '<code>' }`; we surface the raw
 * code so the UI can map it to friendly copy.
 */
import axios, { AxiosError } from 'axios';
import { config } from '@/shared/config/constants';

const baseUrl = (): string => config.devnet.gatewayUrl;

/**
 * Redacted key view returned by GET /v1/keys. The raw secret is intentionally
 * absent — only `key_hint` (a short display tail, e.g. "…40a3") is exposed.
 */
export interface ApiKeyView {
  id: number;
  label: string;
  key_hint: string;
  created_at: string;
  active: boolean;
  max_connections: number;
}

/**
 * Full create response from POST /v1/keys. `api_key` is the FULL SECRET and is
 * returned EXACTLY ONCE, on create — it is never available again. Surface it to
 * the user immediately (show-once) and drop it from memory afterwards.
 */
export interface CreatedKey extends ApiKeyView {
  api_key: string;
}

export class ApiKeysError extends Error {
  constructor(
    public code: string,
    public httpStatus?: number
  ) {
    super(code);
    this.name = 'ApiKeysError';
  }
}

function unwrapError(e: unknown): never {
  if (axios.isAxiosError(e)) {
    const ax = e as AxiosError<{ error?: string }>;
    const code = ax.response?.data?.error || 'network_error';
    throw new ApiKeysError(code, ax.response?.status);
  }
  throw new ApiKeysError('unknown_error');
}

function authHeaders(token: string): Record<string, string> {
  return { 'X-Wallet-Auth': token };
}

export async function listKeys(token: string): Promise<ApiKeyView[]> {
  try {
    const res = await axios.get<ApiKeyView[]>(`${baseUrl()}/v1/keys`, {
      headers: authHeaders(token),
    });
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

export async function createKey(token: string, label: string): Promise<CreatedKey> {
  try {
    const res = await axios.post<CreatedKey>(
      `${baseUrl()}/v1/keys`,
      { label },
      { headers: authHeaders(token) }
    );
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}

export async function revokeKey(token: string, id: number): Promise<{ ok: true }> {
  try {
    const res = await axios.delete<{ ok: true }>(`${baseUrl()}/v1/keys/${id}`, {
      headers: authHeaders(token),
    });
    return res.data;
  } catch (e) {
    unwrapError(e);
  }
}
