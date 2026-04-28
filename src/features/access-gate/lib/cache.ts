/**
 * localStorage cache for "is this wallet whitelisted + valid session token".
 *
 * The cache is *advisory* — the backend gate is the source of truth. If the
 * cache says yes but the server says no (token expired, wallet removed),
 * write requests fail closed and we fall back to the modal. The cache only
 * exists so we don't show the invite modal to returning users while the
 * /v1/access/status call is in flight.
 */

const PREFIX = 'fermi.wl.';

export interface CachedSession {
  /** base58 wallet pubkey */
  wallet: string;
  /** HMAC session token from /v1/access/redeem|session */
  token: string;
  /** unix seconds when the token expires */
  expiresAt: number;
  /** unix ms when this entry was written (for cache age display) */
  cachedAt: number;
}

function key(wallet: string): string {
  return `${PREFIX}${wallet}`;
}

export function readSession(wallet: string): CachedSession | null {
  try {
    const raw = localStorage.getItem(key(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    // Sanity check + auto-evict expired tokens (5 min buffer for clock skew).
    if (
      parsed.wallet === wallet &&
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000)
    ) {
      return parsed;
    }
    localStorage.removeItem(key(wallet));
    return null;
  } catch {
    return null;
  }
}

export function writeSession(s: CachedSession): void {
  try {
    localStorage.setItem(key(s.wallet), JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode, quota) — operate in-memory only.
  }
}

export function clearSession(wallet: string): void {
  try {
    localStorage.removeItem(key(wallet));
  } catch {
    // ignore
  }
}
